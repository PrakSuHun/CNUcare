// 채팅 교차조회(명단분석 이식): 사용자가 채팅에 올린 이름/명단을 CNU Care 행사·생명 +
// 프로젠(별도 Supabase, progen-lookup 함수 경유)과 대조해 "중복 참여/생명 여부"를 알려준다.
// 서버 전용 — service_role로 lives/event_* 를 직접 읽는다.
// (예외: 원회원 행사 중복검사 시 event_attendees.memo 를 겹친 행사명으로 덮어쓴다)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

// ── 정규화 ──────────────────────────────────────────────
export function normalizeName(input: unknown): string {
  if (input == null) return "";
  return String(input).replace(/\s+/g, "").trim().toLowerCase();
}
export function normalizePhone(input: unknown): string {
  if (input == null) return "";
  let d = String(input).replace(/[^\d]/g, "");
  if (d.startsWith("82")) { const r = d.slice(2); d = r.startsWith("0") ? r : "0" + r; }
  return d;
}
export function isUsablePhone(p: string): boolean {
  return p.length >= 9;
}

let supa: SupabaseClient | null = null;
function db() {
  if (!supa) {
    supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    );
  }
  return supa;
}

// ── CNU Care 인덱스 ─────────────────────────────────────
interface AttendeeRec {
  eventId: string; eventName: string; name: string; nameKey: string; phoneKey: string;
  isMember: boolean; team: string | null; status: string | null;
  managerId: string | null; lifeId: string | null;
}
// 팀 문자열 정규화 (공백 제거)
const normTeam = (t: string | null | undefined) => String(t ?? "").replace(/\s+/g, "");
interface LifeRec { name: string; managerId: string | null; }
interface CnuIndex {
  attendees: AttendeeRec[];
  managersByEvent: Map<string, string[]>;
  userName: Map<string, string>;
  userNames: Set<string>;
  managerGiven: Map<string, string[]>;
  usersList: { id: string; display_name: string }[]; // 담당 이름 해석용 전체 유저
  livesByPhone: Map<string, LifeRec>;
  livesByName: Map<string, LifeRec>;
}

let cache: CnuIndex | null = null;
let cacheAt = 0;
const TTL = 5 * 60 * 1000; // 5분 캐시 (서버리스에서 인스턴스 재사용 시)

async function loadIndex(): Promise<CnuIndex> {
  if (cache && Date.now() - cacheAt < TTL) return cache;
  const s = db();
  const [ea, em, us, lv] = await Promise.all([
    s.from("event_attendees").select("name,phone,is_member,team,status,manager_id,life_id,event_id,events(name)"),
    s.from("event_members").select("event_id, users(display_name, role)"),
    s.from("users").select("id, display_name"),
    s.from("lives").select("name, phone, primary_user_id"),
  ]);
  if (ea.error) throw new Error(`행사 참석자 조회 실패: ${ea.error.message}`);

  const userName = new Map<string, string>();
  const userNames = new Set<string>();
  const managerGiven = new Map<string, string[]>();
  const usersList = ((us.data ?? []) as { id: string; display_name: string }[]).filter((u) => u.display_name);
  for (const u of (us.data ?? []) as { id: string; display_name: string }[]) {
    userName.set(u.id, u.display_name);
    if (u.display_name) {
      const nk = normalizeName(u.display_name);
      userNames.add(nk);
      if (nk.length >= 3) {
        const given = nk.slice(1); // 성 제외 (이름만 부르는 관례)
        const l = managerGiven.get(given) ?? [];
        if (!l.includes(u.display_name)) l.push(u.display_name);
        managerGiven.set(given, l);
      }
    }
  }

  const managersByEvent = new Map<string, string[]>();
  for (const m of (em.data ?? []) as Record<string, unknown>[]) {
    const raw = m.users;
    const u = (Array.isArray(raw) ? raw[0] : raw) as { display_name?: string; role?: string } | null | undefined;
    if (!u) continue;
    const eid = String(m.event_id ?? "");
    const list = managersByEvent.get(eid) ?? [];
    list.push(`${u.display_name}(${u.role})`);
    managersByEvent.set(eid, list);
  }

  const attendees: AttendeeRec[] = ((ea.data ?? []) as Record<string, unknown>[]).map((r) => ({
    eventId: String(r.event_id ?? ""),
    eventName: String((r.events as { name?: string } | null)?.name ?? "행사"),
    name: String(r.name ?? ""),
    nameKey: normalizeName(r.name),
    phoneKey: normalizePhone(r.phone),
    isMember: Boolean(r.is_member),
    team: (r.team as string) || null,
    status: (r.status as string) || null,
    managerId: (r.manager_id as string) || null,
    lifeId: (r.life_id as string) || null,
  }));

  const livesByPhone = new Map<string, LifeRec>();
  const livesByName = new Map<string, LifeRec>();
  for (const p of (lv.data ?? []) as Record<string, unknown>[]) {
    const rec: LifeRec = { name: String(p.name ?? ""), managerId: (p.primary_user_id as string) || null };
    const pk = normalizePhone(p.phone);
    const nk = normalizeName(p.name);
    if (isUsablePhone(pk)) livesByPhone.set(pk, rec);
    if (nk) livesByName.set(nk, rec);
  }

  cache = { attendees, managersByEvent, userName, userNames, managerGiven, usersList, livesByPhone, livesByName };
  cacheAt = Date.now();
  return cache;
}

export function clearLookupCache() {
  cache = null; progenIdx = null; progenTried = false; progenAt = 0;
}

// ── 담당(관리자) 이름 해석 ────────────────────────────────
export type ManagerCandidate = { id: string; display_name: string; kind: "exact" | "given" | "partial" };

/** 담당자 이름(부정확 가능, 예 "경석")을 CNU 유저와 매칭. 완전일치→성 제외 일치→부분일치 순. */
export async function resolveManagerByName(query: string): Promise<ManagerCandidate[]> {
  const q = normalizeName(query);
  if (!q) return [];
  const idx = await loadIndex();
  const seen = new Set<string>();
  const out: ManagerCandidate[] = [];
  const push = (id: string, display_name: string, kind: ManagerCandidate["kind"]) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, display_name, kind });
  };
  // 1) 완전일치
  for (const u of idx.usersList) if (normalizeName(u.display_name) === q) push(u.id, u.display_name, "exact");
  // 2) 성 제외 일치 ("경석" → "고경석")
  for (const u of idx.usersList) {
    const nk = normalizeName(u.display_name);
    if (nk.length >= 2 && nk.slice(1) === q) push(u.id, u.display_name, "given");
  }
  // 3) 부분일치 (2글자 이상 질의에서만)
  if (q.length >= 2) for (const u of idx.usersList) {
    if (normalizeName(u.display_name).includes(q)) push(u.id, u.display_name, "partial");
  }
  return out;
}

/** 씨엔유 케어에 없는 담당자 → 이름만으로 미가입 관리자(placeholder) 생성. (EventDetail 규약과 동일) */
export async function createPlaceholderManager(name: string): Promise<{ id: string; display_name: string } | null> {
  const nm = String(name || "").trim();
  if (!nm) return null;
  const loginId = `mgr_${randomBytes(6).toString("hex")}`;
  const { data, error } = await db()
    .from("users")
    .insert({ login_id: loginId, password: loginId, name: nm, display_name: nm, birth_date: "2000-01-01", phone: "", role: "student", is_placeholder: true })
    .select("id, display_name")
    .single();
  if (error || !data) return null;
  clearLookupCache(); // 새 유저가 이후 resolve에 잡히도록
  return data as { id: string; display_name: string };
}

/** 행사 담당자 목록(event_members)에 없으면 추가. */
export async function ensureEventMember(eventId: string, userId: string): Promise<void> {
  const s = db();
  const { data } = await s.from("event_members").select("id").eq("event_id", eventId).eq("user_id", userId).limit(1);
  if (!data || data.length === 0) {
    await s.from("event_members").insert({ event_id: eventId, user_id: userId });
  }
}

// ── 프로젠 (읽기 전용, progen-lookup 함수 경유) ───────────
interface ProgenRow {
  name: string; phone: string; kind: string; role: string | null;
  event: string; event_date: string | null; team: string | null;
  status: string | null; registered_at: string | null;
}
interface ProgenIndex {
  byPhone: Map<string, ProgenRow[]>;
  byName: Map<string, ProgenRow[]>;
  podoByEventTeam: Map<string, string[]>; // key: `${event}||${normTeam(team)}` — 팀 단위 포도
}
let progenIdx: ProgenIndex | null = null;
let progenTried = false;
let progenAt = 0;

async function loadProgen(): Promise<ProgenIndex | null> {
  if (progenIdx && Date.now() - progenAt < TTL) return progenIdx;
  if (progenTried && Date.now() - progenAt < TTL) return progenIdx;
  progenTried = true; progenAt = Date.now();
  try {
    const { data, error } = await db().functions.invoke("progen-lookup", { body: {} });
    if (error || data?.error || !Array.isArray(data?.rows)) return null;
    const byPhone = new Map<string, ProgenRow[]>();
    const byName = new Map<string, ProgenRow[]>();
    const podoByEventTeam = new Map<string, string[]>();
    for (const r of data.rows as ProgenRow[]) {
      const pk = normalizePhone(r.phone);
      const nk = normalizeName(r.name);
      if (isUsablePhone(pk)) (byPhone.get(pk) ?? byPhone.set(pk, []).get(pk)!).push(r);
      if (nk) (byName.get(nk) ?? byName.set(nk, []).get(nk)!).push(r);
      if (r.kind === "포도" && r.event) {
        const key = `${r.event}||${normTeam(r.team)}`; // 같은 팀 포도만 묶는다
        const l = podoByEventTeam.get(key) ?? [];
        if (r.name && !l.includes(r.name)) l.push(r.name);
        podoByEventTeam.set(key, l);
      }
    }
    progenIdx = { byPhone, byName, podoByEventTeam };
    return progenIdx;
  } catch {
    return null;
  }
}

// ── 결과 포맷 ───────────────────────────────────────────
interface EventHit {
  eventName: string; how: string; team: string | null; status: string | null;
  manager: string | null;   // 이 사람에게 직접 배정된 담당 관리자(manager_id)
  teamPodo: string[];       // 같은 팀에 배치된 섭리회원(포도) — 다른 팀은 포함하지 않음
}

// CNU 행사에서 같은 팀에 배치된 섭리회원(포도) 이름 목록. 팀이 없으면 빈 배열(=미배정).
function cnuTeamPodo(idx: CnuIndex, eventId: string, team: string | null, selfNameKey: string): string[] {
  const t = normTeam(team);
  if (!t) return [];
  const out: string[] = [];
  for (const a of idx.attendees) {
    if (a.eventId !== eventId || !a.isMember) continue;
    if (normTeam(a.team) !== t || a.nameKey === selfNameKey) continue;
    if (a.name && !out.includes(a.name)) out.push(a.name);
  }
  return out;
}
// 프로젠 행사에서 같은 팀 포도 목록. 팀이 없으면 빈 배열(=미배정).
function progenTeamPodo(pg: ProgenIndex | null, event: string, team: string | null): string[] {
  const t = normTeam(team);
  if (!pg || !t) return [];
  return pg.podoByEventTeam.get(`${event}||${t}`) ?? [];
}
interface PersonHit {
  name: string; phone: string; life: LifeRec | null;
  events: EventHit[]; progen: ProgenRow[];
}
const fmtDate = (s: string | null) => (s ? String(s).slice(0, 10) : "");
const capList = (n: string[], cap = 15) =>
  n.length > cap ? `${n.slice(0, cap).join(", ")} 외 ${n.length - cap}명` : n.join(", ");

function hitLines(h: PersonHit, idx: CnuIndex, pg: ProgenIndex | null): string[] {
  const lines: string[] = [];
  lines.push(`● ${h.name} (${h.phone || "전화없음"})`);
  if (h.life) {
    const mgr = h.life.managerId ? idx.userName.get(h.life.managerId) : null;
    lines.push(`   ⭐ [생명] 우리 생명 명단에 있음 — 이미 말씀 듣는 중${mgr ? ` (담당 전도자: ${mgr})` : ""}`);
  }
  for (const e of h.events) {
    lines.push(`   - [CNU 행사] "${e.eventName}" ${e.how}${e.team ? ` · 팀 ${e.team}` : " · 팀 미배정"}${e.status ? ` · ${e.status}` : ""}`);
    // 관리자는 팀 기준으로만. 다른 팀 사람은 절대 안 붙인다.
    if (e.manager) lines.push(`       담당 관리자(직접 배정): ${e.manager}`);
    else if (e.teamPodo.length) lines.push(`       같은 팀 포도: ${capList(e.teamPodo)}`);
    else lines.push(`       ⚠️ 이 행사에선 관리자 미배정 — 아무도 안 붙음 (다른 팀 관리자를 끌어오지 말 것)`);
  }
  const seenEv = new Set<string>();
  for (const r of h.progen) {
    if (seenEv.has(r.event)) continue;
    seenEv.add(r.event);
    lines.push(`   - [프로젠] "${r.event}" ${r.kind}${r.team ? ` · 팀 ${r.team}` : " · 팀 미배정"}${r.status ? ` · ${r.status}` : ""}${r.event_date ? ` (${fmtDate(r.event_date)})` : ""}`);
    if (r.kind !== "포도") {
      const teamPodo = progenTeamPodo(pg, r.event, r.team);
      if (teamPodo.length) lines.push(`       같은 팀 포도: ${capList(teamPodo)}`);
      else lines.push(`       ⚠️ ${normTeam(r.team) ? `팀 ${r.team}에 포도 기록 없음` : "팀 미배정"} — 이 행사에선 관리자 안 붙음 (다른 팀 포도를 끌어오지 말 것)`);
    }
  }
  if (h.events.length === 0 && h.progen.length === 0 && h.life)
    lines.push("   - 행사 참여 기록은 없음 (생명 명단에만 존재)");
  return lines;
}

// ── 팀 명단 채팅 형식 파서 ──────────────────────────────
interface RosterLine { name: string; managers: string[]; meta: string[]; school: string | null; }

export function parseRosterText(message: string): RosterLine[] | null {
  const lines = message.split(/\n+/);
  let curSchool: string | null = null;
  const out: RosterLine[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const sm = line.match(/^[ㆍ·•\-]\s*([가-힣]+대)\s*\d*/);
    if (sm) { curSchool = sm[1]; continue; }
    const m = line.match(/^([가-힣]{2,4})\s*\(([^)]*)\)\s*(.*)$/);
    if (!m) continue;
    const [namesPart, role] = m[2].split("/");
    const managers = (namesPart ?? "").split(/[,、\s]+/).map((x) => x.trim()).filter(Boolean);
    const meta: string[] = [];
    if (role?.trim()) meta.push(role.trim());
    if (m[3]?.trim()) meta.push(m[3].trim());
    out.push({ name: m[1], managers, meta, school: curSchool });
  }
  return out.length >= 2 ? out : null;
}

/** 채팅 텍스트 조회: 팀 명단 형식이면 구조 해석, 아니면 이름 토큰 조회. 겹치는 게 없으면 null. */
export async function personLookupContext(message: string): Promise<string | null> {
  const roster = parseRosterText(message);
  if (roster) return rosterTextContext(roster);
  return tokenLookupContext(message);
}

async function rosterTextContext(roster: RosterLine[]): Promise<string> {
  const [idx, pg] = await Promise.all([loadIndex(), loadProgen()]);
  const lines = [
    `[명단 교차조회 결과] 사용자가 올린 명단의 각 사람을 우리 시스템(생명·CNU 행사·프로젠)과 대조했다 (참여자 ${roster.length}명).`,
    "\"조회해줘\"의 의미: 이 사람들이 우리 행사에 중복 참여했는지 알려달라는 요청이다. 아래 데이터를 근거로,",
    "사람별로 ① 우리 생명 여부 ② CNU 행사 중복 참여 ③ 프로젠 참여 ④ 그때 노출된 관리자를 명확히 보고하라.",
    "겹침 있는 사람과 없는(신규) 사람을 뚜렷이 구분하고, 메시지 내용을 그대로 요약·반복하지 마라.",
    "형식: \"이름(담당관리자/유형)\" — 괄호 안은 우리 관리자(성 생략 표기 가능)이며 참여자가 아니다. 해석이 애매한 부분만 확인 질문하라.",
    "",
  ];
  for (const r of roster) {
    const nk = normalizeName(r.name);
    const life = idx.livesByName.get(nk) ?? null;
    const matched = idx.attendees.filter((a) => a.nameKey === nk);
    const progen = pg?.byName.get(nk) ?? [];
    const events: EventHit[] = matched.map((a) => ({
      eventName: a.eventName, how: a.isMember ? "섭리회원" : "게스트",
      team: a.team, status: a.status,
      manager: a.managerId ? idx.userName.get(a.managerId) ?? null : null,
      teamPodo: cnuTeamPodo(idx, a.eventId, a.team, a.nameKey),
    }));
    const found = life || events.length > 0 || progen.length > 0;
    if (found) lines.push(...hitLines({ name: r.name, phone: progen[0]?.phone ?? "", life, events, progen }, idx, pg));
    else lines.push(`● ${r.name} — 우리 기록(생명·CNU행사·프로젠)에 없음 (신규)`);

    const mgrLabels: string[] = [];
    const unknownMgr: string[] = [];
    for (const m of r.managers) {
      const mk = normalizeName(m);
      if (idx.userNames.has(mk)) mgrLabels.push(m);
      else {
        const full = idx.managerGiven.get(mk);
        if (full?.length) mgrLabels.push(`${m}(=${full.join("/")})`);
        else { mgrLabels.push(m); unknownMgr.push(m); }
      }
    }
    const info: string[] = [];
    if (r.school) info.push(`학교(메시지 기준): ${r.school}`);
    if (r.managers.length)
      info.push(`담당 관리자(메시지 기준): ${mgrLabels.join(", ")}${unknownMgr.length ? ` — 미확인: ${unknownMgr.join(", ")}` : ""}`);
    const meta = r.meta.filter((x) => !/조회|확인해|알아봐|찾아/.test(x));
    if (meta.length) info.push(`비고: ${meta.join(" · ")}`);
    for (const i of info) lines.push(`   ▸ ${i}`);
  }
  return lines.join("\n");
}

// ── 신청 시 중복참여 대조 (한 사람) ─────────────────────
export interface DupResult {
  hasOverlap: boolean;           // 이전에 다른 행사/프로젠 참여했거나 이미 생명
  isLife: boolean;
  lifeManager: string | null;
  otherEvents: { eventName: string; how: string; status: string | null }[]; // 이 행사 제외한 CNU 행사
  progen: { event: string; kind: string; date: string | null }[];
  isProgenPodo: boolean;         // 프로젠에서 이름+전화가 모두 일치하는 '포도'(=섭리회원) 기록이 있음
  summary: string;               // 알림 본문용 한 줄 요약
}

/** 신청자를 현재 행사를 제외한 다른 CNU 행사·프로젠·생명과 대조. (겹침/생명 판정은 이름 기준 — 명단 업로드 시 번호가 없을 수 있어 전화는 쓰지 않고, 동명이인 가능성이 있어 "의심"으로 다룬다. 단 프로젠 '포도'(=섭리회원) 판정만은 오탐 방지를 위해 이름+전화가 모두 일치할 때만 인정한다.) */
export async function lookupOnePerson(
  name: string,
  phone: string | null | undefined, // 겹침 대조엔 안 쓰고, 프로젠 포도 판정(이름+전화 동시 일치)에만 사용
  excludeEventId: string,
): Promise<DupResult> {
  const [idx, pg] = await Promise.all([loadIndex(), loadProgen()]);
  const nk = normalizeName(name);

  // 이 행사 제외, 이름으로만 매칭
  const seen = new Set<string>();
  const otherEvents: DupResult["otherEvents"] = [];
  for (const a of idx.attendees) {
    if (a.eventId === excludeEventId) continue;
    if (a.nameKey !== nk) continue;
    const key = a.eventId;
    if (seen.has(key)) continue;
    seen.add(key);
    otherEvents.push({ eventName: a.eventName, how: a.isMember ? "섭리회원" : "게스트", status: a.status });
  }

  const life = idx.livesByName.get(nk) ?? null;
  const lifeManager = life?.managerId ? idx.userName.get(life.managerId) ?? null : null;

  const progenRows = pg ? (pg.byName.get(nk) ?? []) : [];
  const progenSeen = new Set<string>();
  const progen: DupResult["progen"] = [];
  // 프로젠 '포도' 판정: 이름은 이미 byName으로 일치했고, 여기에 전화번호까지 같아야 인정(동명이인 오탐 방지).
  const myPhone = normalizePhone(phone);
  let isProgenPodo = false;
  for (const r of progenRows) {
    if (r.kind === "포도" && isUsablePhone(myPhone) && normalizePhone(r.phone) === myPhone) isProgenPodo = true;
    if (progenSeen.has(r.event)) continue;
    progenSeen.add(r.event);
    progen.push({ event: r.event, kind: r.kind, date: r.event_date ? String(r.event_date).slice(0, 10) : null });
  }

  const hasOverlap = otherEvents.length > 0 || progen.length > 0 || !!life;

  // 알림 본문용 요약
  const parts: string[] = [];
  if (life) parts.push(`이미 생명${lifeManager ? `(담당 ${lifeManager})` : ""}`);
  if (otherEvents.length) parts.push(`CNU 행사 ${otherEvents.map((e) => e.eventName).slice(0, 2).join(", ")}${otherEvents.length > 2 ? ` 외 ${otherEvents.length - 2}` : ""}`);
  if (progen.length) parts.push(`프로젠 ${progen.map((p) => `${p.event}(${p.kind})`).slice(0, 2).join(", ")}${progen.length > 2 ? ` 외 ${progen.length - 2}` : ""}`);
  const summary = parts.join(" · ");

  return { hasOverlap, isLife: !!life, lifeManager, otherEvents, progen, isProgenPodo, summary };
}

// ── 행사탭용: 이 행사 참여자 중 중복 의심자 목록 ──────────
export interface EventDupSuspect {
  attendeeId: string;
  name: string;
  summary: string;            // "빵끗 · 프로젠 템플스테이(크루)" 형태 (배너 한 줄용)
  isLife: boolean;
  lifeManager: string | null; // 생명이면 담당 전도자
  matchType: "phone" | "name"; // phone=이름+번호 일치(확정 중복) / name=이름만 일치(동명이인 의심)
  cnuEvents: { eventName: string; how: string; status: string | null }[]; // 겹친 다른 CNU 행사
  progenEvents: { event: string; kind: string; date: string | null }[];   // 프로젠 참여 이력
}

// 원회원 행사: 다른 일회성 행사에서 유입돼 월명 사이트로 가입하면 원회원이 되는 "멤버십" 행사.
// 유입이 정상 경로라 중복 배너를 띄우지 않고, 대신 '웹 가입' 메모를 겹친 행사명으로 덮어쓴다.
const WON_MEMBER_EVENT_NAME = "원회원";

/** 이 행사(eventId)의 참여자들을 이름 기준으로 다른 CNU 행사·프로젠·생명과 대조해 중복 의심자만 반환.
 *  단, 원회원 행사는 배너 대신 '웹 가입' 메모를 겹친 행사명으로 DB에 영구 덮어쓴다(행사탭 한정). */
export async function lookupEventDuplicates(
  eventId: string,
): Promise<{ suspects: EventDupSuspect[]; memoUpdates: { attendeeId: string; memo: string }[] }> {
  const s = db();
  const [idx, pg, rows, evRow] = await Promise.all([
    loadIndex(),
    loadProgen(),
    s.from("event_attendees").select("id, name, phone, is_member, memo").eq("event_id", eventId),
    s.from("events").select("name").eq("id", eventId).single(),
  ]);
  const attendees = (rows.data ?? []) as { id: string; name: string; phone: string | null; is_member: boolean; memo: string | null }[];
  const isWonMember = (evRow.data as { name?: string } | null)?.name === WON_MEMBER_EVENT_NAME;

  const out: EventDupSuspect[] = [];
  const memoUpdates: { attendeeId: string; memo: string }[] = [];
  for (const a of attendees) {
    // 원회원 행사는 섭리회원 유입자도 대조 대상. 그 외 행사는 섭리회원(관리자) 제외.
    if (!isWonMember && a.is_member) continue; // 섭리회원(관리자)은 원래 등록된 사람 — 중복 검사 대상 아님
    const nk = normalizeName(a.name);
    if (!nk) continue;
    const myPhone = normalizePhone(a.phone);
    const hasPhone = isUsablePhone(myPhone);
    // 이름이 겹친 상대 중 "번호까지 같은" 사람이 하나라도 있으면 확정 중복(phone).
    let phoneMatch = false;

    // 다른 CNU 행사 (이 행사 제외, 행사명 중복 제거 — 대표 상태 하나 유지)
    const cnuMap = new Map<string, { eventName: string; how: string; status: string | null }>();
    for (const at of idx.attendees) {
      if (at.eventId === eventId) continue;
      if (at.nameKey !== nk) continue;
      if (hasPhone && at.phoneKey === myPhone) phoneMatch = true;
      if (!cnuMap.has(at.eventName))
        cnuMap.set(at.eventName, { eventName: at.eventName, how: at.isMember ? "섭리회원" : "게스트", status: at.status });
    }
    const cnuEvents = [...cnuMap.values()];
    // 프로젠 (행사명 중복 제거)
    const progenRows = pg ? (pg.byName.get(nk) ?? []) : [];
    const pgMap = new Map<string, { event: string; kind: string; date: string | null }>();
    for (const r of progenRows) {
      if (hasPhone && normalizePhone(r.phone) === myPhone) phoneMatch = true;
      if (!r.event || pgMap.has(r.event)) continue;
      pgMap.set(r.event, { event: r.event, kind: r.kind, date: r.event_date ? String(r.event_date).slice(0, 10) : null });
    }
    const progenEvents = [...pgMap.values()];
    // 생명
    const life = idx.livesByName.get(nk) ?? null;
    const lifeManager = life?.managerId ? idx.userName.get(life.managerId) ?? null : null;
    // 같은 번호의 생명이 같은 이름이면 번호 일치
    if (hasPhone) {
      const lifeByPhone = idx.livesByPhone.get(myPhone);
      if (lifeByPhone && normalizeName(lifeByPhone.name) === nk) phoneMatch = true;
    }

    if (cnuEvents.length === 0 && progenEvents.length === 0 && !life) continue;

    // 원회원 행사: 배너 대신 '웹 가입' 메모를 겹친 CNU 행사명으로 덮어쓴다.
    // (이미 덮어쓴 건은 '웹 가입'이 없으므로 재처리되지 않아 수렴한다)
    if (isWonMember) {
      if (cnuEvents.length && (a.memo ?? "").includes("웹 가입")) {
        memoUpdates.push({ attendeeId: a.id, memo: cnuEvents.map((e) => e.eventName).join(", ") });
      }
      continue; // 원회원은 중복 배너 대상에서 제외
    }

    const parts: string[] = [];
    if (life) parts.push(`이미 생명${lifeManager ? `(담당 ${lifeManager})` : ""}`);
    if (cnuEvents.length) parts.push(`행사 ${cnuEvents.slice(0, 2).map((e) => e.eventName).join(", ")}${cnuEvents.length > 2 ? ` 외 ${cnuEvents.length - 2}` : ""}`);
    if (progenEvents.length) parts.push(`프로젠 ${progenEvents.slice(0, 2).map((e) => e.event).join(", ")}${progenEvents.length > 2 ? ` 외 ${progenEvents.length - 2}` : ""}`);

    out.push({
      attendeeId: a.id,
      name: a.name,
      summary: parts.join(" · "),
      isLife: !!life,
      lifeManager,
      matchType: phoneMatch ? "phone" : "name",
      cnuEvents,
      progenEvents,
    });
  }

  // 원회원 행사 메모 덮어쓰기 (영구 저장)
  for (const u of memoUpdates) {
    await s.from("event_attendees").update({ memo: u.memo }).eq("id", u.attendeeId);
  }

  return { suspects: out, memoUpdates };
}

// ── 이름 배열 → 중복 의심자만 "이름 + 겹친 곳" 리스트 ──────
export interface NameDup { name: string; sources: string[] } // sources = 행사명/프로젠 행사/생명 표시

/** 여러 이름을 한 번에 대조해 겹치는(중복 의심) 사람만 반환. 파일 조회("조회해줘")용. */
export async function lookupNamesForDuplicates(names: string[]): Promise<{ suspects: NameDup[]; total: number }> {
  const [idx, pg] = await Promise.all([loadIndex(), loadProgen()]);
  const suspects: NameDup[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const raw of names) {
    const name = String(raw || "").trim();
    const nk = normalizeName(name);
    if (!nk || seen.has(nk)) continue;
    seen.add(nk);
    total++;
    const sources = new Set<string>();
    const life = idx.livesByName.get(nk);
    if (life) {
      const mgr = life.managerId ? idx.userName.get(life.managerId) : null;
      sources.add(`생명${mgr ? `(담당 ${mgr})` : ""}`);
    }
    for (const a of idx.attendees) if (a.nameKey === nk) sources.add(a.eventName);
    for (const r of (pg?.byName.get(nk) ?? [])) if (r.event) sources.add(`프로젠 ${r.event}`);
    if (sources.size) suspects.push({ name, sources: [...sources] });
  }
  return { suspects, total };
}

async function tokenLookupContext(message: string): Promise<string | null> {
  const [idx, pg] = await Promise.all([loadIndex(), loadProgen()]);
  const raw = message.match(/[가-힣]{2,4}/g) ?? [];
  const PARTICLES = "을를이가은는님씨도만의와과랑";
  const cands = new Set<string>();
  for (const t of raw) {
    cands.add(t);
    if (t.length >= 3 && PARTICLES.includes(t[t.length - 1])) cands.add(t.slice(0, -1));
  }

  const hits: PersonHit[] = [];
  const managerNames: string[] = [];
  for (const name of cands) {
    const nk = normalizeName(name);
    if (idx.userNames.has(nk)) managerNames.push(name);
    const life = idx.livesByName.get(nk) ?? null;
    const matched = idx.attendees.filter((a) => a.nameKey === nk);
    const progen = pg?.byName.get(nk) ?? [];
    if (!life && matched.length === 0 && progen.length === 0) continue;
    const events: EventHit[] = matched.map((a) => ({
      eventName: a.eventName, how: a.isMember ? "섭리회원" : "게스트",
      team: a.team, status: a.status,
      manager: a.managerId ? idx.userName.get(a.managerId) ?? null : null,
      teamPodo: cnuTeamPodo(idx, a.eventId, a.team, a.nameKey),
    }));
    hits.push({ name, phone: progen[0]?.phone ?? "", life, events, progen });
  }

  const wantsLookup = /조회|찾아|검색|알아|있어|있는|왔|겹치|중복/.test(message);
  if (hits.length === 0 && managerNames.length === 0) {
    if (!wantsLookup) return null;
    return "[인물 조회] 질문에 언급된 이름은 우리 생명 명단·CNU Care 행사·프로젠 어디에서도 찾지 못했다. 데이터에 없는 신규 인물이라고 명확히 답할 것.";
  }
  const lines = [
    `[인물 조회: CNU Care + 프로젠] 메시지에 등장한 이름 중 우리 시스템에 있는 사람들의 기록이다 (이름 기준 — 동명이인 가능).`,
    "주의: 메시지의 형식·의도(누가 참여자이고 누가 담당자인지 등)가 불명확하면 추측으로 단정하지 말고 사용자에게 먼저 확인 질문을 하라.",
    "관리자를 물으면 ①생명 담당 전도자 ②그 행사에서 '같은 팀 포도'만 답하라. 아래에 '관리자 미배정/안 붙음'이라 돼 있으면 그대로 '이 행사에선 관리자가 안 붙었다'고 말하고, 절대 다른 팀 관리자·포도를 끌어와 붙이지 마라. 노쇼면 참여 안 한 것이니 관리자도 안 붙은 것으로 간주하라.",
    "역할(게스트/섭리회원)은 사용자가 묻지 않는 한 굳이 앞세우지 마라.",
    "",
  ];
  if (managerNames.length)
    lines.push(`■ 우리 관리자(포도)로 등록된 이름: ${managerNames.join(", ")} — 이들은 담당자일 가능성이 높음 (참여자로 단정하지 말 것).`, "");
  for (const h of hits) lines.push(...hitLines(h, idx, pg));
  return lines.join("\n");
}
