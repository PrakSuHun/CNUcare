import "server-only";

// 공유 Supabase 프록시를 통해 로그인된 로컬 Codex CLI를 호출한다.
// 브리지/터널/인증/첨부 검증 중 하나라도 실패하면 null을 반환해 호출부가 Gemini로 폴백한다.
export type CodexMedia = { mime: string; data: string };

const CODEX_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_IMAGES = 6;
const MAX_IMAGE_BASE64_CHARS = 5_600_000;
const MAX_TOTAL_BASE64_CHARS = 14_000_000;

export function canUseCodexVision(media: CodexMedia[]): boolean {
  if (media.length === 0 || media.length > MAX_IMAGES) return false;
  let total = 0;
  for (const item of media) {
    if (!CODEX_IMAGE_MIMES.has(String(item.mime || "").toLowerCase())) return false;
    if (!item.data || item.data.length > MAX_IMAGE_BASE64_CHARS) return false;
    total += item.data.length;
    if (total > MAX_TOTAL_BASE64_CHARS) return false;
  }
  return true;
}

function visionEnabled(): boolean {
  // 배포 순서를 위해 이전 환경변수도 읽되, 신규 설정을 우선한다.
  return (process.env.CODEX_VISION ?? process.env.CLAUDE_VISION ?? "1") !== "0";
}

export async function tryCodex(prompt: string, media: CodexMedia[] = []): Promise<string | null> {
  const secret = process.env.CODEX_PROXY_SECRET || process.env.CLAUDE_PROXY_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secret || !url || !anon || !prompt) return null;

  // Codex CLI는 이미지 파일 첨부를 지원한다. PDF/HEIC 등은 누락시키지 않고 호출 자체를
  // 건너뛰어 Gemini가 원본 첨부를 처리하게 한다.
  if (media.length && (!visionEnabled() || !canUseCodexVision(media))) return null;

  try {
    const res = await fetch(`${url}/functions/v1/codex-proxy`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "x-proxy-secret": secret,
      },
      body: JSON.stringify(media.length ? { prompt, images: media } : { prompt }),
      signal: AbortSignal.timeout(170_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.available && typeof data.answer === "string" && data.answer.trim()
      ? data.answer as string
      : null;
  } catch {
    return null;
  }
}
