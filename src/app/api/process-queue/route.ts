import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

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

async function summarizeResponse(text: string): Promise<string | null> {
  const keys = getFreeKeys();
  const paidKey = getPaidKey();
  const allKeys = [...keys, ...(paidKey ? [paidKey] : [])];
  for (const key of allKeys) {
    try {
      const ai = new GoogleGenerativeAI(key);
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
      const res = await model.generateContent([{
        text: `아래는 선교 강의 후 생명(선교 대상자)의 반응 기록입니다. 핵심 내용을 2~3줄로 요약해주세요. 마크다운 없이 일반 텍스트로만 작성하세요.\n\n${text}`,
      }]);
      return res.response.text().trim();
    } catch (err: any) {
      if (err?.message?.includes("429")) continue;
      break;
    }
  }
  return null;
}

async function transcribeWithRetry(audioBase64: string, mimeType: string): Promise<string | null> {
  // 1차: 무료 키들
  const freeKeys = getFreeKeys();
  for (let i = 0; i < freeKeys.length; i++) {
    const key = freeKeys[keyIndex % freeKeys.length];
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
      if (is429 && i < freeKeys.length - 1) continue;
      if (!is429) break;
    }
  }

  // 2차: 유료 키 폴백
  const paidKey = getPaidKey();
  if (paidKey) {
    try {
      const ai = new GoogleGenerativeAI(paidKey);
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
      const response = await model.generateContent([
        { text: PROMPT },
        { inlineData: { mimeType, data: audioBase64 } },
      ]);
      return response.response.text();
    } catch {
      // 유료 키도 실패
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();

  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const freeKeys = getFreeKeys();
  const paidKey = getPaidKey();
  if (freeKeys.length === 0 && !paidKey) {
    return NextResponse.json({ error: "No API keys" }, { status: 500 });
  }

  // 대기 중인 작업
  const { data: queue } = await sb
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
    await sb.from("audio_queue").update({ status: "processing" }).eq("id", task.id);

    try {
      // 녹음 파일 다운로드
      const audioRes = await fetch(task.audio_url);
      if (!audioRes.ok) throw new Error("Failed to download audio");

      const audioBuffer = await audioRes.arrayBuffer();
      const base64 = Buffer.from(audioBuffer).toString("base64");
      const contentType = audioRes.headers.get("content-type") || "audio/webm";
      const mimeType = contentType.split(";")[0];

      // Gemini 변환
      const text = await transcribeWithRetry(base64, mimeType);
      if (!text) throw new Error("Transcription returned empty");

      // JSON 파싱
      let result: any = { 생명반응: text };
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      } catch {}

      // 큐 완료 처리
      await sb.from("audio_queue").update({
        status: "completed",
        result_json: result,
        completed_at: new Date().toISOString(),
      }).eq("id", task.id);

      // 일지에 변환 결과 채우기 (변환 중 메시지이거나 비어있으면 업데이트)
      if (result.생명반응) {
        const { data: journal } = await sb
          .from("journals")
          .select("id, response")
          .eq("life_id", task.life_id)
          .eq("audio_url", task.audio_url)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (journal) {
          const isEmpty = !journal.response
            || journal.response.trim() === ""
            || journal.response === "(텍스트 변환 중입니다)";

          if (isEmpty) {
            const updateData: any = { response: result.생명반응, audio_url: null };
            if (result.만남장소) updateData.location = result.만남장소;
            await sb.from("journals").update(updateData).eq("id", journal.id);

            // 녹음 파일 삭제 (Storage 용량 확보)
            try {
              const url = new URL(task.audio_url);
              const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/recordings\/(.+)/);
              if (pathMatch) {
                await sb.storage.from("recordings").remove([decodeURIComponent(pathMatch[1])]);
              }
            } catch {}
          }
        }
      }

      // 강의 일지면 요약해서 lesson_checks.note에 저장
      if (result.생명반응) {
        const { data: savedJournal } = await sb
          .from("journals")
          .select("id, purpose, lesson_id, response")
          .eq("life_id", task.life_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (savedJournal?.purpose === "lecture" && savedJournal?.lesson_id && savedJournal?.response) {
          try {
            const summary = await summarizeResponse(savedJournal.response);
            if (summary) {
              await sb.from("lesson_checks")
                .update({ note: summary })
                .eq("life_id", task.life_id)
                .eq("lesson_id", savedJournal.lesson_id);
            }
          } catch {}
        }
      }

      processed++;

      // rate limit 방지
      await new Promise((r) => setTimeout(r, 4000));

    } catch (err: any) {
      const retryCount = (task.retry_count || 0) + 1;
      await sb.from("audio_queue").update({
        status: retryCount >= 3 ? "failed" : "pending",
        retry_count: retryCount,
      }).eq("id", task.id);
    }
  }

  return NextResponse.json({ message: "Done", processed });
}
