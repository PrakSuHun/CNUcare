import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// "폼 전용" 배포(genforms 등)에서만 켜짐.
// 판별: ① 호스트에 "genforms" 포함(런타임, env 없이도 즉시 동작) 또는
//       ② NEXT_PUBLIC_FORMS_ONLY=1 (커스텀 도메인용 override)
// 켜지면 공개 폼 경로만 통과, 홈·내부 페이지·그 외 API는 중립 폼 홈(/forms)/404로.
// (CNUcare 본 배포는 호스트가 다르고 env도 없어 아무 것도 하지 않음)
function isFormsOnly(req: NextRequest): boolean {
  if (process.env.NEXT_PUBLIC_FORMS_ONLY === "1") return true;
  const host = (req.headers.get("host") || "").toLowerCase();
  return host.includes("genforms");
}

// 통과 허용: 공개 폼 페이지 + 폼이 쓰는 API + 중립 홈 자신
const ALLOW = [
  /^\/forms(\/|$)/,
  /^\/register(\/|$)/,
  /^\/checkin(\/|$)/,
  /^\/check(\/|$)/,
  /^\/event-share(\/|$)/,
  /^\/feedback(\/|$)/,
  /^\/api\/notify-registration(\/|$)/,
];

export function middleware(req: NextRequest) {
  if (!isFormsOnly(req)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (ALLOW.some((re) => re.test(pathname))) return NextResponse.next();

  // 허용되지 않은 API는 404 (내부 API 노출 차단)
  if (pathname.startsWith("/api/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  // 그 외 모든 경로(홈 포함) → 중립 폼 홈으로 rewrite (URL은 유지, CNUcare 화면은 렌더 안 함)
  const url = req.nextUrl.clone();
  url.pathname = "/forms";
  return NextResponse.rewrite(url);
}

export const config = {
  // 정적 자원은 미들웨어 제외
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon-192.png|icon-512.png|apple-touch-icon.png).*)",
  ],
};
