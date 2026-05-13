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
    <html lang={locale} className={cn("font-sans", geist.variable)}>
      <head>
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header />
          <main className="pt-16">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
