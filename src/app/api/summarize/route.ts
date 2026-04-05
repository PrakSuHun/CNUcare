import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

function getKeys(): string[] {
  const free = (process.env.GEMINI_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean);
  const paid = process.env.GEMINI_PAID_KEY?.trim();
  return [...free, ...(paid ? [paid] : [])];
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text) return NextResponse.json({ error: "No text" }, { status: 400 });

  const keys = getKeys();
  for (const key of keys) {
    try {
      const ai = new GoogleGenerativeAI(key);
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
      const res = await model.generateContent([{
        text: `아래는 선교 강의 후 생명(선교 대상자)의 반응 기록입니다. 핵심 내용을 2~3줄로 요약해주세요. 마크다운 없이 일반 텍스트로만 작성하세요.\n\n${text}`,
      }]);
      return NextResponse.json({ summary: res.response.text().trim() });
    } catch (err: any) {
      if (err?.message?.includes("429")) continue;
      return NextResponse.json({ error: err?.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "All keys exhausted" }, { status: 500 });
}
