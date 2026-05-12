import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Seo");
  const siteUrl = getSiteUrl();
  const title = t("termsTitle");
  const description = t("termsDescription");
  const locale = await getLocale();
  const canonical = `${siteUrl}/terms`;
  const ogImage = absoluteUrl("/osonuy-logo-removebg-preview.png");

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: t("siteName"),
      locale,
      type: "website",
      images: [{ url: ogImage, width: 800, height: 800, alt: t("ogImageAlt") }],
    },
  };
}

export default async function TermsPage() {
  const t = await getTranslations("Legal.terms");

  return (
    <div className="min-h-screen bg-white pb-24 pt-24 md:pt-28">
      <article className="mx-auto max-w-3xl px-4 md:px-8">
        <h1 className="text-3xl font-black uppercase tracking-tight text-[#1E3A8A] md:text-4xl">
          {t("h1")}
        </h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">{t("updated")}</p>
        <p className="mt-8 text-base font-medium leading-relaxed text-slate-700">{t("intro")}</p>

        <section className="mt-10">
          <h2 className="text-lg font-black text-[#1E3A8A]">{t("s1Title")}</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600 md:text-base">
            {t("s1Body")}
          </p>
        </section>
        <section className="mt-10">
          <h2 className="text-lg font-black text-[#1E3A8A]">{t("s2Title")}</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600 md:text-base">
            {t("s2Body")}
          </p>
        </section>
        <section className="mt-10">
          <h2 className="text-lg font-black text-[#1E3A8A]">{t("s3Title")}</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600 md:text-base">
            {t("s3Body")}
          </p>
        </section>
        <section className="mt-10">
          <h2 className="text-lg font-black text-[#1E3A8A]">{t("s4Title")}</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600 md:text-base">
            {t("s4Body")}
          </p>
        </section>
        <section className="mt-10">
          <h2 className="text-lg font-black text-[#1E3A8A]">{t("s5Title")}</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600 md:text-base">
            {t("s5Body")}
          </p>
        </section>
      </article>
    </div>
  );
}
