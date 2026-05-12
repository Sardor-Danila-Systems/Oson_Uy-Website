"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

const INSTAGRAM_URL = "https://www.instagram.com/oson_uy.uz/";

export default function Footer() {
  const t = useTranslations("Footer");
  const phone =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_CONTACT_PHONE
      ? process.env.NEXT_PUBLIC_CONTACT_PHONE.trim()
      : "";
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "";

  return (
    <footer className="mt-auto w-full border-t border-slate-200 bg-slate-50 py-14 md:py-16">
      <div className="container mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 md:grid-cols-12 md:gap-10 md:px-8">
        <div className="space-y-4 md:col-span-5">
          <span className="text-xl font-bold tracking-tight text-[#1E3A8A]">
            Oson<span className="text-[#F97316]">Uy</span>
          </span>
          <p className="max-w-md text-sm font-medium leading-relaxed text-slate-600">
            {t("description")}
          </p>
        </div>

        <div className="space-y-4 md:col-span-3">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1E3A8A]/50">
            {t("navTitle")}
          </h4>
          <ul className="space-y-2.5 text-sm font-semibold text-[#1E3A8A]/90">
            <li>
              <Link href="/about" className="hover:text-[#F97316]">
                {t("about")}
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="hover:text-[#F97316]">
                {t("faq")}
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-4 md:col-span-2">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1E3A8A]/50">
            {t("legalTitle")}
          </h4>
          <ul className="space-y-2.5 text-sm font-semibold text-[#1E3A8A]/90">
            <li>
              <Link href="/privacy" className="hover:text-[#F97316]">
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-[#F97316]">
                {t("terms")}
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-4 md:col-span-2">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1E3A8A]/50">
            {t("contactsTitle")}
          </h4>
          <ul className="space-y-3 text-sm font-semibold text-[#1E3A8A]/90">
            <li>
              {phone && telHref ? (
                <a href={telHref} className="hover:text-[#F97316]">
                  {t("phoneLabel")}: {phone}
                </a>
              ) : (
                <span className="text-slate-500">{t("phonePlaceholder")}</span>
              )}
            </li>
            <li>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#F97316]"
              >
                {t("instagramLabel")}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-slate-200 px-8 pt-8">
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {t("copyright")}
        </p>
      </div>
    </footer>
  );
}
