import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { expandLinkedUsers } from "@/lib/accountLinks";
import { lookupOnePerson } from "@/lib/rosterLookup";

// 외부 폼 신청 발생 시 → 그 행사에 연결된 모니터링 인원 전원에게 푸시.
// (연결된 사람 = event_members. 관리자가 아니라 모니터링 인원이다.)
// 알림을 끈 사람(config.notify_optout)은 일반 신청 알림에서 제외하지만,
// "중복 신청 의심"은 중요하므로 알림을 꺼둔 사람에게도 보낸다.
// 알림 클릭 시 해당 행사 상세로 바로 이동(/event/[id] → 역할별 리다이렉트).
export async function POST(req: NextRequest) {
  try {
    const { event_id, name, phone } = await req.json();
    if (!event_id) return NextResponse.json({ ok: false });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const sb = createClient(url, anon);

    const [membersRes, evRes, cfgRes, dup] = await Promise.all([
      sb.from("event_members").select("user_id").eq("event_id", event_id),
      sb.from("events").select("name").eq("id", event_id).maybeSingle(),
      sb.from("event_forms").select("config").eq("event_id", event_id).eq("type", "settings").limit(1),
      lookupOnePerson(String(name || ""), phone, String(event_id)).catch(() => null),
    ]);
    const ev = evRes.data;
    const overlap = dup?.hasOverlap ?? false;

    // 프로젠에서 이름+전화가 모두 일치하는 '포도'(=섭리회원)로 확인되면,
    // 방금 접수된 이 행사 참석자를 섭리회원으로 자동 구분한다. (타대학교라 CNU 가입은 없어도 섭리회원)
    if (dup?.isProgenPodo && name && phone) {
      await sb
        .from("event_attendees")
        .update({ is_member: true })
        .eq("event_id", event_id)
        .eq("name", name)
        .eq("phone", phone)
        .eq("is_member", false);
    }
    const optOut: string[] = (cfgRes.data?.[0]?.config?.notify_optout as string[]) || [];
    const allMembers = Array.from(new Set((membersRes.data || []).map((m: any) => m.user_id).filter(Boolean)));
    // 중복 의심 → 알림 끈 사람 포함 전원 / 일반 → 옵트아웃 제외
    const targetIds = overlap ? allMembers : allMembers.filter((uid) => !optOut.includes(uid as string));
    // 연결된 계정(동일 인물의 다른 계정)에도 함께 발송
    const userIds = expandLinkedUsers(targetIds as string[]);
    if (userIds.length === 0) return NextResponse.json({ ok: true, sent: 0 });

    const who = name || "누군가";
    const title = overlap ? `⚠️ ${ev?.name || "행사"} 신청 · 중복 신청 의심` : `${ev?.name || "행사"} 신청`;
    const body = overlap
      ? `${who}님이 신청 — 같은 이름이 이전에 참여한 적 있어요: ${dup!.summary}. (동명이인일 수 있으니 확인 후 판단하세요)`
      : `${who}님이 신청했어요.`;

    const res = await fetch(`${url}/functions/v1/cnu-notify`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
      body: JSON.stringify({
        action: "send",
        secret: process.env.CNU_NOTIFY_SECRET,
        user_ids: userIds,
        title,
        body,
        url: `/event/${event_id}`, // 알림 클릭 → 해당 행사로 바로 이동
        // 신청마다 고유 tag — 같은 행사라도 OS가 이전 알림을 덮어쓰지 않고 매번 새로 알림.
        tag: `reg-${event_id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      }),
    });
    return NextResponse.json({ ...(await res.json()), overlap, summary: dup?.summary || null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
