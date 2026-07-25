import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// "폼 전용" 배포(genforms 등)에서만 켜짐: NEXT_PUBLIC_FORMS_ONLY=1
// 공개 폼 경로만 통과시키고, 홈·내부 페이지·그 외 API는 전부 중립 폼 홈(/forms)으로 보낸다.
// (CNUcare 본 배포는 이 값이 없어 middleware가 아무 것도 하지 않음)
const FORMS_ONLY = process.env.NEXT_PUBLIC_FORMS_ONLY === "1";

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
  if (!FORMS_ONLY) return NextResponse.next();

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
