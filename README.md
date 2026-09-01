This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## AI 엔진

CNUcare의 채팅·요약·분석 보고서는 공유 Supabase `codex-proxy`를 통해 로그인된 Codex CLI를 우선 사용합니다.
브리지 오프라인, 인증 만료, 과부하 또는 Codex 오류 시 기존 Gemini 계층으로 자동 폴백합니다.

- 텍스트 및 지원 이미지(JPEG/PNG/GIF/WebP): Codex 우선
- PDF와 미지원 이미지 형식: 원본 첨부를 Gemini로 전달
- 필요한 서버 환경변수: `CODEX_PROXY_SECRET`
- 배포 전환 호환: 기존 `CLAUDE_PROXY_SECRET`과 `CLAUDE_VISION`도 임시로 읽음
- 이미지 처리를 끄려면 `CODEX_VISION=0`

Codex 실행 브리지와 터널은 명단 분석 프로젝트의 `server/bridge.mjs`, `server/tunnel.mjs`에서 관리합니다.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
