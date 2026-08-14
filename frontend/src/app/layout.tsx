import type { Metadata } from "next";
import { Noto_Sans_Thai, Noto_Serif_Thai } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

import { SiteHeader } from "@/components/SiteHeader";

import { Providers } from "./providers";

const notoThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-sans-thai",
});
const notoSerifThai = Noto_Serif_Thai({
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-serif-thai",
});

export const metadata: Metadata = {
  title: "ตำรายาหมอพื้นบ้าน",
  description: "Folk-medicine records of local healers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body className={`${notoThai.variable} ${notoSerifThai.variable} ${notoThai.className} bg-bg text-ink`}>
        <Providers>
          <SiteHeader />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
