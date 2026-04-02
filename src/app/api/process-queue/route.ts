import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

async function transcribeWithRetry(audioBase64: string, mimeType: string, keys: string[]): Promise<string | null> {
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[keyIndex % keys.length];
    keyIndex++;
    try {
      const ai = new GoogleGenerativeAI(key);
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
      const response = await model.generateContent([
        { text: PROMPT },
        { inlineData: { mimeType, data: audioBase64 } },
      ]);
      return response.response.text();
    } catch (err: any) {
      const is429 = err?.message?.includes("429") || err?.message?.includes("quota");
      if (is429 && attempt < keys.length - 1) continue;
      throw err;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  // 간단한 보안: cron secret 또는 내부 호출만 허용
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = getApiKeys();
  if (keys.length === 0) {
    return NextResponse.json({ error: "No API keys" }, { status: 500 });
  }

  // 대기 중인 작업 가져오기 (최대 3개씩 처리)
  const { data: queue } = await supabaseAdmin
    .from("audio_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at")
    .limit(3);

  if (!queue || queue.length === 0) {
    return NextResponse.json({ message: "No pending tasks", processed: 0 });
  }

  let processed = 0;

  for (const task of queue) {
    // 처리 중으로 변경
    await supabaseAdmin.from("audio_queue").update({ status: "processing" }).eq("id", task.id);

    try {
      // 녹음 파일 다운로드
      const audioRes = await fetch(task.audio_url);
      if (!audioRes.ok) throw new Error("Failed to download audio");

      const audioBuffer = await audioRes.arrayBuffer();
      const base64 = Buffer.from(audioBuffer).toString("base64");
      const contentType = audioRes.headers.get("content-type") || "audio/webm";
      const mimeType = contentType.split(";")[0];

      // Gemini 변환
      const text = await transcribeWithRetry(base64, mimeType, keys);
      if (!text) throw new Error("Transcription returned empty");

      // JSON 파싱
      let result: any = { 생명반응: text };
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      } catch {}

      // 결과를 큐에 저장
      await supabaseAdmin.from("audio_queue").update({
        status: "completed",
        result_json: result,
        completed_at: new Date().toISOString(),
      }).eq("id", task.id);

      // 해당 생명의 가장 최근 일지(audio_url 일치)에 내용 채우기
      if (result.생명반응) {
        const { data: journal } = await supabaseAdmin
          .from("journals")
          .select("id, response")
          .eq("life_id", task.life_id)
          .eq("audio_url", task.audio_url)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (journal && (!journal.response || journal.response.trim() === "")) {
          const updateData: any = { response: result.생명반응 };
          if (result.만남장소) updateData.location = result.만남장소;
          await supabaseAdmin.from("journals").update(updateData).eq("id", journal.id);
        }
      }

      processed++;

      // rate limit 방지: 4초 대기
      await new Promise((r) => setTimeout(r, 4000));

    } catch (err: any) {
      const retryCount = (task.retry_count || 0) + 1;
      await supabaseAdmin.from("audio_queue").update({
        status: retryCount >= 3 ? "failed" : "pending",
        retry_count: retryCount,
      }).eq("id", task.id);
    }
  }

  return NextResponse.json({ message: "Done", processed });
}
