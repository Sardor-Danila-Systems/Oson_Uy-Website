"use client"
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";


export default function Footer() {
    const t = useTranslations("Footer");

    return (
        <footer className="bg-slate-50 w-full py-16 border-t border-slate-200 mt-auto">
            <div className="container grid grid-cols-1 md:grid-cols-4 gap-12 px-4 mx-auto">
                <div className="space-y-6">
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-bold tracking-tight text-[#1E3A8A]">
                            Oson<span className="text-[#F97316]">Uy</span>
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">
                        {t("description")}
                    </p>
                </div>
                <div className="space-y-6">
                    <h4 className="font-bold text-[#1E3A8A] text-xs uppercase tracking-[0.2em] opacity-50">{t("company")}</h4>
                    <ul className="space-y-3 text-sm font-semibold text-[#1E3A8A]/80">
                        <li><Link href="/about" className="hover:text-[#F97316]">{t("about")}</Link></li>
                        <li><Link href="/" className="hover:text-[#F97316]">{t("contact")}</Link></li>
                    </ul>
                </div>
                <div className="space-y-6">
                    <h4 className="font-bold text-[#1E3A8A] text-xs uppercase tracking-[0.2em] opacity-50">{t("legal")}</h4>
                    <ul className="space-y-3 text-sm font-semibold text-[#1E3A8A]/80">
                        <li><Link href="/" className="hover:text-[#F97316]">{t("privacy")}</Link></li>
                        <li><Link href="/" className="hover:text-[#F97316]">{t("terms")}</Link></li>
                    </ul>
                </div>
                <div className="space-y-6">
                    <h4 className="font-bold text-[#1E3A8A] text-xs uppercase tracking-[0.2em] opacity-50">{t("support")}</h4>
                    <ul className="space-y-3 text-sm font-semibold text-[#1E3A8A]/80">
                        <li><Link href="/" className="hover:text-[#F97316]">{t("faq")}</Link></li>
                        <li><Link href="/" className="hover:text-[#F97316]">{t("helpDesk")}</Link></li>
                        <li>
                            <a
                                href="https://www.instagram.com/oson_uy.uz/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-[#F97316]"
                            >
                                Instagram
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
            <div className="max-w-7xl mx-auto px-8 pt-12 mt-12 border-t border-slate-200">
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 text-center">
                    {t("copyright")}
                </p>
            </div>
        </footer>
    );
}