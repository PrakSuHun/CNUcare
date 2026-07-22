import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

function getFreeKeys(): string[] {
  return (process.env.GEMINI_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean);
}

let keyIdx = 0;

// 재시도 가능한 일시 장애: 429(레이트리밋)·500·503(과부하)·네트워크 등
// 키/모델 만료(401/403/404)나 잘못된 요청(400)은 재시도해도 소용없으므로 제외.
function isRetryable(err: any): boolean {
  const m = String(err?.message || err || "");
  return /(429|500|502|503|504|overloaded|unavailable|high demand|rate limit|ECONNRESET|ETIMEDOUT|fetch failed)/i.test(m);
}

const CHAT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

async function callGemini(prompt: string): Promise<string> {
  const keys = getFreeKeys();
  if (keys.length === 0) throw new Error("GEMINI_API_KEY not configured");

  let lastErr: any;
  // 모델별 폴백 → 각 모델마다 모든 키를 2라운드 순회(라운드 사이 백오프)
  for (const modelName of CHAT_MODELS) {
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[keyIdx % keys.length];
        keyIdx++;
        try {
          const ai = new GoogleGenerativeAI(key);
          const model = ai.getGenerativeModel({ model: modelName });
          const res = await model.generateContent([{ text: prompt }]);
          return res.response.text();
        } catch (err: any) {
          lastErr = err;
          if (isRetryable(err)) continue; // 일시 장애 → 다음 키로
          throw err; // 만료/무효 등 영구 오류 → 즉시 실패
        }
      }
      // 이 라운드 모든 키가 일시 장애 → 잠깐 대기 후 재시도
      await new Promise((r) => setTimeout(r, 600 * (round + 1)));
    }
  }
  throw lastErr || new Error("All keys exhausted");
}

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message) return NextResponse.json({ error: "No message" }, { status: 400 });

    const sb = getSb();

    // 전체 데이터 요약 수집
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

    const context = `당신은 교회 선교 관리 시스템 "CNUcare"의 AI 어시스턴트입니다.
아래는 현재 시스템의 데이터 요약입니다. 이 데이터를 바탕으로 사용자의 질문에 한국어로 답변해주세요.

[조직 현황]
단장단 ${managers.length}명, 팀원 ${students.length}명
전체 생명 ${lives.length}명 (활성 ${active.length}명, 페일 ${failed.length}명)

[단계별 현황]
${Object.entries(stages).map(([k, v]) => `${k}: ${v}명`).join(", ")}

[최근 일지 ${journals.length}건 요약]
${journals.slice(0, 20).map((j) => {
  const life = lives.find((l) => l.id === j.life_id);
  return `- ${j.met_date} | ${life?.name || "?"} | ${j.location || ""} | ${(j.response || "").slice(0, 60)}`;
}).join("\n")}

[생명 목록 (최근 업데이트 순)]
${active.slice(0, 30).map((l) => `- ${l.name} | ${l.age || "?"}세 | ${l.department || "?"} | ${l.stage} | ${l.mbti || "?"} | 마지막: ${l.last_met_at || "없음"}`).join("\n")}

---
사용자 질문: ${message}

친절하고 구체적으로 답변해주세요. 데이터에 기반하여 답하되, 데이터가 부족하면 솔직히 말해주세요.

중요: 마크다운 문법(**, ##, ---, - 등)을 절대 사용하지 마세요. 일반 텍스트로만 답변하세요. 줄바꿈과 숫자 번호만 사용하세요.`;

    const reply = await callGemini(context);
    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "답변 생성에 실패했습니다." }, { status: 500 });
  }
}
