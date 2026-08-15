import type { Metadata } from "next";
import { Noto_Sans_Thai, Noto_Serif_Thai } from "next/font/google";
import type { ReactNode } from "react";

import "../globals.css";

import { I18nProvider } from "@/components/I18nProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { locales } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/getDictionary";

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
  const dict = await getDictionary();
  // withinlazy: functions (e.g. dict.home.treatedWithRemedy) can't cross the
  // server->client prop boundary; strip them for the client copy. No client
  // component reads a formatter fn via useT() today — if one needs to,
  // compute the string server-side and pass it as a plain prop instead.
  const clientDict = JSON.parse(JSON.stringify(dict));
  return (
    <html lang={locale}>
      <body className={`${notoThai.variable} ${notoSerifThai.variable} ${notoThai.className} bg-bg text-ink`}>
        <I18nProvider locale={locale} dict={clientDict}>
          <Providers>
            <SiteHeader />
            <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
