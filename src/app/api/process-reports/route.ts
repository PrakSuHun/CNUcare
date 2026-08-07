import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { callGateway } from "@/lib/gateway";
import { tryClaude } from "@/lib/claudeBridge";
import { expandLinkedUsers } from "@/lib/accountLinks";

export const maxDuration = 300;

const REPORT_TYPE_LABEL: Record<string, string> = {
  life: "생명", student: "전도자", manager: "팀", overall: "전체", event: "행사",
};

// 분석 완료 시 요청자에게 푸시 알림 (구독 기기만 수신)
async function notifyReportDone(report: any) {
  try {
    if (!report?.created_by) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const secret = process.env.CNU_NOTIFY_SECRET;
    if (!url || !anon || !secret) return;
    const userIds = expandLinkedUsers([report.created_by]);
    if (userIds.length === 0) return;
    const label = REPORT_TYPE_LABEL[report.type] || "";
    const deepLink =
      report.type === "event" && report.target_id ? `/event/${report.target_id}` :
      report.type === "life" && report.target_id ? `/life/${report.target_id}` :
      "/"; // 전도자/팀/전체는 대상 페이지가 없어 홈으로

    await fetch(`${url}/functions/v1/cnu-notify`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
      body: JSON.stringify({
        action: "send",
        secret,
        user_ids: userIds,
        title: `✅ AI 분석 완료 · ${report.target_name || label}`,
        body: `${label} 분석이 끝났어요. 눌러서 결과를 확인하세요.`,
        url: deepLink,
        tag: `report-${report.id}`,
      }),
    });
  } catch { /* 알림 실패는 무시 */ }
}

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

// 0순위: 구독 Claude 브릿지 → 1순위: 충남대 Gateway Gemini Pro → 2순위: 유료 Gemini 키 → 3순위: 무료 키
async function callGemini(prompt: string): Promise<string> {
  // 0순위: Claude (구독 브릿지). 켜져 있으면 우선, 꺼짐/실패면 null → Gemini 폴백
  const claude = await tryClaude(prompt);
  if (claude) return claude;

  // 1순위: 충남대 Gateway
  try {
    return await callGateway(prompt, "gemini-2.5-pro");
  } catch (err: any) {
    console.error("CNU Gateway failed:", err?.message);
  }

  // 2순위: 유료 Gemini 키
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

  // 3순위: 무료 키
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

      // Claude 우선 → Gemini 폴백
      const content = await callGemini(prompt);

      await sb.from("reports").update({
        status: "completed",
        content,
      }).eq("id", report.id);
      await notifyReportDone(report);

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
          const retryPrompt = originalPrompt.split("다음 항목을 분석")[0] + "\n[요약된 데이터]\n" + summary + "\n\n" + "다음 항목을 분석" + originalPrompt.split("다음 항목을 분석").slice(1).join("다음 항목을 분석");
          const content = await callGemini(retryPrompt);
          await sb.from("reports").update({ status: "completed", content }).eq("id", report.id);
          await notifyReportDone(report);
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
