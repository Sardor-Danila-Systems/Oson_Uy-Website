import type { Metadata } from "next";
import { Shield, Users, BarChart3, Globe, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLocale, getTranslations } from "next-intl/server";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("Seo");
    const siteUrl = getSiteUrl();
    const title = t("aboutTitle");
    const description = t("aboutDescription");
    const keywords = t("defaultKeywords")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const ogImage = absoluteUrl("/osonuy-logo-removebg-preview.png");
    const locale = await getLocale();
    const canonical = `${siteUrl}/about`;

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
            images: [{ url: ogImage, width: 800, height: 800, alt: t("ogImageAlt") }],
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

export default async function About() {
    const t = await getTranslations("About");

    const stats = [
        { label: t("stats.developers"), value: "24+", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
        { label: t("stats.projects"), value: "120+", icon: Globe, color: "text-orange-600", bg: "bg-orange-50" },
        { label: t("stats.transactions"), value: "1,500+", icon: BarChart3, color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: t("stats.verified"), value: "100%", icon: Shield, color: "text-purple-600", bg: "bg-purple-50" },
    ];

    return (
        <div className="md:pt-20 lg:pt-5 pb-24 min-h-screen bg-white">
            <div className="w-full px-4 md:px-8 max-w-7xl mx-auto space-y-40">

                <div className="grid grid-cols-1 lg:grid-cols-11 gap-12 lg:gap-20 items-start lg:items-center">
                    <div className="lg:col-span-6 space-y-7 md:space-y-10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 border border-orange-100">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                            </span>
                            <span className="text-xs font-black uppercase tracking-widest text-orange-700">{t("trustScore")}</span>
                        </div>

                        <h1 className="text-3xl sm:text-4xl md:text-7xl font-black text-[#1E3A8A] tracking-tighter leading-[1.05] md:leading-[0.9] uppercase italic">
                            {t("title1")} <br />
                            <span className="text-[#F97316] not-italic">{t("titleAccent")}</span>
                        </h1>

                        <p className="text-sm sm:text-base md:text-2xl text-slate-500 font-medium leading-relaxed tracking-tight max-w-2xl">
                            {t("description")}
                        </p>

                        <div className="flex flex-wrap gap-3 sm:gap-4">
                            <Button className="bg-[#1E3A8A] hover:bg-blue-900 text-white px-8 h-16 rounded-2xl font-bold text-lg group transition-all">
                                {t("learnMore")}
                                <ArrowUpRight className="ml-2 w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            </Button>
                            <div className="flex -space-x-4 items-center ml-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="w-12 h-12 rounded-full border-4 border-white bg-slate-200 overflow-hidden">
                                        <img src={`https://i.pravatar.cc/150?u=${i}`} alt="user" />
                                    </div>
                                ))}
                                <div className="pl-8 text-sm font-bold text-slate-400 uppercase tracking-tighter">
                                    {t("trustedBy")}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-5 relative mt-2 md:mt-0">
                        <div className="relative aspect-[4/5] rounded-[4rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(30,58,138,0.25)] group">
                            <img
                                src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1000&auto=format&fit=crop"
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                alt="Modern Architecture Tashkent"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#1E3A8A]/60 via-transparent to-transparent"></div>

                            <div className="absolute bottom-8 left-8 right-8 bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-xl">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-[#1E3A8A] uppercase">{t("stats.verified")}</p>
                                        <p className="text-xs text-slate-500 font-bold">{t("agency")}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-100 rounded-full blur-3xl opacity-50 -z-10"></div>
                        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-blue-100 rounded-full blur-3xl opacity-50 -z-10"></div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-10">
                    {stats.map((stat, i) => (
                        <div key={i} className="bg-slate-50 p-8 lg:p-12 rounded-[3rem] space-y-6 hover:bg-white hover:shadow-2xl hover:shadow-blue-900/5 transition-all duration-500 group border border-transparent hover:border-slate-100">
                            <div className={`w-16 h-16 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center group-hover:rotate-12 transition-transform`}>
                                <stat.icon className="h-8 w-8" />
                            </div>
                            <div>
                                <p className="text-5xl font-black text-[#1E3A8A] tracking-tighter">{stat.value}</p>
                                <p className="text-xs text-slate-400 font-black uppercase tracking-[0.2em] mt-3 leading-none">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="relative rounded-[5rem] overflow-hidden">
                    <div className="absolute inset-0">
                        <img
                            src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2000&auto=format&fit=crop"
                            className="w-full h-full object-cover opacity-20 grayscale"
                            alt="Background skyscraper"
                        />
                        <div className="absolute inset-0 bg-[#1E3A8A] mix-blend-multiply"></div>
                    </div>

                    <div className="relative z-10 px-8 py-24 md:py-32 text-center space-y-12 max-w-5xl mx-auto">
                        <div className="space-y-6">
                            <div className="inline-block px-6 py-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm text-[#F97316] text-xs font-black uppercase tracking-[0.5em]">
                                {t("commitment")}
                            </div>
                            <h2 className="text-5xl md:text-[5.5rem] font-black text-white tracking-tight leading-[0.95] uppercase italic">
                                {t("secure")}
                            </h2>
                            <p className="text-xl md:text-2xl text-blue-100/70 font-medium leading-relaxed max-w-3xl mx-auto tracking-tight">
                                {t("secureText")}
                            </p>
                        </div>

                        <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
                            <Button className="bg-[#F97316] hover:bg-orange-600 text-white px-14 h-20 rounded-[2rem] font-black text-xl shadow-2xl shadow-orange-950/40 active:scale-95 transition-all w-full md:w-auto uppercase tracking-tighter">
                                {t("startJourney")}
                            </Button>
                            <div className="flex flex-col items-start px-6 py-4 border-l border-white/20 text-left">
                                <p className="text-white font-black text-lg leading-none">{t("support")}</p>
                                <p className="text-blue-300/60 text-sm font-bold uppercase mt-1">{t("readyToAssist")}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}