import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { expandLinkedUsers } from "@/lib/accountLinks";

// 운영진이 '관리자에게 피드백 요청'을 누르면 →
// 이 행사 참석자의 담당(manager_id)으로 지정된 사람 전원에게 요청 레코드 생성 + 푸시.
function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

export async function POST(req: NextRequest) {
  try {
    const { event_id } = await req.json();
    if (!event_id) return NextResponse.json({ ok: false });
    const sb = getSb();

    const [evRes, attRes] = await Promise.all([
      sb.from("events").select("name").eq("id", event_id).maybeSingle(),
      sb.from("event_attendees").select("manager_id, assessment").eq("event_id", event_id).eq("is_member", false).not("manager_id", "is", null),
    ]);
    const eventName = evRes.data?.name || "행사";
    const atts = (attRes.data || []) as { manager_id: string; assessment: string | null }[];
    if (atts.length === 0) return NextResponse.json({ ok: true, managers: 0, sent: 0 });

    // 대상 = '파악(assessment)이 아직 비어 있는 참석자'를 가진 담당자.
    // 한 번 제출했어도, 담당 생명이 추가되거나 일부만 작성했으면 다시 감.
    const incomplete = new Set<string>();
    for (const a of atts) {
      if (a.manager_id && !(a.assessment && a.assessment.trim())) incomplete.add(a.manager_id);
    }
    const targetIds = [...incomplete];
    if (targetIds.length === 0) {
      return NextResponse.json({ ok: true, managers: 0, sent: 0, allDone: true });
    }

    // 요청 레코드 재오픈 (미작성 담당자만) → 배너 다시 표시
    await sb.from("event_feedback_requests").upsert(
      targetIds.map((mid) => ({ event_id, manager_id: mid, status: "open" })),
      { onConflict: "event_id,manager_id" }
    );

    // 연결 계정 포함 푸시 발송 (미작성 담당자만)
    const userIds = expandLinkedUsers(targetIds);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const res = await fetch(`${url}/functions/v1/cnu-notify`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
      body: JSON.stringify({
        action: "send",
        secret: process.env.CNU_NOTIFY_SECRET,
        user_ids: userIds,
        title: `📝 ${eventName} 피드백 작성 요청`,
        body: "행사에서 만난 분들의 파악 내용을 작성해 주세요.",
        url: `/event-feedback/${event_id}`,
        tag: `feedback-${event_id}-${Date.now()}`,
      }),
    });
    return NextResponse.json({ ...(await res.json()), managers: targetIds.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
