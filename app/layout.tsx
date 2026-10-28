import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Header from "@/components/custom/Header";
import Footer from "@/components/custom/Footer";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { BRAND_IMAGE_ICON_PATH, BRAND_IMAGE_OG_PATH } from "@/lib/brand";
import { absoluteUrl, getSiteUrl } from "@/lib/site";
import YandexMetrika from "@/components/YandexMetrika";
import SiteSplash from "@/components/custom/SiteSplash";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Seo");
  const siteUrl = getSiteUrl();
  const keywords = t("defaultKeywords")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ogImage = absoluteUrl(BRAND_IMAGE_OG_PATH);
  const locale = await getLocale();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t("defaultTitle"),
      template: t("titleTemplate"),
    },
    description: t("defaultDescription"),
    keywords,
    applicationName: t("siteName"),
    openGraph: {
      title: t("defaultTitle"),
      description: t("defaultDescription"),
      type: "website",
      siteName: t("siteName"),
      url: siteUrl + "/",
      locale,
      images: [
        {
          url: ogImage,
          alt: t("ogImageAlt"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("siteName"),
      description: t("defaultDescription"),
      images: [ogImage],
      site: t("twitterSite") || undefined,
    },
    icons: {
      icon: BRAND_IMAGE_ICON_PATH,
      shortcut: BRAND_IMAGE_ICON_PATH,
      apple: BRAND_IMAGE_ICON_PATH,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
      yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        {/* Decide before first paint whether the opening splash plays: once per session, never in the admin, cabinet or 3D viewer. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement,p=location.pathname;var top=p.split('/')[1];var skip=top==='admin'||top==='cabinet'||top==='3d';var seen=${process.env.NODE_ENV === "production" ? "sessionStorage.getItem('oson-splash')" : "false"};if(skip||seen){d.dataset.splash='off'}else{d.dataset.splash='on';sessionStorage.setItem('oson-splash','1')}}catch(e){document.documentElement.dataset.splash='off'}})()`,
          }}
        />
        {/* Speed up first image (LCP): warm up the image CDN + API connections */}
        <link
          rel="preconnect"
          href="https://mzvqdchcqnococdzbktz.supabase.co"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://mzvqdchcqnococdzbktz.supabase.co" />
      </head>
      <body>
        <YandexMetrika />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SiteSplash />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
