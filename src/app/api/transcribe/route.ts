import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

function getApiKeys(): string[] {
  return (process.env.GEMINI_API_KEY || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
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

async function callGemini(apiKey: string, base64: string, mimeType: string) {
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

  const response = await model.generateContent([
    { text: PROMPT },
    { inlineData: { mimeType, data: base64 } },
  ]);

  return response.response.text();
}

export async function POST(req: NextRequest) {
  const keys = getApiKeys();
  if (keys.length === 0) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("audio") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No audio file" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  let mimeType = file.type || "audio/webm";
  if (mimeType.includes("codecs=")) mimeType = mimeType.split(";")[0];
  if (mimeType === "video/webm") mimeType = "audio/webm";

  // 모든 키를 순회하며 시도 (429 시 다음 키로)
  let lastError = "";
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const currentKey = keys[keyIndex % keys.length];
    keyIndex++;

    try {
      const text = await callGemini(currentKey, base64, mimeType);

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json({ result: parsed });
        }
      } catch {
        // JSON 파싱 실패
      }

      return NextResponse.json({ result: { 날짜: "", 만남장소: "", 생명반응: text } });
    } catch (err: any) {
      lastError = err?.message || "알 수 없는 오류";
      const is429 = lastError.includes("429") || lastError.includes("quota") || lastError.includes("Too Many Requests");

      if (is429 && attempt < keys.length - 1) {
        // 다음 키로 재시도
        continue;
      }

      // 429인데 모든 키 소진 → 잠시 후 재시도 안내
      if (is429) {
        return NextResponse.json(
          { error: "모든 API 키의 할당량이 소진되었습니다. 1~2분 후 다시 시도해주세요." },
          { status: 429 }
        );
      }

      // 기타 에러
      break;
    }
  }

  return NextResponse.json({ error: lastError || "변환 중 오류가 발생했습니다." }, { status: 500 });
}
