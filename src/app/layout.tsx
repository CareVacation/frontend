import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "휴무 관리 시스템",
  description: "휴무 신청 및 관리를 위한 캘린더 시스템",
  viewport: "width=device-width, initial-scale=0.85, maximum-scale=0.85, user-scalable=0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
