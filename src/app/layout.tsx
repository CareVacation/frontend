import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";

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
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-1H584GEX4N"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-1H584GEX4N');
          `}
        </Script>
      </head>
      <body className={inter.className} suppressHydrationWarning>{children}</body>
    </html>
  );
}
