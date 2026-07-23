import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 외부 폼 신청 발생 시 → 그 행사 담당자(event_members + 생성자)에게 푸시.
export async function POST(req: NextRequest) {
  try {
    const { event_id, name } = await req.json();
    if (!event_id) return NextResponse.json({ ok: false });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const sb = createClient(url, anon);

    const [membersRes, evRes] = await Promise.all([
      sb.from("event_members").select("user_id").eq("event_id", event_id),
      sb.from("events").select("name, created_by").eq("id", event_id).maybeSingle(),
    ]);
    const ev = evRes.data;
    const userIds = Array.from(
      new Set([...(membersRes.data || []).map((m: any) => m.user_id), ev?.created_by].filter(Boolean)),
    );
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
