import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { randomBytes } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { tryClaude } from "@/lib/claudeBridge";
import { personLookupContext } from "@/lib/rosterLookup";
import { runRosterFlow } from "@/lib/rosterFlow";
import { STAGE_LABELS } from "@/lib/stages";

const stageLabel = (s: string) => STAGE_LABELS[s] || s || "미분류";

// 계정별 채팅 기록(명단분석과 공유하는 chat_conversations/chat_messages) + 백그라운드 답변.
// 답변은 사용자가 앱을 나가도 서버에서 완료된다(after()). 기록은 app_users.id 기준으로 양쪽 앱 통합.
export const maxDuration = 300;

function getSb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  );
}
function getFreeKeys(): string[] {
  return (process.env.GEMINI_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean);
}
let keyIdx = 0;
function isRetryable(err: any): boolean {
  const m = String(err?.message || err || "");
  return /(429|500|502|503|504|overloaded|unavailable|high demand|rate limit|ECONNRESET|ETIMEDOUT|fetch failed)/i.test(m);
}
const CHAT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

type Media = { mime: string; data: string };
type Sheet = { name: string; text?: string; rows?: Record<string, string>[]; headers?: string[] };

async function callGemini(prompt: string, media: Media[] = []): Promise<string> {
  const keys = getFreeKeys();
  if (keys.length === 0) throw new Error("GEMINI_API_KEY not configured");
  const parts: any[] = [{ text: prompt }];
  for (const m of media) parts.push({ inlineData: { mimeType: m.mime, data: m.data } });
  let lastErr: any;
  for (const modelName of CHAT_MODELS) {
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[keyIdx % keys.length];
        keyIdx++;
        try {
          const ai = new GoogleGenerativeAI(key);
          const model = ai.getGenerativeModel({ model: modelName });
          const res = await model.generateContent(parts);
          return res.response.text();
        } catch (err: any) {
          lastErr = err;
          if (isRetryable(err)) continue;
          throw err;
        }
      }
      await new Promise((r) => setTimeout(r, 600 * (round + 1)));
    }
  }
  throw lastErr || new Error("All keys exhausted");
}

// CNU 유저 → 명단분석 app_users.id 로 매핑(없으면 SSO처럼 자동 생성). 기록 통합 키.
async function resolveAppUserId(sb: SupabaseClient, loginId: string): Promise<string | null> {
  const lid = String(loginId || "").trim().toLowerCase();
  if (!lid) return null;
  const { data: existing } = await sb.from("app_users").select("id").eq("login_id", lid).maybeSingle();
  if (existing?.id) return existing.id;
  const { data: cnu } = await sb.from("users").select("name, display_name, phone").ilike("login_id", lid).limit(1);
  const c = cnu?.[0];
  const rnd = () => randomBytes(16).toString("base64url");
  const { data: ins, error } = await sb.from("app_users").insert({
    login_id: lid, name: c?.display_name || c?.name || lid, phone: c?.phone || "",
    school: "충남대", approved: true, is_admin: false, pw_salt: rnd(), pw_hash: rnd(),
  }).select("id").single();
  if (error) { // 경합 → 재조회
    const re = await sb.from("app_users").select("id").eq("login_id", lid).maybeSingle();
    return re.data?.id ?? null;
  }
  return ins?.id ?? null;
}

// ── 답변 생성(백그라운드). 완료 시 assistant 메시지를 done/error 로 갱신. ──
async function generate(
  sb: SupabaseClient, convId: string, assistantId: string, engine: string, cnuUserId: string,
  message: string, sheets: Sheet[], media: Media[], history: { role: string; content: string }[],
) {
  try {
    const sheetText = sheets.map((s) => `[첨부: ${s.name}]\n${s.text || ""}`).join("\n\n");
    const lookupIntent = /조회|대조|중복|겹치|확인|명단|참여|등록|만들/.test(message);

    // 명단 워크플로: 파일 업로드→표+중복→제외→확인→행사등록 (진행 중 세션이면 응답 처리)
    const rosterReply = await runRosterFlow(sb, convId, cnuUserId, message, sheets as any, media, lookupIntent);
    if (rosterReply !== null) {
      await sb.from("chat_messages").update({ content: rosterReply, status: "done", engine: "roster" }).eq("id", assistantId);
      return;
    }

    // 일반 채팅: 데이터 요약 + 명단 교차조회 + 대화 맥락
    const [livesRes, usersRes, journalsRes] = await Promise.all([
      sb.from("lives").select("id, name, stage, is_failed, last_met_at, department, age, mbti").limit(200),
      sb.from("users").select("id, display_name, role, manager_id").limit(100),
      sb.from("journals").select("life_id, met_date, location, response, purpose").is("deleted_at", null).order("met_date", { ascending: false }).limit(100),
    ]);
    const lives = livesRes.data || [];
    const users = usersRes.data || [];
    const journals = journalsRes.data || [];
    const active = lives.filter((l) => !l.is_failed);
    const failed = lives.filter((l) => l.is_failed);
    const managers = users.filter((u) => u.role === "manager");
    const students = users.filter((u) => u.role === "student");
    const stages: Record<string, number> = {};
    active.forEach((l) => { stages[l.stage] = (stages[l.stage] || 0) + 1; });

    let lookup: string | null = null;
    try { lookup = await personLookupContext(`${message}\n${sheetText}`); } catch { lookup = null; }
    const lookupBlock = lookup ? `\n\n[명단 교차조회 결과 — 앱이 계산한 근거. 그대로 신뢰]\n${lookup}\n` : "";
    const sheetBlock = sheetText ? `\n\n[첨부 표 데이터]\n${sheetText}\n` : "";
    const histBlock = history.length
      ? `\n[이전 대화]\n${history.slice(-12).map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content}`).join("\n")}\n`
      : "";

    const context = `당신은 교회 선교 관리 시스템 "CNUcare"의 AI 어시스턴트입니다. 한국어로 답합니다.

[조직 현황] 단장단 ${managers.length}명, 팀원 ${students.length}명, 전체 생명 ${lives.length}명(활성 ${active.length}·페일 ${failed.length})
[단계] ${Object.entries(stages).map(([k, v]) => `${stageLabel(k)}:${v}명`).join(", ")}
[최근 일지 ${journals.length}건]
${journals.slice(0, 20).map((j) => { const l = lives.find((x) => x.id === j.life_id); return `- ${j.met_date} | ${l?.name || "?"} | ${(j.response || "").slice(0, 60)}`; }).join("\n")}
[생명] (단계는 한글 명칭 그대로 사용할 것)
${active.slice(0, 30).map((l) => `- ${l.name} | ${l.age || "?"}세 | ${l.department || "?"} | ${stageLabel(l.stage)} | 마지막:${l.last_met_at || "없음"}`).join("\n")}
${sheetBlock}${lookupBlock}${media.length ? "\n[첨부 이미지/PDF] 첨부 파일을 읽고 질문에 답하세요.\n" : ""}${histBlock}
[용어] '생명'=말씀 듣는 우리 사람(중요). '포도/관리자'=섭리회원. '프로젠'=연결된 별도 시스템.
"조회/대조/중복"은 그 사람들이 우리 행사·프로젠에 중복 참여했는지 확인 요청이다.

---
사용자: ${message || "(첨부 파일 참고)"}

데이터에 근거해 구체적으로 답하세요. 부족하면 솔직히 말하세요.
표로 정리하면 이해가 쉬운 내용(명단, 비교, 통계)은 마크다운 표를 사용하세요. 목록은 - 또는 번호를 쓰세요.
다만 불필요하게 굵게(**)를 남발하지 말고, 꼭 강조가 필요할 때만 쓰세요.
매우 중요: 단계·상태 등은 반드시 한글 명칭(1차 만남, 전초, 입문, 초급, 수료 등)으로 답하세요. beginner, first_meeting 같은 영어 코드값을 절대 그대로 쓰지 마세요.`;

    let reply: string;
    let used: string;
    if (media.length > 0) { reply = await callGemini(context, media); used = "gemini-vision"; }
    else if (engine === "gemini") { reply = await callGemini(context); used = "gemini"; }
    else { const c = await tryClaude(context); reply = c ?? (await callGemini(context)); used = c ? "claude" : "gemini"; }

    await sb.from("chat_messages").update({ content: reply, status: "done", engine: used }).eq("id", assistantId);
  } catch (e: any) {
    await sb.from("chat_messages").update({ content: `(오류) ${e?.message || e}`, status: "error" }).eq("id", assistantId);
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const action = b.action || "send";
    const sb = getSb();

    // ── 목록/기록/폴링/삭제/이름변경 ──
    if (action === "list") {
      const uid = await resolveAppUserId(sb, b.login_id);
      if (!uid) return NextResponse.json({ conversations: [] });
      const { data } = await sb.from("chat_conversations").select("id, title, updated_at").eq("user_id", uid).order("updated_at", { ascending: false }).limit(100);
      return NextResponse.json({ conversations: data || [] });
    }
    if (action === "history") {
      const { data } = await sb.from("chat_messages").select("id, role, content, status, engine, files, created_at").eq("conversation_id", String(b.conversation_id)).order("created_at");
      return NextResponse.json({ messages: data || [] });
    }
    if (action === "poll") {
      const ids = Array.isArray(b.ids) ? b.ids : [];
      if (!ids.length) return NextResponse.json({ messages: [] });
      const { data } = await sb.from("chat_messages").select("id, content, status, engine").in("id", ids);
      return NextResponse.json({ messages: data || [] });
    }
    if (action === "delete") {
      const uid = await resolveAppUserId(sb, b.login_id);
      if (uid) await sb.from("chat_conversations").delete().eq("id", String(b.conversation_id)).eq("user_id", uid);
      return NextResponse.json({ ok: true });
    }
    if (action === "rename") {
      const uid = await resolveAppUserId(sb, b.login_id);
      if (uid) await sb.from("chat_conversations").update({ title: String(b.title ?? "").slice(0, 80) }).eq("id", String(b.conversation_id)).eq("user_id", uid);
      return NextResponse.json({ ok: true });
    }

    // ── 메시지 전송 (백그라운드 답변) ──
    const uid = await resolveAppUserId(sb, b.login_id);
    if (!uid) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const message = String(b.message || "");
    const cnuUserId = String(b.cnu_user_id || ""); // CNU users.id — 행사 생성 시 created_by
    const engine = b.engine === "gemini" ? "gemini" : "claude";
    const media: Media[] = Array.isArray(b.media) ? b.media.slice(0, 6) : (Array.isArray(b.images) ? b.images.slice(0, 6) : []);
    const sheets: Sheet[] = Array.isArray(b.sheets) ? b.sheets.slice(0, 6) : [];
    const fileNames: string[] = Array.isArray(b.fileNames) ? b.fileNames : [];
    if (!message && media.length === 0 && sheets.length === 0)
      return NextResponse.json({ error: "내용이 없습니다." }, { status: 400 });

    // 대화 생성 or 이어쓰기
    let convId = b.conversation_id ? String(b.conversation_id) : "";
    if (!convId) {
      const { data: conv } = await sb.from("chat_conversations").insert({ user_id: uid, title: (message || "명단 조회").slice(0, 40) }).select("id").single();
      convId = conv!.id;
    } else {
      await sb.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
    }

    // 직전 대화 맥락
    const { data: prior } = await sb.from("chat_messages").select("role, content, status").eq("conversation_id", convId).order("created_at").limit(40);
    const history = (prior || []).filter((m) => m.status === "done" && m.content).map((m) => ({ role: m.role, content: m.content }));

    // 사용자 메시지 + pending 답변 삽입
    await sb.from("chat_messages").insert({ conversation_id: convId, role: "user", content: message, files: fileNames.length ? fileNames : null, status: "done" });
    const { data: am } = await sb.from("chat_messages").insert({ conversation_id: convId, role: "assistant", content: "", status: "pending", engine: media.length ? "gemini" : engine }).select("id").single();

    // 백그라운드 생성 — 응답은 즉시, 답변은 앱을 나가도 완료됨
    after(async () => { await generate(sb, convId, am!.id, engine, cnuUserId, message, sheets, media, history); });

    return NextResponse.json({ conversation_id: convId, assistant_id: am!.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "요청 처리 실패" }, { status: 500 });
  }
}
