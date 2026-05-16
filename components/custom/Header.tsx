"use client";

import Link from 'next/link';
import React from 'react';
import Image from 'next/image';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { CiGlobe } from "react-icons/ci";
import { cn } from '@/lib/utils';
import { BRAND_LOGO_WEB_REMOVEDBG } from '@/lib/brand';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerClose, DrawerTitle } from '../ui/drawer';

export default function Header() {
    const t = useTranslations("Header");
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    const handleLocaleChange = (newLocale: string) => {
        fetch("/api/locale", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locale: newLocale }),
        }).finally(() => router.refresh());
    };

    const languages = [
        { code: 'uz', name: "O'zbek" },
        { code: 'ru', name: 'Русский' },
        { code: 'en', name: 'English' },
    ];

    const navLinkStyles = (href: string) => cn(
        "relative inline-flex h-10 items-center pb-0.5 transition-all duration-300",
        "after:content-[''] after:absolute after:left-0 after:-bottom-0.5 after:h-[2px] after:bg-[#F97316] after:transition-all after:duration-300",
        pathname === href
            ? "text-[#1E3A8A] after:w-full"
            : "opacity-60 hover:opacity-100 after:w-0 hover:after:w-full"
    );

    return (
        <nav
            className={cn(
                "fixed inset-x-0 top-0 z-50 flex h-16 w-full items-center",
                "border-b border-slate-200/60 bg-white/55 shadow-sm backdrop-blur-xl backdrop-saturate-150",
                "supports-[backdrop-filter]:bg-white/45",
            )}
        >
            <div className="container mx-auto flex w-full max-w-[1250px] items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr] px-5">
                {/* Mobile: Left | Desktop: Left */}
                <Link
                    href="/"
                    aria-label={t("brand")}
                    className="order-1 flex shrink-0 items-center transition-transform active:scale-95 md:order-1"
                >
                    <Image
                        src={BRAND_LOGO_WEB_REMOVEDBG}
                        alt=""
                        width={216}
                        height={52}
                        className="h-9 w-auto max-h-10 max-w-[min(46vw,210px)] shrink-0 object-contain object-left md:h-[2.375rem] md:max-w-[268px]"
                        priority
                    />
                </Link>

                {/* Desktop: Center Navigation */}
                <div className="hidden md:flex h-10 items-center justify-center gap-7 font-semibold text-sm text-[#1E3A8A] md:order-2">
                    <Link href="/" className={navLinkStyles("/")}>{t("home")}</Link>
                    <Link href="/catalog" className={navLinkStyles("/catalog")}>{t("catalog")}</Link>
                    <Link href="/about" className={navLinkStyles("/about")}>{t("about")}</Link>
                </div>

                {/* Mobile: Right (Burger + Locale) | Desktop: Right */}
                <div className="flex items-center gap-1 md:gap-2 order-2 md:order-3 md:justify-end">
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center justify-center p-2 text-gray-500 hover:text-[#3C55BE] outline-none cursor-pointer transition-colors">
                                <CiGlobe className="h-6 w-6 md:h-7 md:w-7" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white z-[110] shadow-xl border-gray-100 rounded-xl">
                            {languages.map((lang) => (
                                <DropdownMenuItem
                                    key={lang.code}
                                    onClick={() => handleLocaleChange(lang.code)}
                                    className={cn(
                                        "cursor-pointer font-medium",
                                        locale === lang.code && "text-[#3C55BE] font-bold bg-slate-50"
                                    )}
                                >
                                    {lang.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="md:hidden p-2 text-[#1E3A8A] hover:bg-slate-100 rounded-xl transition-all active:scale-95 cursor-pointer"
                        aria-label="Toggle menu"
                    >
                        {isMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Drawer */}
            <Drawer open={isMenuOpen} onOpenChange={setIsMenuOpen} direction="right">
                <DrawerContent className="h-screen top-0 right-0 left-auto mt-0 w-[280px] rounded-none border-l shadow-2xl outline-none">
                    <div className="flex flex-col h-full bg-white">
                        <DrawerTitle></DrawerTitle>
                        <DrawerHeader className="border-b p-5 flex justify-between items-center text-left">
                            <Link
                                href="/"
                                aria-label={t("brand")}
                                className="order-1 flex shrink-0 items-center transition-transform active:scale-95 md:order-1"
                            >
                                <Image
                                    src={BRAND_LOGO_WEB_REMOVEDBG}
                                    alt=""
                                    width={216}
                                    height={52}
                                    className="h-9 w-auto max-h-10 max-w-[min(46vw,210px)] shrink-0 object-contain object-left md:h-[2.375rem] md:max-w-[268px]"
                                    priority
                                />
                            </Link>
                            <DrawerClose asChild>
                                <button className="p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer">
                                    <X className="h-5 w-5 text-slate-400" />
                                </button>
                            </DrawerClose>
                        </DrawerHeader>

                        <div className="flex flex-col p-6 gap-2">
                            <Link
                                href="/"
                                onClick={() => setIsMenuOpen(false)}
                                className={cn(
                                    "flex items-center px-4 py-3 rounded-xl text-lg font-bold transition-all",
                                    pathname === "/" ? "bg-blue-50 text-[#F97316]" : "text-[#1E3A8A] hover:bg-slate-50"
                                )}
                            >
                                {t("home")}
                            </Link>
                            <Link
                                href="/catalog"
                                onClick={() => setIsMenuOpen(false)}
                                className={cn(
                                    "flex items-center px-4 py-3 rounded-xl text-lg font-bold transition-all",
                                    pathname === "/catalog" ? "bg-blue-50 text-[#F97316]" : "text-[#1E3A8A] hover:bg-slate-50"
                                )}
                            >
                                {t("catalog")}
                            </Link>
                            <Link
                                href="/about"
                                onClick={() => setIsMenuOpen(false)}
                                className={cn(
                                    "flex items-center px-4 py-3 rounded-xl text-lg font-bold transition-all",
                                    pathname === "/about" ? "bg-blue-50 text-[#F97316]" : "text-[#1E3A8A] hover:bg-slate-50"
                                )}
                            >
                                {t("about")}
                            </Link>
                        </div>

                        <div className="mt-auto p-6 border-t bg-slate-50/50">
                            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-3">{t("home")}</p>
                            <div className="flex flex-wrap gap-2">
                                {languages.map((lang) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => {
                                            handleLocaleChange(lang.code);
                                            setIsMenuOpen(false);
                                        }}
                                        className={cn(
                                            "px-4 py-2 rounded-lg text-sm font-bold border transition-all cursor-pointer",
                                            locale === lang.code
                                                ? "bg-[#1E3A8A] border-[#1E3A8A] text-white shadow-lg shadow-blue-900/20"
                                                : "bg-white border-slate-200 text-slate-600 hover:border-blue-200"
                                        )}
                                    >
                                        {lang.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        </nav>
    );
}