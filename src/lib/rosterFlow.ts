// 채팅 명단 워크플로: 파일 업로드 → 표로 보여주고 중복 감지 → 제외 인원 확인 → 최종 명단 표 →
// "이 명단으로 'X' 행사 등록할까요?" → 동의 시 행사 생성. 자연어는 Gemini로 구조화 파싱.
import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { mapSheetRows, extractFromMedia, dedupeAttendees, attendeeToRow, type Attendee, type MediaPart } from "./extractRoster";
import { lookupNamesForDuplicates, normalizeName } from "./rosterLookup";

type Sheet = { name: string; rows?: Record<string, string>[]; headers?: string[] };
interface RosterState {
  stage: "review" | "confirm";
  eventName: string | null;
  attendees: Attendee[];
  dup: { name: string; sources: string[] }[];
  excluded: string[]; // 정규화된 이름
}

async function getSession(sb: SupabaseClient, convId: string): Promise<RosterState | null> {
  const { data } = await sb.from("chat_roster_sessions").select("state").eq("conversation_id", convId).maybeSingle();
  return (data?.state as RosterState) || null;
}
async function saveSession(sb: SupabaseClient, convId: string, state: RosterState) {
  await sb.from("chat_roster_sessions").upsert({ conversation_id: convId, state, updated_at: new Date().toISOString() }, { onConflict: "conversation_id" });
}
async function clearSession(sb: SupabaseClient, convId: string) {
  await sb.from("chat_roster_sessions").delete().eq("conversation_id", convId);
}

function esc(v: string) { return String(v ?? "").replace(/\|/g, "/").trim(); }

// 최종/검토 명단을 마크다운 표로
function rosterTable(attendees: Attendee[], excluded: string[], dup: RosterState["dup"]): string {
  const dupMap = new Map(dup.map((d) => [normalizeName(d.name), d.sources]));
  const kept = attendees.filter((a) => !excluded.includes(normalizeName(a.name)));
  const hasExtra = attendees.some((a) => a.custom && Object.keys(a.custom).length);
  const header = ["#", "이름", "연락처", "학과", "학년", ...(hasExtra ? ["기타"] : []), "중복"];
  const lines = [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`];
  kept.forEach((a, i) => {
    const extra = a.custom ? Object.entries(a.custom).map(([k, v]) => `${k}:${v}`).join(", ") : "";
    const src = dupMap.get(normalizeName(a.name));
    const cells = [
      String(i + 1), esc(a.name), esc(a.phone || "-"), esc(a.department || "-"),
      a.year != null ? String(a.year) : "-", ...(hasExtra ? [esc(extra || "-")] : []),
      src ? `⚠️ ${esc(src.join(", "))}` : "-",
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  });
  return lines.join("\n");
}

// 사용자 답을 구조화(제외 이름·행사명·확인·취소·무관)
async function parseReply(message: string, names: string[], curName: string | null): Promise<{ excludeNames: string[]; eventName: string; confirm: boolean; cancel: boolean; unrelated: boolean }> {
  const empty = { excludeNames: [], eventName: "", confirm: false, cancel: false, unrelated: false };
  const keys = (process.env.GEMINI_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean);
  if (!keys.length) return empty;
  const prompt = `사용자가 아래 명단으로 행사를 만들려 한다. 참석자 목록과 사용자 메시지를 보고 의도를 JSON으로만 답하라.
참석자(번호. 이름): ${names.map((n, i) => `${i + 1}.${n}`).join(", ")}
현재 행사명: ${curName ? `"${curName}"` : "(아직 없음)"}
사용자 메시지: "${message}"
규칙:
- 번호(예: 3,5번)로 말하면 그 번호의 이름을 excludeNames에 넣어라.
- "없음/제외 없음"이면 excludeNames는 빈 배열.
- 등록/진행/응/네/좋아/오케이/만들어 등 최종 등록 동의면 confirm=true.
- 취소/그만/안할래면 cancel=true.
- 행사명을 말하면 eventName에.
- 명단·행사와 무관한 딴 질문이면 unrelated=true.
형식: {"excludeNames":[],"eventName":"","confirm":false,"cancel":false,"unrelated":false}
JSON만 출력.`;
  for (const key of keys) {
    try {
      const ai = new GoogleGenerativeAI(key);
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
      const res = await model.generateContent([{ text: prompt }]);
      const m = res.response.text().match(/\{[\s\S]*\}/);
      if (!m) continue;
      const j = JSON.parse(m[0]);
      return {
        excludeNames: Array.isArray(j.excludeNames) ? j.excludeNames.map((x: any) => String(x)) : [],
        eventName: String(j.eventName || "").trim(),
        confirm: !!j.confirm, cancel: !!j.cancel, unrelated: !!j.unrelated,
      };
    } catch { continue; }
  }
  return empty;
}

async function createEvent(sb: SupabaseClient, cnuUserId: string, eventName: string, attendees: Attendee[]): Promise<string | null> {
  const { data: ev, error } = await sb.from("events").insert({ name: eventName, type: "onetime", created_by: cnuUserId || null }).select("id").single();
  if (error || !ev) return null;
  if (cnuUserId) await sb.from("event_members").insert({ event_id: ev.id, user_id: cnuUserId });
  const rows = attendees.map((a) => attendeeToRow(ev.id, a));
  if (rows.length) await sb.from("event_attendees").insert(rows);
  return ev.id;
}

function reviewText(attendees: Attendee[], dup: RosterState["dup"], excluded: string[]): string {
  const table = rosterTable(attendees, excluded, dup);
  const dupLine = dup.length
    ? `\n중복 의심 ${dup.length}명:\n${dup.map((d) => `${d.name} - ${d.sources.join(", ")}`).join("\n")}`
    : "\n중복 의심되는 사람은 없어요.";
  return `명단 ${attendees.length}명을 읽었어요.\n\n${table}\n${dupLine}\n\n행사에서 제외할 사람이 있으면 번호나 이름으로 알려주세요 (예: "3,5번 제외" 또는 "홍길동 빼줘"). 없으면 "없음". 그리고 등록할 행사명을 알려주세요.`;
}

/** 명단 워크플로 처리. 이 메시지가 명단 상호작용이면 답변 텍스트를, 아니면 null(일반 채팅으로) 반환. */
export async function runRosterFlow(
  sb: SupabaseClient, convId: string, cnuUserId: string,
  message: string, sheets: Sheet[], media: MediaPart[], lookupIntent: boolean,
): Promise<string | null> {
  const hasFiles = sheets.length > 0 || media.length > 0;

  // 1) 새 파일 업로드 (+명단/조회 의도) → 검토 시작
  if (hasFiles && lookupIntent) {
    const attendees: Attendee[] = [];
    for (const s of sheets) if (Array.isArray(s.rows) && Array.isArray(s.headers)) attendees.push(...mapSheetRows(s.rows, s.headers));
    if (media.length) attendees.push(...(await extractFromMedia(media)));
    const list = dedupeAttendees(attendees);
    if (!list.length) return "명단에서 이름을 찾지 못했어요. 파일이 명단이 맞는지 확인해주세요.";
    const { suspects } = await lookupNamesForDuplicates(list.map((a) => a.name));
    const state: RosterState = { stage: "review", eventName: null, attendees: list, dup: suspects, excluded: [] };
    await saveSession(sb, convId, state);
    return reviewText(list, suspects, []);
  }

  // 2) 진행 중 세션이 있으면 사용자 응답 처리
  const session = await getSession(sb, convId);
  if (!session) return null;

  const names = session.attendees.map((a) => a.name);
  const p = await parseReply(message, names, session.eventName);
  if (p.unrelated && !p.confirm && !p.cancel && p.excludeNames.length === 0 && !p.eventName) return null; // 딴 질문 → 일반 채팅

  if (p.cancel) { await clearSession(sb, convId); return "명단 등록을 취소했어요."; }

  // 제외 반영 (이름 정규화 매칭)
  const newExcluded = new Set(session.excluded);
  for (const raw of p.excludeNames) {
    const nk = normalizeName(raw);
    const hit = session.attendees.find((a) => normalizeName(a.name) === nk);
    if (hit) newExcluded.add(normalizeName(hit.name));
  }
  const excluded = [...newExcluded];
  const eventName = p.eventName || session.eventName;
  const finalList = session.attendees.filter((a) => !excluded.includes(normalizeName(a.name)));

  // 최종 등록은 반드시 "확인 단계(confirm)"에서 명시적 동의가 있을 때만 (한 턴에 이름+동의로 즉시 생성 금지)
  const canCreate = session.stage === "confirm" && p.confirm && eventName && finalList.length > 0;
  if (canCreate) {
    const eid = await createEvent(sb, cnuUserId, eventName!, finalList);
    await clearSession(sb, convId);
    if (!eid) return "행사 생성에 실패했어요. 잠시 후 다시 시도해주세요.";
    return `행사 "${eventName}"를 만들었어요. 참석자 ${finalList.length}명 등록 완료.\n\n${rosterTable(finalList, [], session.dup)}`;
  }

  // 상태 갱신 + 다음 안내 (이름이 있으면 confirm 단계로 올려 '등록할까요?' 질문)
  const nextStage: RosterState["stage"] = eventName ? "confirm" : "review";
  await saveSession(sb, convId, { ...session, excluded, eventName, stage: nextStage });
  const table = rosterTable(session.attendees, excluded, session.dup);
  if (!eventName) return `${table}\n\n현재 ${finalList.length}명이에요. 등록할 행사명을 알려주세요. (더 뺄 사람 있으면 이름이나 번호로)`;
  return `${table}\n\n이 명단(${finalList.length}명)으로 "${eventName}" 행사를 등록할까요?\n등록하려면 "등록", 더 뺄 사람은 이름·번호로, 그만두려면 "취소"라고 해주세요.`;
}
