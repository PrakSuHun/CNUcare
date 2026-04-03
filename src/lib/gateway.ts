import OpenAI from "openai";

const CNU_BASE_URL = "https://factchat-cloud.mindlogic.ai/v1/gateway";

export function getCnuGateway(): OpenAI | null {
  const key = process.env.CNU_GATEWAY_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key, baseURL: CNU_BASE_URL });
}

// 텍스트 전용 호출 (분석용)
export async function callGateway(prompt: string, model = "gemini-2.5-pro"): Promise<string> {
  const client = getCnuGateway();
  if (!client) throw new Error("CNU Gateway key not configured");

  const res = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0]?.message?.content || "";
}

// 오디오 변환 호출 (base64 오디오 → 텍스트)
export async function callGatewayWithAudio(
  base64: string,
  mimeType: string,
  prompt: string,
  model = "gemini-2.5-flash"
): Promise<string> {
  const client = getCnuGateway();
  if (!client) throw new Error("CNU Gateway key not configured");

  const res = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "input_audio" as any,
            input_audio: { data: base64, format: mimeType.includes("mp4") ? "mp4" : "webm" },
          },
        ] as any,
      },
    ],
  });

  return res.choices[0]?.message?.content || "";
}
