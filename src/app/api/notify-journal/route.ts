import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { expandLinkedUsers } from "@/lib/accountLinks";

// 생명(life) 일지 작성 시 → 그 생명이 속한 단장단(manager)에게 푸시.
// 조용시간(KST 22:00~07:59)엔 발송하지 않는다.
function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

// 새벽 무음: 한국시간 22시~다음날 08시
function isQuietHoursKST(): boolean {
  const kstHour = (new Date().getUTCHours() + 9) % 24;
  return kstHour >= 22 || kstHour < 8;
}

export async function POST(req: NextRequest) {
  try {
    const { life_id, author_id } = await req.json();
    if (!life_id) return NextResponse.json({ ok: false });
    if (isQuietHoursKST()) return NextResponse.json({ ok: true, skipped: "quiet_hours" });

    const sb = getSb();
    const { data: life } = await sb.from("lives").select("id, name, primary_user_id").eq("id", life_id).maybeSingle();
    if (!life) return NextResponse.json({ ok: false });

    // 소속 단장단 산정: 생명 담당자(학생)의 manager_id, 담당자가 단장단이면 그 사람.
    const recipients = new Set<string>();
    if (life.primary_user_id) {
      const { data: owner } = await sb.from("users").select("id, role, manager_id").eq("id", life.primary_user_id).maybeSingle();
      if (owner) {
        if (owner.manager_id) recipients.add(owner.manager_id as string);
        if (owner.role === "manager") recipients.add(owner.id as string);
      }
    }
    // 작성자 본인은 제외 (자기가 쓴 일지 알림 안 감)
    if (author_id) recipients.delete(author_id);
    if (recipients.size === 0) return NextResponse.json({ ok: true, sent: 0 });

    // 작성자 이름 (본문용)
    let authorName = "";
    if (author_id) {
      const { data: au } = await sb.from("users").select("display_name").eq("id", author_id).maybeSingle();
      authorName = au?.display_name || "";
    }

    // 연결된 계정(같은 사람의 다른 계정)에도 함께 발송
    const userIds = expandLinkedUsers([...recipients]);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const res = await fetch(`${url}/functions/v1/cnu-notify`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
      body: JSON.stringify({
        action: "send",
        secret: process.env.CNU_NOTIFY_SECRET,
        user_ids: userIds,
        title: `${life.name} 일지 작성완료`,
        body: authorName ? `${authorName}님이 일지를 작성했어요.` : "새 일지가 작성됐어요.",
        url: `/life/${life_id}`, // 알림 클릭 → 해당 생명 페이지로 이동
        tag: `journal-${life_id}-${Date.now()}`, // 매 일지마다 새 알림
      }),
    });
    return NextResponse.json(await res.json());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
