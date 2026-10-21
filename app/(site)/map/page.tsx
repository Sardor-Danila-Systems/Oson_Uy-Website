import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BRAND_IMAGE_OG_PATH } from "@/lib/brand";
import { absoluteUrl, getSiteUrl } from "@/lib/site";
import UzbekistanMap from "@/components/map/UzbekistanMap";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Map");
  const locale = await getLocale();
  const canonical = `${getSiteUrl()}/map`;
  const ogImage = absoluteUrl(BRAND_IMAGE_OG_PATH);
  const title = t("metaTitle");
  const description = t("metaDescription");

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Oson Uy",
      locale,
      type: "website",
      images: [{ url: ogImage, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default function MapPage() {
  return <UzbekistanMap />;
}
