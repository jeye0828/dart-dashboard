import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DART 재무비교 대시보드",
  description: "DART 오픈API로 여러 회사의 재무제표를 검색하고 비교합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
