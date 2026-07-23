// CNU Care 웹 푸시 구독 (사용자별). cnu-notify 함수에 저장.
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
export function isIos(): boolean {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export function isStandalone(): boolean {
  return typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);
}

function b64ToU8(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const s = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function callNotify(body: Record<string, unknown>) {
  const res = await fetch(`${SUPA}/functions/v1/cnu-notify`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: ANON!, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.error) throw new Error(d.error || "요청 실패");
  return d;
}

export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return Boolean(await reg?.pushManager.getSubscription());
}

/** 알림 켜기: SW 등록 → 권한 → 구독 → 서버에 user_id와 함께 저장. */
export async function subscribePush(userId: string, label: string): Promise<void> {
  if (!pushSupported()) throw new Error("이 브라우저는 알림을 지원하지 않습니다.");
  if (!VAPID) throw new Error("VAPID 공개키 미설정 (NEXT_PUBLIC_VAPID_PUBLIC_KEY).");
  if (isIos() && !isStandalone()) throw new Error("아이폰은 먼저 '홈 화면에 추가'로 설치한 뒤 열어주세요.");

  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  if ((await Notification.requestPermission()) !== "granted") throw new Error("알림 권한이 거부되었습니다.");

  const wanted = b64ToU8(VAPID);
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const cur = sub.options?.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey as ArrayBuffer) : null;
    const same = cur && cur.length === wanted.length && cur.every((b, i) => b === wanted[i]);
    if (!same) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wanted as BufferSource });

  const j = sub.toJSON();
  await callNotify({ action: "subscribe", user_id: userId, subscription: { endpoint: j.endpoint, keys: j.keys }, label });
}

export async function unsubscribePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await callNotify({ action: "unsubscribe", endpoint });
}
