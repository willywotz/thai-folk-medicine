import type { Metadata } from "next";
import { Noto_Sans_Thai, Noto_Serif_Thai } from "next/font/google";
import type { ReactNode } from "react";

import "../globals.css";

import { I18nProvider } from "@/components/I18nProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { locales } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/getDictionary";

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

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={`${notoThai.variable} ${notoSerifThai.variable} ${notoThai.className} bg-bg text-ink`}>
        <I18nProvider locale={locale}>
          <Providers>
            <SiteHeader />
            <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
