import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { expandLinkedUsers } from "@/lib/accountLinks";

// 매일 저녁 9시(KST) — 지난 약속인데 아직 일지를 안 쓴 건을 찾아 약속 만든 사람에게 알림.
// 판별: appointment.date 지남 + 그 이후(met_date >= date) deleted 안 된 일지 부재 + 생명 미실패.
// 한 번만: reminded_at 세팅으로 재발송 방지.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const sb = createClient(url, anon);

  // KST 기준 오늘/현재시각
  const now = new Date();
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(now); // YYYY-MM-DD
  const nowHM = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const from = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(now.getTime() - 30 * 864e5));

  // 아직 알림 안 보낸, 최근 30일 내 지난 약속
  const { data: appts, error } = await sb
    .from("appointments")
    .select("id, life_id, date, time, created_by, lives(name, is_failed)")
    .is("reminded_at", null)
    .gte("date", from)
    .lte("date", today);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = (appts || []).filter((a: any) => {
    if (a.date < today) return true;
    if (a.date === today) return !a.time || String(a.time).slice(0, 5) <= nowHM;
    return false;
  });
  if (due.length === 0) return NextResponse.json({ ok: true, due: 0 });

  // 관련 생명들의 일지 (met_date >= 30일 전, 삭제 안 됨)
  const lifeIds = Array.from(new Set(due.map((a: any) => a.life_id).filter(Boolean)));
  const { data: journals } = await sb
    .from("journals")
    .select("life_id, met_date")
    .in("life_id", lifeIds)
    .is("deleted_at", null)
    .gte("met_date", from);
  const jByLife = new Map<string, string[]>();
  for (const j of journals || []) {
    const l = jByLife.get(j.life_id) || [];
    l.push(j.met_date);
    jByLife.set(j.life_id, l);
  }

  // 약속 이후 일지 없고 생명 미실패 → 대상. 만든 사람별로 묶음.
  const byUser = new Map<string, Set<string>>();
  for (const a of due as any[]) {
    if (a.lives?.is_failed) continue;
    const hasJournal = (jByLife.get(a.life_id) || []).some((d) => d >= a.date);
    if (hasJournal || !a.created_by) continue;
    const set = byUser.get(a.created_by) || new Set<string>();
    set.add(a.lives?.name || "생명");
    byUser.set(a.created_by, set);
  }

  // 발송
  let sentUsers = 0;
  for (const [userId, names] of byUser) {
    const list = [...names];
    const body = list.length === 1
      ? `${list[0]}님과의 약속 후 일지를 아직 안 썼어요.`
      : `${list.slice(0, 3).join(", ")}${list.length > 3 ? ` 외 ${list.length - 3}명` : ""} — 약속 후 일지 미작성 ${list.length}건.`;
    await fetch(`${url}/functions/v1/cnu-notify`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
      body: JSON.stringify({ action: "send", secret: process.env.CNU_NOTIFY_SECRET, user_ids: expandLinkedUsers([userId]), title: "일지 미작성 알림", body, url: "/", tag: "journal-reminder" }),
    }).catch(() => {});
    sentUsers++;
  }

  // 처리한 지난 약속은 모두 reminded 표시 (재발송 방지)
  await sb.from("appointments").update({ reminded_at: now.toISOString() }).in("id", due.map((a: any) => a.id));

  return NextResponse.json({ ok: true, due: due.length, notifiedUsers: sentUsers });
}
