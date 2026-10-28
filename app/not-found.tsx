import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Signal404 from "@/components/ui/signal-404";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotFound");
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <Signal404 label="404">
      <div className="w-full max-w-md rounded-3xl border border-white/20 bg-[#1e3a8a]/80 p-6 text-center text-white shadow-2xl backdrop-blur-md md:p-7">
        <h2 className="text-xl font-black leading-tight md:text-2xl">{t("title")}</h2>
        <p className="mt-2 text-sm font-medium text-white/80 md:text-base">{t("text")}</p>
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#F97316] px-7 text-sm font-black uppercase tracking-wide text-white transition hover:bg-[#EA580C] active:scale-95"
          >
            {t("home")}
          </Link>
          <Link
            href="/catalog"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/40 px-7 text-sm font-bold text-white transition hover:bg-white/10 active:scale-95"
          >
            {t("catalog")}
          </Link>
        </div>
      </div>
    </Signal404>
  );
}
