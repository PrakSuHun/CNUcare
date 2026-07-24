import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { expandLinkedUsers } from "@/lib/accountLinks";

// 외부 폼 신청 발생 시 → 그 행사에 연결된 모니터링 인원 전원에게 푸시.
// (연결된 사람 = event_members. 관리자가 아니라 모니터링 인원이다.)
// 단, 행사 설정(config.notify_optout)에서 개별로 알림을 끈 사람은 제외.
export async function POST(req: NextRequest) {
  try {
    const { event_id, name } = await req.json();
    if (!event_id) return NextResponse.json({ ok: false });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const sb = createClient(url, anon);

    const [membersRes, evRes, cfgRes] = await Promise.all([
      sb.from("event_members").select("user_id").eq("event_id", event_id),
      sb.from("events").select("name").eq("id", event_id).maybeSingle(),
      sb.from("event_forms").select("config").eq("event_id", event_id).eq("type", "settings").limit(1),
    ]);
    const ev = evRes.data;
    const optOut: string[] = (cfgRes.data?.[0]?.config?.notify_optout as string[]) || [];
    const memberIds = Array.from(
      new Set((membersRes.data || []).map((m: any) => m.user_id).filter(Boolean)),
    ).filter((uid) => !optOut.includes(uid as string));
    // 연결된 계정(동일 인물의 다른 계정)에도 함께 발송
    const userIds = expandLinkedUsers(memberIds as string[]);
    if (userIds.length === 0) return NextResponse.json({ ok: true, sent: 0 });

    const res = await fetch(`${url}/functions/v1/cnu-notify`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
      body: JSON.stringify({
        action: "send",
        secret: process.env.CNU_NOTIFY_SECRET,
        user_ids: userIds,
        title: `${ev?.name || "행사"} 신청`,
        body: `${name || "누군가"}님이 신청했어요.`,
        url: "/",
        tag: `reg-${event_id}`,
      }),
    });
    return NextResponse.json(await res.json());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
