import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import ProjectDetailClient from "./ProjectDetailClient";
import { absoluteUrl, getSiteUrl } from "@/lib/site";
import { fetchProjectJsonLd } from "@/lib/project-jsonld";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("Seo");
  const siteUrl = getSiteUrl();
  const canonical = `${siteUrl}/catalog/${id}`;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

  let title = t("defaultTitle");
  let description = t("defaultDescription");
  let ogImage = absoluteUrl("/osonuy-logo-removebg-preview.png");

  try {
    const res = await fetch(`${apiUrl}/projects/${id}/full`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const p = await res.json();
      const place = [p.district, p.location].filter(Boolean).join(", ");
      title = t("projectTitle", {
        name: p.name ?? "",
        location: p.location ?? "",
      });
      description = t("projectDescription", {
        name: p.name ?? "",
        place: place || (p.location ?? ""),
        delivery: p.deliveryDate ?? "—",
      });
      const rawImg =
        (p.imageUrl && String(p.imageUrl).trim()) ||
        p.media?.[0]?.imageUrl ||
        "";
      if (rawImg) {
        ogImage = rawImg.startsWith("http")
          ? rawImg
          : new URL(rawImg, siteUrl).toString();
      }
    }
  } catch {
    /* fallback metadata */
  }

  const keywords = t("defaultKeywords")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const locale = await getLocale();

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
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
    robots: { index: true, follow: true },
  };
}

export default async function CatalogProjectPage({ params }: PageProps) {
  const { id } = await params;
  const jsonLd = await fetchProjectJsonLd(id);

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <ProjectDetailClient params={params} />
    </>
  );
}
