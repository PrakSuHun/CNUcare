import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

function getFreeKeys(): string[] {
  return (process.env.GEMINI_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean);
}

function getPaidKey(): string | null {
  return process.env.GEMINI_PAID_KEY?.trim() || null;
}

let keyIndex = 0;

const PROMPT = `이 오디오는 선교 활동 중 생명(선교 대상자)과의 만남을 녹음한 것입니다.
다음 JSON 형식으로 정확히 정리해주세요. 반드시 JSON만 출력하세요.

{
  "날짜": "YYYY-MM-DD 형식. 오디오에서 날짜를 알 수 없으면 빈 문자열",
  "만남장소": "만남 장소. 알 수 없으면 빈 문자열",
  "생명반응": "어떤 대화를 했는지, 생명의 반응은 어떠했는지, 다음 계획은 무엇인지 상세하게 정리"
}

한국어로 작성하고, 내용을 요약하지 말고 최대한 상세하게 전사하여 정리해주세요.`;

async function callGemini(apiKey: string, base64: string, mimeType: string, model = "gemini-2.5-flash") {
  const ai = new GoogleGenerativeAI(apiKey);
  const m = ai.getGenerativeModel({ model });
  const response = await m.generateContent([
    { text: PROMPT },
    { inlineData: { mimeType, data: base64 } },
  ]);
  return response.response.text();
}

function parseResult(text: string) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}
  return { 날짜: "", 만남장소: "", 생명반응: text };
}

export async function POST(req: NextRequest) {
  const freeKeys = getFreeKeys();
  const paidKey = getPaidKey();

  if (freeKeys.length === 0 && !paidKey) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("audio") as File | null;
  if (!file) return NextResponse.json({ error: "No audio file" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  let mimeType = file.type || "audio/webm";
  if (mimeType.includes("codecs=")) mimeType = mimeType.split(";")[0];
  if (mimeType === "video/webm") mimeType = "audio/webm";

  // 1차: 무료 키들로 시도
  for (let i = 0; i < freeKeys.length; i++) {
    const key = freeKeys[keyIndex % freeKeys.length];
    keyIndex++;
    try {
      const text = await callGemini(key, base64, mimeType);
      return NextResponse.json({ result: parseResult(text) });
    } catch (err: any) {
      const is429 = err?.message?.includes("429") || err?.message?.includes("quota");
      if (is429 && i < freeKeys.length - 1) continue;
      if (!is429) break; // 429가 아닌 에러면 바로 폴백
    }
  }

  // 2차: 유료 키로 폴백
  if (paidKey) {
    try {
      const text = await callGemini(paidKey, base64, mimeType);
      return NextResponse.json({ result: parseResult(text) });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || "변환 실패" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "모든 API 키가 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
}
