// 명단 파일에서 참석자 추출 (서버 공용). 엑셀 rows → 컬럼 매칭, 이미지/PDF → Gemini 비전.
// 기본 항목(이름·성별·학과·학년·연락처·학교·친구·메모)에 매칭하고, 없는 컬럼은 custom(항목 생성)으로 보존.
import { GoogleGenerativeAI } from "@google/generative-ai";
import { tryClaude } from "./claudeBridge";

export type Attendee = {
  name: string;
  gender?: string; department?: string; year?: number | null;
  phone?: string; school?: string; friendGroup?: string; memo?: string;
  manager?: string; // 담당(관리자) 이름 — 파일에 적혀 있으면 추출. 나중에 실제 유저로 resolve해 manager_id로 저장
  custom?: Record<string, string>; // 기본 항목에 없는 값 (그대로 custom_data 로 저장)
};
export type MediaPart = { mime: string; data: string }; // 이미지 또는 application/pdf

// 기본 항목 매칭 후보 (헤더 소문자 부분일치)
const FIELD_GUESS: Record<string, string[]> = {
  name: ["이름", "성명", "name", "학생명"],
  phone: ["전화", "연락처", "핸드폰", "휴대폰", "phone", "번호", "hp"],
  gender: ["성별", "gender", "성"],
  department: ["학과", "전공", "학부", "department", "major"],
  year: ["학년", "학번", "year", "grade"],
  school: ["학교", "대학", "school", "univ"],
  friendGroup: ["친구", "함께", "동반", "friend", "지인"],
  manager: ["담당", "담당자", "관리자", "섭리", "멘토", "manager", "인도자"],
  memo: ["메모", "비고", "특이", "memo", "note", "기타"],
};

function matchField(header: string): string | null {
  const low = String(header).toLowerCase().replace(/\s+/g, "");
  for (const [field, gs] of Object.entries(FIELD_GUESS)) {
    if (gs.some((g) => low.includes(g))) return field;
  }
  return null;
}

// 이름에 붙은 괄호/대괄호 내용을 메모로 분리한다 — 이름으로 조회를 많이 하므로 이름은 순수하게 둔다.
// "곽소영(박수훈 연결)" → { name: "곽소영", note: "박수훈 연결" }
export function splitNameNote(raw: unknown): { name: string; note: string } {
  const s = String(raw ?? "").trim();
  if (!s) return { name: "", note: "" };
  const m = s.match(/^([^(（【\[{]+?)\s*[(（【\[{](.*)$/);
  if (m && m[1].trim()) {
    const note = m[2].replace(/[)）】\]}]/g, " ").replace(/\s+/g, " ").trim();
    return { name: m[1].trim(), note };
  }
  return { name: s, note: "" };
}

export function mapSheetRows(rows: Record<string, string>[], headers: string[]): Attendee[] {
  const map: Record<string, string | null> = {};
  const nameHeaderFallback = headers[0];
  for (const h of headers) map[h] = matchField(h);
  // 이름 컬럼이 하나도 없으면 첫 컬럼을 이름으로
  if (!Object.values(map).includes("name") && nameHeaderFallback) map[nameHeaderFallback] = "name";

  const out: Attendee[] = [];
  for (const r of rows) {
    const a: Attendee = { name: "", custom: {} };
    for (const h of headers) {
      const v = String(r[h] ?? "").trim();
      if (!v) continue;
      const field = map[h];
      if (field === "year") { const n = parseInt(v); a.year = Number.isFinite(n) ? n : null; }
      else if (field) (a as any)[field] = v;
      else a.custom![h] = v; // 기본 항목에 없는 건 항목 생성
    }
    // 이름 옆 괄호/기호는 메모로 분리
    const { name, note } = splitNameNote(a.name);
    a.name = name;
    if (note) a.memo = a.memo ? `${a.memo} · ${note}` : note;
    if (a.custom && Object.keys(a.custom).length === 0) delete a.custom;
    if (a.name) out.push(a);
  }
  return out;
}

const MEDIA_PROMPT = `이 파일(이미지 또는 PDF)은 사람 명단이다. 각 사람 정보를 JSON 배열로만 답하라.
형식: [{"name":"이름","phone":"전화","gender":"남/여","department":"학과","year":학년숫자,"school":"학교","friendGroup":"함께신청","manager":"담당자이름","memo":"비고","extra":{"그외항목명":"값"}}]
manager는 이 사람의 담당자(관리자/섭리/멘토/인도자) 이름이 열에 있으면 넣어라. 참가자 본인 이름과 헷갈리지 마라.
이름은 반드시 포함. 표에 있는 열 중 위 기본 항목에 해당하지 않는 것은 extra 객체에 "열이름":"값" 으로 넣어라.
없는 값은 생략. 설명·마크다운 없이 JSON 배열만 출력.
글자가 흐릿해도 표의 행/열 정렬을 유지해 한 사람의 값이 옆줄로 섞이지 않게 정확히 읽어라.`;

function parseAttendeeJson(txt: string): Attendee[] {
  const m = txt.match(/\[[\s\S]*\]/);
  if (!m) return [];
  let arr: any[];
  try { arr = JSON.parse(m[0]); } catch { return []; }
  return arr.filter((x) => x && String(x.name || "").trim()).map((x) => {
    const { name, note } = splitNameNote(x.name); // 이름 옆 괄호/기호 → 메모
    const a: Attendee = { name };
    if (x.phone) a.phone = String(x.phone).trim();
    if (x.gender) a.gender = String(x.gender).trim();
    if (x.department) a.department = String(x.department).trim();
    if (x.school) a.school = String(x.school).trim();
    if (x.friendGroup) a.friendGroup = String(x.friendGroup).trim();
    if (x.manager) a.manager = String(x.manager).trim();
    if (x.memo) a.memo = String(x.memo).trim();
    if (note) a.memo = a.memo ? `${a.memo} · ${note}` : note;
    if (x.year != null && Number.isFinite(Number(x.year))) a.year = Number(x.year);
    if (x.extra && typeof x.extra === "object") {
      const custom: Record<string, string> = {};
      for (const [k, v] of Object.entries(x.extra)) { const s = String(v ?? "").trim(); if (s) custom[k] = s; }
      if (Object.keys(custom).length) a.custom = custom;
    }
    return a;
  });
}

// 이미지 한 장을 Gemini 비전으로 추출 (키 로테이션)
async function extractOneMedia(m: MediaPart, keys: string[]): Promise<Attendee[]> {
  for (const key of keys) {
    try {
      const ai = new GoogleGenerativeAI(key);
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
      const res = await model.generateContent([{ text: MEDIA_PROMPT }, { inlineData: { mimeType: m.mime, data: m.data } }]);
      return parseAttendeeJson(res.response.text());
    } catch { continue; } // 다음 키로 재시도
  }
  return [];
}

// 이미지·PDF → 명단 추출.
// CLAUDE_VISION=1 이면 Claude 비전 우선(로컬 터널이 이미지 지원 시), 실패/빈결과면 Gemini 폴백.
// Gemini 는 한 장씩 개별 호출(정확도↑, 용량·타임아웃↓) 후 합침.
export async function extractFromMedia(media: MediaPart[]): Promise<Attendee[]> {
  if (media.length === 0) return [];

  // Claude 비전 우선 (플래그 켜진 경우에만 — 로컬 터널이 이미지를 지원해야 함)
  if (process.env.CLAUDE_VISION === "1") {
    try {
      const ans = await tryClaude(MEDIA_PROMPT, media.map((m) => ({ mime: m.mime, data: m.data })));
      if (ans) {
        const parsed = parseAttendeeJson(ans);
        if (parsed.length) return parsed; // 유효 결과면 사용, 아니면 Gemini 폴백
      }
    } catch { /* Gemini 폴백 */ }
  }

  const keys = (process.env.GEMINI_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) return [];
  const all: Attendee[] = [];
  for (const m of media) {
    all.push(...(await extractOneMedia(m, keys)));
  }
  return all;
}

export function dedupeAttendees(list: Attendee[]): Attendee[] {
  const seen = new Set<string>();
  return list.filter((a) => {
    if (!a.name) return false;
    const k = `${a.name}|${(a.phone || "").replace(/\D/g, "")}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Attendee → event_attendees 삽입 행 (기본 항목은 컬럼, 나머지는 custom_data)
export function attendeeToRow(eventId: string, a: Attendee, isMember = false): Record<string, any> {
  const row: Record<string, any> = {
    event_id: eventId, name: a.name, is_member: isMember, status: "pending",
    gender: a.gender || null, department: a.department || null,
    year: Number.isFinite(a.year as number) ? a.year : null,
    phone: a.phone || null, school: a.school || null, friend_group: a.friendGroup || null,
    memo: a.memo || null,
  };
  if (a.custom && Object.keys(a.custom).length) row.custom_data = a.custom;
  return row;
}

// 매칭 요약(어떤 열이 기본 항목/커스텀으로 갔는지) — 사용자 안내용
export function matchSummary(headers: string[]): { base: Record<string, string>; custom: string[] } {
  const base: Record<string, string> = {};
  const custom: string[] = [];
  let hasName = false;
  for (const h of headers) {
    const f = matchField(h);
    if (f) { base[h] = f; if (f === "name") hasName = true; }
    else custom.push(h);
  }
  if (!hasName && headers[0]) base[headers[0]] = "name";
  return { base, custom };
}
