import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { callGateway } from "@/lib/gateway";

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

function getPaidKey(): string | null {
  return process.env.GEMINI_PAID_KEY?.trim() || null;
}

function getFreeKeys(): string[] {
  return (process.env.GEMINI_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean);
}

let keyIdx = 0;

// 전체 분석 / 관리자 팀 분석 → Claude Sonnet (충남대 Gateway)
async function callClaude(prompt: string): Promise<string> {
  try {
    return await callGateway(prompt, "claude-sonnet-4-6");
  } catch (err: any) {
    console.error("CNU Gateway Claude failed:", err?.message);
  }
  // 2순위: Gateway Gemini Pro
  try {
    return await callGateway(prompt, "gemini-2.5-pro");
  } catch (err: any) {
    console.error("CNU Gateway Gemini failed:", err?.message);
  }
  // 3순위: 유료 Gemini 키
  const paidKey = getPaidKey();
  if (paidKey) {
    try {
      const ai = new GoogleGenerativeAI(paidKey);
      const model = ai.getGenerativeModel({ model: "gemini-2.5-pro" });
      const res = await model.generateContent([{ text: prompt }]);
      return res.response.text();
    } catch (err: any) {
      console.error("Paid Gemini key failed:", err?.message);
    }
  }
  throw new Error("All AI services failed");
}

// 생명별 분석 / 대학생별 분석 → Gemini (유료 키 → 무료 키)
async function callGemini(prompt: string): Promise<string> {
  const paidKey = getPaidKey();
  if (paidKey) {
    try {
      const ai = new GoogleGenerativeAI(paidKey);
      const model = ai.getGenerativeModel({ model: "gemini-2.5-pro" });
      const res = await model.generateContent([{ text: prompt }]);
      return res.response.text();
    } catch (err: any) {
      console.error("Paid key failed:", err?.message);
    }
  }

  const keys = getFreeKeys();
  for (let i = 0; i < keys.length; i++) {
    const key = keys[keyIdx % keys.length];
    keyIdx++;
    try {
      const ai = new GoogleGenerativeAI(key);
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
      const res = await model.generateContent([{ text: prompt }]);
      return res.response.text();
    } catch (err: any) {
      if (err?.message?.includes("429") && i < keys.length - 1) continue;
      throw err;
    }
  }
  throw new Error("All keys exhausted");
}

export async function GET(req: NextRequest) {
  const sb = getSb();

  // pending 보고서 가져오기
  const { data: reports } = await sb
    .from("reports")
    .select("*")
    .eq("status", "pending")
    .order("created_at")
    .limit(2);

  if (!reports || reports.length === 0) {
    return NextResponse.json({ message: "No pending reports", processed: 0 });
  }

  let processed = 0;

  for (const report of reports) {
    await sb.from("reports").update({ status: "processing" }).eq("id", report.id);

    try {
      const prompt = report.request_data?.prompt;
      if (!prompt) throw new Error("No prompt in request_data");

      // 전체/관리자 → Claude, 생명/대학생 → Gemini
      const useClaude = report.type === "overall" || report.type === "manager";
      const content = useClaude ? await callClaude(prompt) : await callGemini(prompt);

      await sb.from("reports").update({
        status: "completed",
        content,
      }).eq("id", report.id);

      processed++;
    } catch (err: any) {
      console.error("Report processing failed:", err?.message);
      const isTokenLimit = err?.message?.includes("token") || err?.message?.includes("too large") || err?.message?.includes("length");

      // 토큰 한도 초과 시 → 데이터 요약 후 재시도
      if (isTokenLimit) {
        try {
          console.log("Token limit exceeded, summarizing data first...");
          const originalPrompt = report.request_data?.prompt || "";
          // Gemini Flash로 데이터 요약
          const summary = await callGemini(
            "아래 텍스트를 핵심 내용만 남겨 한국어로 3000자 이내로 요약해주세요. 사람 이름, 단계, 주요 반응, 특이사항은 유지하세요.\n\n" + originalPrompt.slice(0, 50000)
          );
          // 요약본으로 다시 분석
          const useClaude = report.type === "overall" || report.type === "manager";
          const retryPrompt = originalPrompt.split("다음 항목을 분석")[0] + "\n[요약된 데이터]\n" + summary + "\n\n" + "다음 항목을 분석" + originalPrompt.split("다음 항목을 분석").slice(1).join("다음 항목을 분석");
          const content = useClaude ? await callClaude(retryPrompt) : await callGemini(retryPrompt);
          await sb.from("reports").update({ status: "completed", content }).eq("id", report.id);
          processed++;
          continue;
        } catch (retryErr: any) {
          console.error("Retry with summary also failed:", retryErr?.message);
        }
      }

      await sb.from("reports").update({
        status: "failed",
        content: `<div style="padding:20px;text-align:center;color:#dc2626"><p style="font-size:16px;font-weight:bold">분석에 실패했습니다</p><p style="font-size:13px;color:#9ca3af;margin-top:8px">${err?.message || "알 수 없는 오류"}</p></div>`,
      }).eq("id", report.id);
    }
  }

  return NextResponse.json({ message: "Done", processed });
}
