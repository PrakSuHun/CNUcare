// 로컬 Claude(구독) 프록시 호출.
// 터널이 켜져 있으면 Claude 답변을, 꺼져 있으면 null 을 돌려준다 → 호출부가 기존 Gemini 로 폴백.
// 필요한 환경변수: CLAUDE_PROXY_SECRET (공유 Supabase 의 claude-proxy 함수와 같은 값)
export async function tryClaude(prompt: string): Promise<string | null> {
  const secret = process.env.CLAUDE_PROXY_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secret || !url || !anon) return null;
  try {
    const res = await fetch(`${url}/functions/v1/claude-proxy`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "x-proxy-secret": secret,
      },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.available && d.answer ? (d.answer as string) : null;
  } catch {
    return null;
  }
}
