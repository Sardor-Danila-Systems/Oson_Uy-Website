import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import HomeClient from "@/components/home/HomeClient";
import { BRAND_IMAGE_OG_PATH } from "@/lib/brand";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Seo");
  const siteUrl = getSiteUrl();
  const title = t("homeTitle");
  const description = t("homeDescription");
  const keywords = t("defaultKeywords")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ogImage = absoluteUrl(BRAND_IMAGE_OG_PATH);
  const locale = await getLocale();

  return {
    title,
    description,
    keywords,
    alternates: { canonical: siteUrl + "/" },
    openGraph: {
      title,
      description,
      url: siteUrl + "/",
      siteName: t("siteName"),
      locale,
      type: "website",
      images: [{ url: ogImage, alt: t("ogImageAlt") }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
      site: t("twitterSite") || undefined,
    },
  };
}

export default function HomePage() {
  const siteUrl = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Oson Uy",
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl(BRAND_IMAGE_OG_PATH),
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "Oson Uy",
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: ["uz", "ru", "en"],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient />
    </>
  );
}
