import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

import { Providers } from "./providers";

const notoThai = Noto_Sans_Thai({ subsets: ["thai", "latin"], display: "swap" });

export const metadata: Metadata = {
  title: "ตำรายาหมอพื้นบ้านยโสธร",
  description: "Folk-medicine records of local healers in Yasothon province.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body className={`${notoThai.className} bg-stone-100 text-stone-900`}>
        <Providers>
          <header className="border-b border-stone-200 bg-white">
            <div className="mx-auto max-w-3xl px-4 py-4">
              <Link href="/" className="text-xl font-bold text-stone-900">
                ตำรายาหมอพื้นบ้าน ยโสธร
              </Link>
              <p className="text-sm text-stone-500">
                Folk-medicine knowledge of Yasothon, by district
              </p>
            </div>
          </header>
          <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
