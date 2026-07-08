import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LIFT — 생애전환 행정 준비",
  description:
    "퇴직·이직·결혼 등 생애전환 상황에서 놓치기 쉬운 행정 절차, 마감일, 필요 서류, 공식 신청 링크를 정리해 드립니다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
