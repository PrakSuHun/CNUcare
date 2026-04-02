import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

let requestCount = 0;

function getApiKey(): string | null {
  const keys = (process.env.GEMINI_API_KEY || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (keys.length === 0) return null;

  const key = keys[requestCount % keys.length];
  requestCount++;
  return key;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("audio") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No audio file" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `이 오디오는 선교 활동 중 생명(선교 대상자)과의 만남을 녹음한 것입니다.
다음 JSON 형식으로 정확히 정리해주세요. 반드시 JSON만 출력하세요.

{
  "날짜": "YYYY-MM-DD 형식. 오디오에서 날짜를 알 수 없으면 빈 문자열",
  "만남장소": "만남 장소. 알 수 없으면 빈 문자열",
  "생명반응": "어떤 대화를 했는지, 생명의 반응은 어떠했는지, 다음 계획은 무엇인지 상세하게 정리"
}

한국어로 작성하고, 내용을 요약하지 말고 최대한 상세하게 전사하여 정리해주세요.`;

    // 브라우저 녹음은 보통 webm 또는 mp4
    let mimeType = file.type || "audio/webm";
    // Gemini가 지원하는 형식으로 보정
    if (mimeType === "audio/webm;codecs=opus") mimeType = "audio/webm";
    if (mimeType === "video/webm") mimeType = "audio/webm";

    const response = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: base64,
        },
      },
    ]);

    const text = response.response.text();

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
    console.error("Transcribe error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "변환 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
