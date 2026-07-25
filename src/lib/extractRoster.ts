// 명단 파일에서 참석자 추출 (서버 공용). 엑셀 rows → 컬럼 매칭, 이미지/PDF → Gemini 비전.
// 기본 항목(이름·성별·학과·학년·연락처·학교·친구·메모)에 매칭하고, 없는 컬럼은 custom(항목 생성)으로 보존.
import { GoogleGenerativeAI } from "@google/generative-ai";

export type Attendee = {
  name: string;
  gender?: string; department?: string; year?: number | null;
  phone?: string; school?: string; friendGroup?: string; memo?: string;
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
  memo: ["메모", "비고", "특이", "memo", "note", "기타"],
};

function matchField(header: string): string | null {
  const low = String(header).toLowerCase().replace(/\s+/g, "");
  for (const [field, gs] of Object.entries(FIELD_GUESS)) {
    if (gs.some((g) => low.includes(g))) return field;
  }
  return null;
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
    if (a.custom && Object.keys(a.custom).length === 0) delete a.custom;
    if (a.name) out.push(a);
  }
  return out;
}

// 이미지·PDF → Gemini 비전으로 명단 추출 (기본 항목 + 기타는 extra 로)
export async function extractFromMedia(media: MediaPart[]): Promise<Attendee[]> {
  const keys = (process.env.GEMINI_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0 || media.length === 0) return [];
  const prompt = `이 파일(이미지 또는 PDF)은 사람 명단이다. 각 사람 정보를 JSON 배열로만 답하라.
형식: [{"name":"이름","phone":"전화","gender":"남/여","department":"학과","year":학년숫자,"school":"학교","friendGroup":"함께신청","memo":"비고","extra":{"그외항목명":"값"}}]
이름은 반드시 포함. 표에 있는 열 중 위 기본 항목에 해당하지 않는 것은 extra 객체에 "열이름":"값" 으로 넣어라.
없는 값은 생략. 설명·마크다운 없이 JSON 배열만 출력.`;
  for (const key of keys) {
    try {
      const ai = new GoogleGenerativeAI(key);
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
      const parts: any[] = [{ text: prompt }];
      for (const m of media) parts.push({ inlineData: { mimeType: m.mime, data: m.data } });
      const res = await model.generateContent(parts);
      const txt = res.response.text();
      const m = txt.match(/\[[\s\S]*\]/);
      if (!m) continue;
      const arr = JSON.parse(m[0]) as any[];
      return arr.filter((x) => x && String(x.name || "").trim()).map((x) => {
        const a: Attendee = { name: String(x.name).trim() };
        if (x.phone) a.phone = String(x.phone).trim();
        if (x.gender) a.gender = String(x.gender).trim();
        if (x.department) a.department = String(x.department).trim();
        if (x.school) a.school = String(x.school).trim();
        if (x.friendGroup) a.friendGroup = String(x.friendGroup).trim();
        if (x.memo) a.memo = String(x.memo).trim();
        if (x.year != null && Number.isFinite(Number(x.year))) a.year = Number(x.year);
        if (x.extra && typeof x.extra === "object") {
          const custom: Record<string, string> = {};
          for (const [k, v] of Object.entries(x.extra)) { const s = String(v ?? "").trim(); if (s) custom[k] = s; }
          if (Object.keys(custom).length) a.custom = custom;
        }
        return a;
      });
    } catch { continue; }
  }
  return [];
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
