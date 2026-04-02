import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CNUcare",
  description: "교회 선교 관리 및 분석 서비스",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
