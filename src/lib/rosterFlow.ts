// 채팅 명단 워크플로: 파일 업로드 → 표로 보여주고 중복 감지 → 제외 인원 확인 → 최종 명단 표 →
// "이 명단으로 'X' 행사 등록할까요?" → 동의 시 행사 생성. 자연어는 Gemini로 구조화 파싱.
import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { mapSheetRows, extractFromMedia, dedupeAttendees, attendeeToRow, type Attendee, type MediaPart } from "./extractRoster";
import {
  lookupNamesForDuplicates, normalizeName,
  resolveManagerByName, createPlaceholderManager, ensureEventMember,
} from "./rosterLookup";

// 담당 이름 → 실제 유저(유일 매칭) 또는 미가입 관리자(placeholder). 자동 배정 플로우용(확인 없음).
// 유일하게 특정되면 그 유저, 0개거나 애매하면 파일에 적힌 이름 그대로 placeholder 생성.
async function resolveOrCreateManager(name: string): Promise<{ id: string; display_name: string } | null> {
  const cands = await resolveManagerByName(name);
  const exacts = cands.filter((c) => c.kind === "exact");
  if (exacts.length === 1) return exacts[0];
  if (cands.length === 1) return cands[0];
  const givens = cands.filter((c) => c.kind === "given");
  if (exacts.length === 0 && givens.length === 1) return givens[0];
  return await createPlaceholderManager(name); // 없음/애매 → 새 미가입 관리자
}

// 참가자–담당자 매칭표(마크다운)
function managerTable(assigned: { name: string; manager: string }[]): string {
  const lines = ["| 참가자 | 담당자 |", "|---|---|"];
  for (const a of assigned) lines.push(`| ${esc(a.name)} | ${esc(a.manager)} |`);
  return lines.join("\n");
}

type Sheet = { name: string; rows?: Record<string, string>[]; headers?: string[] };

// 새 행사 등록 플로우 상태 (기존)
interface CreateState {
  mode?: "create";
  stage: "review" | "confirm";
  eventName: string | null;
  attendees: Attendee[];
  dup: { name: string; sources: string[] }[];
  excluded: string[]; // 정규화된 이름
}

// 기존 행사에 담당(관리자) 배정 플로우 상태 (신규)
interface AssignState {
  mode: "assign";
  stage: "pickEvent" | "pickManager" | "confirmMapping";
  eventId: string | null;
  eventName: string | null;
  eventCandidates: { id: string; name: string }[];
  items: { attendeeName: string; managerQuery: string }[]; // 참가자–담당(질의) 쌍
  resolved: Record<string, { userId?: string; displayName?: string; createName?: string }>; // 담당질의(정규화) → 해석
  pending?: { query: string; candidates: { id: string; display_name: string }[] }; // 현재 되묻는 담당 후보
}

type Session = CreateState | AssignState;

async function getSession(sb: SupabaseClient, convId: string): Promise<Session | null> {
  const { data } = await sb.from("chat_roster_sessions").select("state").eq("conversation_id", convId).maybeSingle();
  return (data?.state as Session) || null;
}
async function saveSession(sb: SupabaseClient, convId: string, state: Session) {
  await sb.from("chat_roster_sessions").upsert({ conversation_id: convId, state, updated_at: new Date().toISOString() }, { onConflict: "conversation_id" });
}
async function clearSession(sb: SupabaseClient, convId: string) {
  await sb.from("chat_roster_sessions").delete().eq("conversation_id", convId);
}

function esc(v: string) { return String(v ?? "").replace(/\|/g, "/").trim(); }

// 최종/검토 명단을 마크다운 표로
function rosterTable(attendees: Attendee[], excluded: string[], dup: CreateState["dup"]): string {
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
  // 인터랙티브 채팅 경로(매 답변마다 호출) — 지연 최소화 위해 Gemini 전용 유지(Claude 브릿지 콜드스타트 회피).
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

async function createEvent(
  sb: SupabaseClient, cnuUserId: string, eventName: string, attendees: Attendee[],
): Promise<{ eventId: string; assigned: { name: string; manager: string }[]; memberAddedCount: number } | null> {
  const { data: ev, error } = await sb.from("events").insert({ name: eventName, type: "onetime", created_by: cnuUserId || null }).select("id").single();
  if (error || !ev) return null;
  if (cnuUserId) await sb.from("event_members").insert({ event_id: ev.id, user_id: cnuUserId });

  const rows = attendees.map((a) => attendeeToRow(ev.id, a));
  let inserted: { id: string; name: string }[] = [];
  if (rows.length) {
    const { data } = await sb.from("event_attendees").insert(rows).select("id, name");
    inserted = (data || []) as { id: string; name: string }[];
  }

  // 파일에 담당자가 적힌 참가자는 담당(manager_id) 배정. 이름→id 큐로 동명이인 대응.
  const idQueue = new Map<string, string[]>();
  for (const r of inserted) {
    const k = normalizeName(r.name);
    const q = idQueue.get(k) || [];
    q.push(r.id);
    idQueue.set(k, q);
  }
  const assigned: { name: string; manager: string }[] = [];
  const memberAdded = new Set<string>();
  const matchedMgrs = new Map<string, string>(); // 매칭된 관리자 id -> display_name
  for (const a of attendees) {
    const mgrName = (a.manager || "").trim();
    const id = idQueue.get(normalizeName(a.name))?.shift();
    if (!mgrName || !id) continue;
    const mgr = await resolveOrCreateManager(mgrName);
    if (!mgr) continue;
    if (!memberAdded.has(mgr.id)) { await ensureEventMember(ev.id, mgr.id); memberAdded.add(mgr.id); }
    matchedMgrs.set(mgr.id, mgr.display_name);
    await sb.from("event_attendees").update({ manager_id: mgr.id }).eq("id", id);
    assigned.push({ name: a.name, manager: mgr.display_name });
  }

  // 매칭된 관리자를 섭리회원 참석자로도 추가 (명단에 같은 이름이 아직 없을 때만)
  const attNames = new Set(inserted.map((r) => normalizeName(r.name)));
  const mgrRows: Record<string, unknown>[] = [];
  for (const dn of matchedMgrs.values()) {
    const k = normalizeName(dn);
    if (!dn || attNames.has(k)) continue;
    attNames.add(k);
    mgrRows.push({ event_id: ev.id, name: dn, is_member: true, status: "pending" });
  }
  if (mgrRows.length) await sb.from("event_attendees").insert(mgrRows);

  return { eventId: ev.id, assigned, memberAddedCount: mgrRows.length };
}

function reviewText(attendees: Attendee[], dup: CreateState["dup"], excluded: string[]): string {
  const table = rosterTable(attendees, excluded, dup);
  const dupLine = dup.length
    ? `\n중복 의심 ${dup.length}명:\n${dup.map((d) => `${d.name} - ${d.sources.join(", ")}`).join("\n")}`
    : "\n중복 의심되는 사람은 없어요.";
  return `명단 ${attendees.length}명을 읽었어요.\n\n${table}\n${dupLine}\n\n행사에서 제외할 사람이 있으면 번호나 이름으로 알려주세요 (예: "3,5번 제외" 또는 "홍길동 빼줘"). 없으면 "없음". 그리고 등록할 행사명을 알려주세요.`;
}

// ── 담당 배정(assign) 플로우 ──────────────────────────────
const isYes = (m: string) => /(^|\s)(네|넵|예|응|어어|어|맞아|맞아요|맞습니다|맞음|그래|그래요|좋아|좋아요|ㅇㅇ|오케이|오키|ok|okay|진행|해줘|등록|배정)/i.test(m.trim());
const isNo = (m: string) => /(아니|아뇨|아녜|아닌|틀려|틀렸|다른|no)/i.test(m.trim());
const isCancel = (m: string) => /(취소|그만|중단|안할|안 할|안해|안 해|하지마|하지 마)/i.test(m.trim());

// 배정 요청 자연어 파싱 (행사·참가자·담당)
async function parseAssignRequest(message: string): Promise<{ eventQuery: string; managerForAll: string; attendees: { name: string; manager: string }[] }> {
  const empty = { eventQuery: "", managerForAll: "", attendees: [] as { name: string; manager: string }[] };
  // 인터랙티브 채팅 경로 — 지연 최소화 위해 Gemini 전용 유지.
  const keys = (process.env.GEMINI_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean);
  if (!keys.length) return empty;
  const prompt = `사용자가 어떤 행사의 참가자에게 담당(관리자)을 지정하려 한다. 메시지에서 정보를 JSON으로만 뽑아라.
메시지: "${message}"
- eventQuery: 언급된 행사 이름(부분/약칭 가능). 없으면 "".
- attendees: [{"name":"참가자이름","manager":"그 사람 담당이름"}] 배열. 참가자별 담당이 다르면 각각. 없으면 [].
- managerForAll: 모든 참가자 공통 담당 이름(예 "다 경석 담당으로"). 없으면 "".
- 담당 이름은 성을 뺀 약칭일 수 있다(예 "경석").
형식: {"eventQuery":"","managerForAll":"","attendees":[{"name":"","manager":""}]}
JSON만 출력.`;
  for (const key of keys) {
    try {
      const ai = new GoogleGenerativeAI(key);
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
      const res = await model.generateContent([{ text: prompt }]);
      const mm = res.response.text().match(/\{[\s\S]*\}/);
      if (!mm) continue;
      const j = JSON.parse(mm[0]);
      const attendees = Array.isArray(j.attendees)
        ? j.attendees.map((x: any) => ({ name: String(x?.name || "").trim(), manager: String(x?.manager || "").trim() })).filter((x: any) => x.name)
        : [];
      return { eventQuery: String(j.eventQuery || "").trim(), managerForAll: String(j.managerForAll || "").trim(), attendees };
    } catch { continue; }
  }
  return empty;
}

async function findEvents(sb: SupabaseClient, query: string): Promise<{ id: string; name: string }[]> {
  const q = query.trim();
  if (!q) return [];
  const { data } = await sb.from("events").select("id, name").ilike("name", `%${q}%`).order("created_at", { ascending: false }).limit(8);
  return (data || []) as { id: string; name: string }[];
}

function askManagerText(query: string, candidates: { id: string; display_name: string }[]): string {
  if (candidates.length === 1) return `담당자 "${query}"은(는) "${candidates[0].display_name}" 맞나요? (네 / 아니오 / 새로 만들기)`;
  const list = candidates.map((c, i) => `${i + 1}. ${c.display_name}`).join("\n");
  return `담당자 "${query}" 후보가 여러 명이에요. 누구인가요?\n${list}\n번호나 이름으로 알려주세요. 명단에 없으면 "새로 만들기".`;
}

function mappingText(state: AssignState): string {
  const lines = ["| 참가자 | 담당자 |", "|---|---|"];
  for (const it of state.items) {
    const r = state.resolved[normalizeName(it.managerQuery)];
    const label = r?.displayName || (r?.createName ? `${r.createName} (미가입 새로 생성)` : it.managerQuery);
    lines.push(`| ${esc(it.attendeeName)} | ${esc(label)} |`);
  }
  return lines.join("\n");
}

// 담당 질의를 하나씩 해석. 애매하면 되묻고, 전부 끝나면 매핑 확인으로.
async function advanceManagerResolution(sb: SupabaseClient, convId: string, state: AssignState): Promise<string> {
  for (const it of state.items) {
    const key = normalizeName(it.managerQuery);
    if (!key || state.resolved[key]) continue;
    const cands = await resolveManagerByName(it.managerQuery);
    const exacts = cands.filter((c) => c.kind === "exact");
    const givens = cands.filter((c) => c.kind === "given");
    let picked: { id: string; display_name: string } | null = null;
    if (exacts.length === 1) picked = exacts[0];
    else if (cands.length === 1) picked = cands[0];
    else if (exacts.length === 0 && givens.length === 1) picked = givens[0];
    if (picked) { state.resolved[key] = { userId: picked.id, displayName: picked.display_name }; continue; }
    if (cands.length === 0) { state.resolved[key] = { createName: it.managerQuery }; continue; }
    // 애매(여러 후보) → 되물음
    state.pending = { query: it.managerQuery, candidates: cands.map((c) => ({ id: c.id, display_name: c.display_name })) };
    state.stage = "pickManager";
    await saveSession(sb, convId, state);
    return askManagerText(it.managerQuery, state.pending.candidates);
  }
  // 전부 해석됨 → 매핑 확인 (동작 4: 적용 전 리스트업 확인)
  state.pending = undefined;
  state.stage = "confirmMapping";
  await saveSession(sb, convId, state);
  return `행사 "${state.eventName}"에 아래처럼 담당을 배정할게요.\n\n${mappingText(state)}\n\n이대로 배정할까요? (네 / 아니오)`;
}

async function startAssignFlow(sb: SupabaseClient, convId: string, message: string, sheets: Sheet[], media: MediaPart[]): Promise<string> {
  // 참가자–담당 쌍 구성: 파일 우선, 없으면 메시지 파싱
  const fileAtt: Attendee[] = [];
  for (const s of sheets) if (Array.isArray(s.rows) && Array.isArray(s.headers)) fileAtt.push(...mapSheetRows(s.rows, s.headers));
  if (media.length) fileAtt.push(...(await extractFromMedia(media)));
  const parsed = await parseAssignRequest(message);

  let items: { attendeeName: string; managerQuery: string }[];
  if (fileAtt.length) {
    items = dedupeAttendees(fileAtt)
      .map((a) => ({ attendeeName: a.name, managerQuery: (a.manager || parsed.managerForAll || "").trim() }))
      .filter((it) => it.attendeeName && it.managerQuery);
  } else {
    items = parsed.attendees
      .map((a) => ({ attendeeName: a.name, managerQuery: (a.manager || parsed.managerForAll || "").trim() }))
      .filter((it) => it.attendeeName && it.managerQuery);
  }
  if (!items.length) {
    return "누구를 누구 담당으로 넣을지 이해하지 못했어요. 예: \"이맛저맛에 강소은을 경석 담당으로 넣어줘\" 또는 담당 열이 있는 명단 파일을 올려주세요.";
  }

  const cands = await findEvents(sb, parsed.eventQuery);
  if (parsed.eventQuery && cands.length === 0) {
    return `"${parsed.eventQuery}" 행사를 찾지 못했어요. 행사명을 다시 알려주세요.`;
  }
  const state: AssignState = { mode: "assign", stage: "pickEvent", eventId: null, eventName: null, eventCandidates: cands, items, resolved: {} };
  await saveSession(sb, convId, state);
  if (cands.length === 0) return "어느 행사에 넣을까요? 행사명을 알려주세요.";
  if (cands.length === 1) return `"${cands[0].name}" 행사에 담당을 배정하려는 게 맞나요? (네 / 아니오)`;
  return `여러 행사가 있어요. 어느 행사인가요?\n${cands.map((c, i) => `${i + 1}. ${c.name}`).join("\n")}\n번호나 이름으로 알려주세요.`;
}

async function applyAssignments(sb: SupabaseClient, convId: string, state: AssignState): Promise<string> {
  if (!state.eventId) { await clearSession(sb, convId); return "행사를 확정하지 못했어요. 다시 시도해주세요."; }
  // createName(신규 미가입 관리자) placeholder 생성
  for (const key of Object.keys(state.resolved)) {
    const r = state.resolved[key];
    if (r.createName && !r.userId) {
      const created = await createPlaceholderManager(r.createName);
      if (created) { r.userId = created.id; r.displayName = created.display_name; }
    }
  }
  const { data: atts } = await sb.from("event_attendees").select("id, name").eq("event_id", state.eventId);
  const idQueue = new Map<string, string[]>();
  for (const a of (atts || []) as { id: string; name: string }[]) {
    const k = normalizeName(a.name);
    const q = idQueue.get(k) || []; q.push(a.id); idQueue.set(k, q);
  }
  const done: { name: string; manager: string }[] = [];
  const notFound: string[] = [];
  const memberAdded = new Set<string>();
  for (const it of state.items) {
    const r = state.resolved[normalizeName(it.managerQuery)];
    if (!r?.userId) continue;
    const id = idQueue.get(normalizeName(it.attendeeName))?.shift();
    if (!id) { notFound.push(it.attendeeName); continue; }
    if (!memberAdded.has(r.userId)) { await ensureEventMember(state.eventId, r.userId); memberAdded.add(r.userId); }
    await sb.from("event_attendees").update({ manager_id: r.userId }).eq("id", id);
    done.push({ name: it.attendeeName, manager: r.displayName || it.managerQuery });
  }
  await clearSession(sb, convId);
  let msg = `"${state.eventName}"에 담당 ${done.length}명 배정 완료.`;
  if (done.length) msg += `\n\n${managerTable(done)}`;
  if (notFound.length) msg += `\n\n⚠️ 이 행사 명단에서 못 찾은 참가자: ${notFound.join(", ")} (이름이 정확한지 확인해주세요)`;
  return msg;
}

async function handleAssignReply(sb: SupabaseClient, convId: string, state: AssignState, message: string): Promise<string> {
  if (isCancel(message)) { await clearSession(sb, convId); return "담당 배정을 취소했어요."; }

  if (state.stage === "pickEvent") {
    let chosen: { id: string; name: string } | null = null;
    const numMatch = message.match(/\d+/);
    if (state.eventCandidates.length === 1 && isYes(message)) chosen = state.eventCandidates[0];
    else if (numMatch) {
      const idx = parseInt(numMatch[0]) - 1;
      if (idx >= 0 && idx < state.eventCandidates.length) chosen = state.eventCandidates[idx];
    }
    if (!chosen) {
      const nk = normalizeName(message);
      chosen = state.eventCandidates.find((c) => normalizeName(c.name) === nk) ||
        (nk.length >= 2 ? state.eventCandidates.find((c) => normalizeName(c.name).includes(nk)) : undefined) || null;
    }
    if (!chosen) {
      // 새 행사 질의로 재검색 (아니오/다른 이름)
      const q = message.replace(/아니(오|요)?|아뇨|행사|이야|이에요|맞아|말고/g, "").trim();
      const re = await findEvents(sb, q || message);
      if (re.length === 0) return "그 행사를 못 찾았어요. 행사명을 다시 정확히 알려주세요. (취소하려면 \"취소\")";
      state.eventCandidates = re;
      await saveSession(sb, convId, state);
      if (re.length === 1) return `"${re[0].name}" 행사가 맞나요? (네 / 아니오)`;
      return `여러 행사가 있어요.\n${re.map((c, i) => `${i + 1}. ${c.name}`).join("\n")}\n번호나 이름으로 알려주세요.`;
    }
    state.eventId = chosen.id;
    state.eventName = chosen.name;
    return await advanceManagerResolution(sb, convId, state);
  }

  if (state.stage === "pickManager") {
    const pend = state.pending;
    if (!pend) return await advanceManagerResolution(sb, convId, state);
    const key = normalizeName(pend.query);
    if (/새로|만들|없어|없음|생성/.test(message)) {
      state.resolved[key] = { createName: pend.query };
    } else {
      let picked: { id: string; display_name: string } | null = null;
      const numMatch = message.match(/\d+/);
      if (numMatch) { const idx = parseInt(numMatch[0]) - 1; if (idx >= 0 && idx < pend.candidates.length) picked = pend.candidates[idx]; }
      if (!picked) { const nk = normalizeName(message); picked = pend.candidates.find((c) => normalizeName(c.display_name) === nk) || null; }
      if (!picked && isYes(message) && pend.candidates.length === 1) picked = pend.candidates[0];
      if (!picked) return askManagerText(pend.query, pend.candidates);
      state.resolved[key] = { userId: picked.id, displayName: picked.display_name };
    }
    state.pending = undefined;
    return await advanceManagerResolution(sb, convId, state);
  }

  // confirmMapping
  if (isYes(message)) return await applyAssignments(sb, convId, state);
  if (isNo(message)) { await clearSession(sb, convId); return "배정을 취소했어요. 다시 시작하려면 말씀해주세요."; }
  return `배정할까요? "네" 또는 "아니오"로 답해주세요.\n\n${mappingText(state)}`;
}

/** 명단 워크플로 처리. 이 메시지가 명단 상호작용이면 답변 텍스트를, 아니면 null(일반 채팅으로) 반환. */
export async function runRosterFlow(
  sb: SupabaseClient, convId: string, cnuUserId: string,
  message: string, sheets: Sheet[], media: MediaPart[], lookupIntent: boolean, assignIntent = false,
): Promise<string | null> {
  const hasFiles = sheets.length > 0 || media.length > 0;
  const session = await getSession(sb, convId);

  // 진행 중 배정 세션 → 배정 응답 처리 (새 파일+명단검토를 새로 시작하는 경우는 제외)
  if (session?.mode === "assign" && !(hasFiles && lookupIntent && !assignIntent)) {
    return handleAssignReply(sb, convId, session, message);
  }

  // 새 담당 배정 시작 (배정 의도 + 진행 중 create 세션 없음)
  if (assignIntent && (!session || session.mode === "assign")) {
    return startAssignFlow(sb, convId, message, sheets, media);
  }

  // 1) 새 파일 업로드 (+명단/조회 의도) → 검토 시작
  if (hasFiles && lookupIntent) {
    const attendees: Attendee[] = [];
    for (const s of sheets) if (Array.isArray(s.rows) && Array.isArray(s.headers)) attendees.push(...mapSheetRows(s.rows, s.headers));
    if (media.length) attendees.push(...(await extractFromMedia(media)));
    const list = dedupeAttendees(attendees);
    if (!list.length) return "명단에서 이름을 찾지 못했어요. 파일이 명단이 맞는지 확인해주세요.";
    const { suspects } = await lookupNamesForDuplicates(list.map((a) => a.name));
    const state: CreateState = { stage: "review", eventName: null, attendees: list, dup: suspects, excluded: [] };
    await saveSession(sb, convId, state);
    return reviewText(list, suspects, []);
  }

  // 2) 진행 중 create 세션이 있으면 사용자 응답 처리
  if (!session || session.mode === "assign") return null;

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
    const res = await createEvent(sb, cnuUserId, eventName!, finalList);
    await clearSession(sb, convId);
    if (!res) return "행사 생성에 실패했어요. 잠시 후 다시 시도해주세요.";
    const { assigned, memberAddedCount } = res;
    const unassigned = finalList.length - assigned.length;
    let msg = `행사 "${eventName}"를 만들었어요. 참석자 ${finalList.length}명 등록 완료.`;
    if (memberAddedCount > 0) msg += ` 관리자 ${memberAddedCount}명은 섭리회원으로 추가했어요.`;
    if (assigned.length) msg += `\n\n관리자 배정 ${assigned.length}명:\n${managerTable(assigned)}`;
    if (assigned.length && unassigned > 0) msg += `\n\n나머지 ${unassigned}명은 관리자 미배정이에요 (파일에 관리자 정보가 없거나 못 찾음).`;
    msg += `\n\n${rosterTable(finalList, [], session.dup)}`;
    return msg;
  }

  // 상태 갱신 + 다음 안내 (이름이 있으면 confirm 단계로 올려 '등록할까요?' 질문)
  const nextStage: CreateState["stage"] = eventName ? "confirm" : "review";
  await saveSession(sb, convId, { ...session, excluded, eventName, stage: nextStage });
  const table = rosterTable(session.attendees, excluded, session.dup);
  if (!eventName) return `${table}\n\n현재 ${finalList.length}명이에요. 등록할 행사명을 알려주세요. (더 뺄 사람 있으면 이름이나 번호로)`;
  return `${table}\n\n이 명단(${finalList.length}명)으로 "${eventName}" 행사를 등록할까요?\n등록하려면 "등록", 더 뺄 사람은 이름·번호로, 그만두려면 "취소"라고 해주세요.`;
}
