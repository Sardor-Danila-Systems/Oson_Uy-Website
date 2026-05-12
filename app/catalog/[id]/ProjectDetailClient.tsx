"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
    MapPin,
    ChevronDown,
    CheckCircle2,
    Loader2,
    Star,
    QrCode,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    Layers,
    Building2,
    Ruler,
    Car,
    ArrowUpDown,
    Phone,
    Mail,
    Globe,
} from "lucide-react";
import type { CatalogProjectPreview } from "@/types";
import { formatUzsPerM2 } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FloorTower } from "@/components/custom/FloorTower";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    type CarouselApi,
} from "@/components/ui/carousel";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { LeadModal } from "@/components/custom/LeadModal";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type ProjectDetailClientProps = {
    params: Promise<{ id: string }>;
};

export default function ProjectDetailClient({ params }: ProjectDetailClientProps) {
    const t = useTranslations("ProjectDetails");
    const [projectData, setProjectData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [progressPhoto, setProgressPhoto] = useState<string | null>(null);

    const [api, setApi] = useState<CarouselApi>();
    const [current, setCurrent] = useState(0);
    const [count, setCount] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            const resolvedParams = await params;
            const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
            try {
                const response = await fetch(`${apiUrl}/projects/${resolvedParams.id}/full`, { cache: 'no-store' });
                if (response.ok) {
                    const data = await response.json();
                    setProjectData(data);
                }
            } catch (error) {
                console.error("Fetch error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [params]);

    useEffect(() => {
        if (!api) return;
        setCount(api.scrollSnapList().length);
        setCurrent(api.selectedScrollSnap());
        api.on("select", () => {
            setCurrent(api.selectedScrollSnap());
        });
    }, [api]);

    const gallery = useMemo(() => {
        if (!projectData) return [];
        if (projectData.media?.length > 0) {
            return projectData.media.map((item: any) => item.imageUrl).filter(Boolean);
        }
        return projectData.imageUrl ? [projectData.imageUrl] : [];
    }, [projectData]);

    const apiFloors = useMemo(() => {
        const raw = projectData?.floors ?? [];
        return raw.map((f: any) => ({
            ...f,
            areaOptions: f.areaOptions ?? [],
            layouts: f.layouts ?? [],
        }));
    }, [projectData]);

    const specRows = useMemo((): { Icon: LucideIcon; label: string; value: string }[] => {
        if (!projectData) return [];
        const rows: { Icon: LucideIcon; label: string; value: string }[] = [];
        rows.push({
            Icon: CreditCard,
            label: t("installment"),
            value: projectData.hasInstallment ? t("yes") : t("no"),
        });
        const materials = (projectData.materials ?? []) as string[];
        if (materials.length) {
            rows.push({
                Icon: Layers,
                label: t("materials"),
                value: materials.join(", "),
            });
        }
        if (projectData.buildingCount != null) {
            rows.push({
                Icon: Building2,
                label: t("buildingCount"),
                value: String(projectData.buildingCount),
            });
        }
        if (projectData.corpusCount != null) {
            rows.push({
                Icon: Building2,
                label: t("corpusCount"),
                value: String(projectData.corpusCount),
            });
        }
        if (projectData.ceilingHeightM != null) {
            rows.push({
                Icon: Ruler,
                label: t("ceilingHeight"),
                value: `${projectData.ceilingHeightM} ${t("metersShort")}`,
            });
        }
        if (projectData.hasSurfaceParking || (projectData.surfaceParkingSpaces ?? 0) > 0) {
            const extra =
                projectData.surfaceParkingSpaces != null
                    ? ` · ${t("surfaceSpaces")}: ${projectData.surfaceParkingSpaces}`
                    : "";
            rows.push({
                Icon: Car,
                label: t("parkingSurface"),
                value: `${projectData.hasSurfaceParking ? t("yes") : t("no")}${extra}`,
            });
        }
        if (projectData.hasUndergroundParking || (projectData.undergroundParkingSpaces ?? 0) > 0) {
            const extra =
                projectData.undergroundParkingSpaces != null
                    ? ` · ${t("undergroundSpaces")}: ${projectData.undergroundParkingSpaces}`
                    : "";
            rows.push({
                Icon: Car,
                label: t("parkingUnderground"),
                value: `${projectData.hasUndergroundParking ? t("yes") : t("no")}${extra}`,
            });
        }
        if (projectData.elevatorsCount != null) {
            rows.push({
                Icon: ArrowUpDown,
                label: t("elevators"),
                value: String(projectData.elevatorsCount),
            });
        }
        return rows;
    }, [projectData, t]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-10 w-10 animate-spin text-[#1E3A8A]" />
            </div>
        );
    }

    if (!projectData) {
        return (
            <div className="pt-24 pb-20 bg-slate-50 min-h-screen">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="rounded-3xl border border-red-100 bg-white p-8 text-red-600 font-bold text-center uppercase tracking-widest">
                        {t("notFound")}
                    </div>
                </div>
            </div>
        );
    }

    const hasFloors = apiFloors.length > 0;
    const fallbackQuery = `${projectData.location} ${projectData.district || ""}`;
    const mapSrc = projectData.mapEmbedUrl && projectData.mapEmbedUrl.includes("http")
        ? projectData.mapEmbedUrl
        : `https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${encodeURIComponent(projectData.mapEmbedUrl || fallbackQuery)}`;

    return (
        <div className="pt-16 md:pt-20 pb-20 bg-slate-50 min-h-screen">
            <Dialog open={progressPhoto != null} onOpenChange={(o) => !o && setProgressPhoto(null)}>
                <DialogContent className="w-[min(96vw,1680px)] max-w-[min(96vw,1680px)] max-h-[96vh] gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 sm:max-w-[min(96vw,1680px)] sm:rounded-2xl sm:p-3 md:p-4">
                    {progressPhoto ? (
                        <img
                            src={progressPhoto}
                            alt=""
                            className="mx-auto block max-h-[min(92vh,1400px)] w-full max-w-full object-contain bg-slate-50"
                        />
                    ) : null}
                </DialogContent>
            </Dialog>

            <div className="max-w-7xl mx-auto px-4 md:px-6">
                <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col md:flex-row items-stretch md:items-start mb-10 border border-slate-100">
                    <div className="w-full md:w-1/2 md:max-w-[50%] md:shrink-0 relative group flex flex-col md:sticky md:top-20">
                        <div className="relative aspect-[16/10] md:aspect-auto max-h-[450px] w-[calc(100%-1.5rem)] md:w-[calc(100%-2rem)] overflow-hidden shrink-0 rounded-[1.5rem] mt-3 mx-auto md:mt-4 md:mx-4 border border-slate-100 isolation-auto">
                            <Carousel
                                setApi={setApi}
                                opts={{ loop: true, align: "start" }}
                                className="h-full w-full"
                            >
                                <CarouselContent className="m-0 h-full flex">
                                    {(gallery.length ? gallery : [""]).map((img: string, index: number) => (
                                        <CarouselItem key={index} className="p-0 h-full basis-full grow-0 shrink-0">
                                            <div className="relative h-full w-full bg-slate-200">
                                                {img ? (
                                                    <img
                                                        src={img}
                                                        alt={projectData.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : null}
                                            </div>
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>

                                {gallery.length > 1 && (
                                    <div className="absolute inset-x-0 bottom-3 md:bottom-4 flex justify-center gap-1.5 z-20 pointer-events-auto">
                                        {Array.from({ length: count }).map((_, i) => (
                                            <button
                                                type="button"
                                                key={i}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    api?.scrollTo(i);
                                                }}
                                                className={cn(
                                                    "h-1 rounded-full transition-all duration-300",
                                                    current === i
                                                        ? "w-5 bg-white shadow-lg"
                                                        : "w-1 bg-white hover:bg-white"
                                                )}
                                            />
                                        ))}
                                    </div>
                                )}

                            </Carousel>
                            {gallery.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); api?.scrollPrev(); }}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center z-20"
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); api?.scrollNext(); }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center z-20"
                                    >
                                        <ChevronRight className="h-5 w-5" />
                                    </button>
                                </>
                            )}
                        </div>

                        {gallery.length > 1 ? (
                            <div className="z-[5] border-t border-white bg-white backdrop-blur-md px-2 py-2.5 md:px-3 md:py-3">
                                <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
                                    {gallery.map((thumb: string, i: number) => (
                                        <button
                                            key={`thumb-${i}-${thumb.slice(-24)}`}
                                            type="button"
                                            onClick={() => api?.scrollTo(i)}
                                            className={cn(
                                                "relative h-14 w-[5.5rem] shrink-0 overflow-hidden rounded-xl border-2 transition-all md:h-16 md:w-24",
                                                current === i
                                                    ? "border-[#F97316] ring-2 ring-[#F97316]/40 shadow-lg scale-[1.02]"
                                                    : "border-white opacity-90 hover:border-white hover:opacity-100",
                                            )}
                                        >
                                            {thumb ? (
                                                <img
                                                    src={thumb}
                                                    alt=""
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : null}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <div className="absolute top-[calc(0.75rem+12px)] left-[calc(0.75rem+12px)] md:top-10 md:left-10 flex flex-col gap-1.5 z-30 pointer-events-none">
                            {(projectData.topInCatalog || projectData.topInHome) && (
                                <Badge className="bg-[#FB7185] text-white border-none px-2.5 py-0.5 md:px-4 md:py-1.5 text-[10px] md:text-xs font-black uppercase tracking-widest shadow-xl shadow-rose-900/20 whitespace-nowrap w-fit">
                                    Popular
                                </Badge>
                            )}
                            <Badge className="bg-[#F97316] text-white border-none px-2.5 py-0.5 md:px-4 md:py-1.5 text-[10px] md:text-xs font-black uppercase tracking-widest shadow-xl shadow-orange-900/20 whitespace-nowrap w-fit">
                                {projectData.plan || "PREMIUM"}
                            </Badge>
                        </div>
                    </div>

                    <div className="w-full md:w-1/2 md:min-w-0 p-6 md:p-12 flex flex-col md:justify-start bg-white">
                        <div className="flex items-center gap-2 mb-4">
                            <h1 className="text-2xl md:text-4xl font-black text-[#1E3A8A] uppercase tracking-tight leading-none">
                                {projectData.name}
                            </h1>
                            {(projectData.plan === "PRO" || projectData.plan === "ULTIMATE") && (
                                <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-emerald-500 shadow-sm" />
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 mb-6">
                            <div className="flex items-center text-[#F97316] font-bold text-sm md:text-base">
                                <MapPin className="w-4 h-4 mr-2" />
                                {projectData.location}{projectData.district ? `, ${projectData.district}` : ""}
                            </div>
                            {projectData.avgRating ? (
                                <div className="flex items-center bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
                                    <Star className="h-4 w-4 fill-orange-400 text-orange-400 mr-1.5" />
                                    <span className="font-bold text-orange-700">{projectData.avgRating.toFixed(1)}</span>
                                    <span className="text-orange-400 text-[10px] md:text-xs ml-1 font-semibold">({projectData.reviewsCount} {t("noComment").toLowerCase()})</span>
                                </div>
                            ) : null}
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                            <div className="bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-100 text-center flex flex-col justify-center">
                                <p className="text-[9px] md:text-[10px] uppercase font-black text-slate-400 mb-1">{t("delivery")}</p>
                                <p className="text-[#1E3A8A] font-bold text-xs md:text-sm leading-tight">{projectData.deliveryDate}</p>
                            </div>
                            <div className="bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-100 text-center flex flex-col justify-center">
                                <p className="text-[9px] md:text-[10px] uppercase font-black text-slate-400 mb-1">{t("floors")}</p>
                                <p className="text-[#1E3A8A] font-bold text-xs md:text-sm leading-tight">{projectData.totalFloors || "—"}</p>
                            </div>
                            <div className="bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-100 text-center flex flex-col justify-center">
                                <p className="text-[9px] md:text-[10px] uppercase font-black text-slate-400 mb-1">{t("units")}</p>
                                <p className="text-[#1E3A8A] font-bold text-xs md:text-sm leading-tight">{projectData.totalUnits || apiFloors.length || "—"}</p>
                            </div>
                            {projectData.qrCodeUrl ? (
                                <div
                                    onClick={() => setIsQrModalOpen(true)}
                                    className="bg-[#1E3A8A] p-2 rounded-2xl border border-[#1E3A8A] text-center flex flex-col items-center justify-center group cursor-pointer hover:bg-[#3C55BE] transition-colors relative"
                                >
                                    <img
                                        src={projectData.qrCodeUrl}
                                        className="h-8 w-8 md:h-10 md:w-10 bg-white p-1 rounded-lg shadow-lg mb-1"
                                        alt="QR"
                                    />
                                    <p className="text-[8px] uppercase font-black text-white/80 leading-tight">{t("qrTitle")}</p>
                                </div>
                            ) : (
                                <div className="bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-100 text-center flex flex-col justify-center">
                                    <p className="text-[9px] md:text-[10px] uppercase font-black text-slate-400 mb-1">{t("status")}</p>
                                    <p className="text-emerald-600 font-bold text-[10px] md:text-xs uppercase tracking-tighter">{t("available")}</p>
                                </div>
                            )}
                        </div>

                        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
                            <CollapsibleTrigger asChild>
                                <Button variant="outline" className="w-full justify-between rounded-xl h-11 border-slate-200 text-[#1E3A8A] font-bold uppercase text-[10px] tracking-widest">
                                    {isOpen ? t("hideDetails") : t("showDetails")}
                                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-4 space-y-4 overflow-hidden">
                                {projectData.description && (
                                    <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed">
                                        {projectData.description}
                                    </p>
                                )}
                                {projectData.advantages && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {projectData.advantages.map((adv: string, i: number) => (
                                            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-100 shadow-sm">
                                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                                <span className="text-[9px] font-bold text-slate-700 uppercase leading-tight">{adv}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {projectData.materials?.length ? (
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t("materials")}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {projectData.materials.map((m: string, i: number) => (
                                                <span key={i} className="text-xs font-bold text-slate-700 bg-white border border-slate-100 rounded-lg px-3 py-1.5">
                                                    {m}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </CollapsibleContent>
                        </Collapsible>

                        <div className="flex flex-col sm:flex-row gap-3 mt-8">
                            <Button
                                onClick={() => setIsLeadModalOpen(true)}
                                className="flex-1 h-14 bg-[#F97316] hover:bg-orange-600 text-white font-black text-lg rounded-2xl shadow-xl shadow-orange-900/10 transition-all active:scale-[0.98] uppercase tracking-wider"
                            >
                                {t("leaveRequest")}
                            </Button>
                            {projectData.qrCodeUrl && (
                                <button
                                    onClick={() => setIsQrModalOpen(true)}
                                    className="h-14 w-14 cursor-pointer bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-center text-[#1E3A8A] hover:bg-slate-50 transition-all shadow-sm"
                                >
                                    <QrCode className="h-6 w-6" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
                    <DialogContent className="max-w-xs sm:max-w-md rounded-[2.5rem] border-none shadow-2xl p-10 flex flex-col items-center">
                        <DialogHeader className="mb-6 text-center w-full">
                            <DialogTitle className="text-2xl font-black text-[#1E3A8A] uppercase tracking-tight">{t("qrTitle")}</DialogTitle>
                            <p className="text-slate-500 text-sm font-medium mt-1">{t("qrSubtitle")}</p>
                        </DialogHeader>
                        <div className="bg-white p-8 rounded-[2rem] shadow-inner border border-slate-50 w-full flex justify-center">
                            <img
                                src={projectData.qrCodeUrl}
                                alt="QR Code Large"
                                className="w-full max-w-[250px] aspect-square object-contain"
                            />
                        </div>
                        <Button
                            onClick={() => setIsQrModalOpen(false)}
                            className="mt-8 w-full h-14 bg-slate-200 hover:bg-slate-400 cursor-pointer text-slate-600 font-bold rounded-2xl uppercase tracking-widest text-xs"
                        >
                            {t("close")}
                        </Button>
                    </DialogContent>
                </Dialog>

                {specRows.length > 0 ? (
                    <div className="mb-10 rounded-[2.5rem] border border-slate-100 bg-white p-6 md:p-10 shadow-sm">
                        <h2 className="text-xl md:text-2xl font-black text-[#1E3A8A] mb-6 uppercase tracking-tight">
                            {t("specsTitle")}
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                            {specRows.map((row, idx) => (
                                <div
                                    key={`${row.label}-${idx}`}
                                    className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
                                >
                                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#1E3A8A] shadow-sm border border-slate-100">
                                        <row.Icon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{row.label}</p>
                                        <p className="text-sm font-bold text-slate-900 mt-1 break-words">{row.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {Array.isArray(projectData?.progress?.milestones) &&
                    projectData.progress.milestones.length > 0 ? (
                    <div className="mb-10 rounded-[2.5rem] border border-slate-100 bg-white p-6 md:p-10 shadow-sm">
                        <div className="flex items-center justify-between gap-4 mb-6">
                            <h2 className="text-xl md:text-2xl font-black text-[#1E3A8A] uppercase tracking-tight">
                                {t("progressTitle")}
                            </h2>
                            <div className="text-sm font-black text-slate-900">
                                {projectData.progress.percent != null ? `${projectData.progress.percent}%` : "—"}
                            </div>
                        </div>

                        <Progress value={projectData.progress.percent ?? 0} className="h-3" />

                        <div className="mt-6 space-y-3">
                            {(projectData.progress.milestones ?? [])
                                .slice()
                                .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                                .filter((m: any) => Boolean(m))
                                .map((m: any, idx: number) => (
                                    <div key={m.id ?? idx} className="space-y-2">
                                        <div className="flex items-start gap-3">
                                            {m.done ? (
                                                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                                            ) : (
                                                <div className="h-5 w-5 shrink-0 mt-0.5 rounded-full border-2 border-slate-300" />
                                            )}
                                            <div className="min-w-0">
                                                <p className={cn("text-sm font-bold break-words", m.done ? "text-slate-900" : "text-slate-700")}>
                                                    {m.title}
                                                </p>
                                            </div>
                                        </div>

                                        {Array.isArray(m.photoUrls) && m.photoUrls.length > 0 ? (
                                            <div className="flex gap-2 overflow-x-auto pl-8 pb-1">
                                                {m.photoUrls.slice(0, 8).map((url: string) => (
                                                    <button
                                                        key={url}
                                                        type="button"
                                                        onClick={() => setProgressPhoto(url)}
                                                        className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
                                                        aria-label="Open photo"
                                                    >
                                                        <img
                                                            src={url}
                                                            alt=""
                                                            className="h-14 w-20 object-cover"
                                                            loading="lazy"
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                        </div>

                        {(projectData.progress.milestones ?? []).length > 0 ? (
                            <p className="mt-6 text-xs font-semibold text-slate-500">
                                {t("progressDone", {
                                    done: projectData.progress.done ?? 0,
                                    total:
                                        projectData.progress.total ??
                                        projectData.progress.milestones.length,
                                })}
                            </p>
                        ) : null}
                    </div>
                ) : null}

                {(() => {
                    const dev = projectData.developer;
                    if (!dev?.name) return null;
                    const web = (dev.website || "").trim();
                    const webHref = !web ? "" : web.startsWith("http") ? web : `https://${web}`;
                    return (
                        <div className="mb-10 rounded-[2.5rem] border border-slate-100 bg-white p-6 md:p-10 shadow-sm">
                            <h2 className="text-xl md:text-2xl font-black text-[#1E3A8A] mb-6 uppercase tracking-tight">
                                {t("developerTitle")}
                            </h2>
                            <div className="flex flex-col gap-6 md:flex-row md:items-start">
                                {dev.logoUrl ? (
                                    <div className="shrink-0 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                                        <img src={dev.logoUrl} alt="" className="h-20 w-20 object-contain md:h-24 md:w-24" />
                                    </div>
                                ) : null}
                                <div className="min-w-0 flex-1 space-y-4">
                                    <p className="text-lg font-black text-slate-900">{dev.name}</p>
                                    <div className="flex flex-col gap-2 text-sm">
                                        {dev.phone ? (
                                            <a href={`tel:${dev.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 font-semibold text-[#1E3A8A] hover:underline">
                                                <Phone className="h-4 w-4 shrink-0" />
                                                {dev.phone}
                                            </a>
                                        ) : null}
                                        {dev.email ? (
                                            <a href={`mailto:${dev.email}`} className="flex items-center gap-2 font-semibold text-[#1E3A8A] hover:underline break-all">
                                                <Mail className="h-4 w-4 shrink-0" />
                                                {dev.email}
                                            </a>
                                        ) : null}
                                        {webHref ? (
                                            <a href={webHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-semibold text-[#1E3A8A] hover:underline break-all">
                                                <Globe className="h-4 w-4 shrink-0" />
                                                {web}
                                            </a>
                                        ) : null}
                                        {dev.legalAddress ? (
                                            <p className="text-slate-600">
                                                <span className="font-bold text-slate-800">{t("legalAddressLabel")}: </span>
                                                {dev.legalAddress}
                                            </p>
                                        ) : null}
                                        {dev.officeAddress ? (
                                            <p className="text-slate-600">
                                                <span className="font-bold text-slate-800">{t("officeAddressLabel")}: </span>
                                                {dev.officeAddress}
                                            </p>
                                        ) : null}
                                    </div>
                                    {dev.description ? (
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t("developerAbout")}</p>
                                            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{dev.description}</p>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                <RelatedProjectsCarousel title={t("siblingsTitle")} items={projectData.siblingProjects as CatalogProjectPreview[] | undefined} />
                <RelatedProjectsCarousel title={t("nearbyTitle")} items={projectData.nearbyProjects as CatalogProjectPreview[] | undefined} />

                {projectData.videoUrl && (
                    <div className="mb-12 bg-white rounded-[2.5rem] border border-slate-100 p-8 md:p-12 shadow-sm">
                        <div className="flex min-w-0 flex-col md:flex-row gap-10 items-center">
                            <div className="w-full min-w-0 max-w-full md:w-[350px] md:shrink-0">
                                <div className="rounded-3xl overflow-hidden shadow-2xl bg-black border border-slate-200 [transform:translateZ(0)] isolate">
                                    <VideoPlayer url={projectData.videoUrl} />
                                </div>
                            </div>
                            <div className="flex-1 space-y-4">
                                <h2 className="text-2xl font-black text-[#1E3A8A] uppercase tracking-tight italic">{t("videoReview")}</h2>
                                <p className="text-slate-500 font-medium leading-relaxed">
                                    {t("videoReviewText")}
                                </p>
                                <div className="pt-4 flex items-center gap-3 text-emerald-600 font-bold text-sm">
                                    <CheckCircle2 className="h-5 w-5" />
                                    <span>{t("exclusiveFootage")}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mb-10 rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
                    <iframe
                        src={mapSrc}
                        className="w-full h-80"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                    />
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8 mb-10">
                    <h2 className="text-2xl font-black text-[#1E3A8A] mb-6 uppercase">
                        {hasFloors ? t("floorStackTitle") : t("availableResidences")}
                    </h2>
                    {hasFloors ? (
                        <FloorTower
                            projectId={projectData.id}
                            projectName={projectData.name}
                            floors={apiFloors}
                            totalFloorsHint={projectData.totalFloors}
                        />
                    ) : (
                        <p className="text-center text-sm font-semibold text-slate-500">
                            {t("floorNotPublished")}
                        </p>
                    )}
                </div>

                {projectData.reviews?.length > 0 && (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black text-[#1E3A8A] uppercase">{t("customerReviews")}</h2>
                            <div className="flex items-center gap-2">
                                <Star className="h-6 w-6 fill-orange-400 text-orange-400" />
                                <span className="text-2xl font-black text-slate-800">{projectData.avgRating?.toFixed(1)}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {projectData.reviews.map((review: any, i: number) => (
                                <div key={i} className="bg-slate-50 rounded-2xl p-6 border border-slate-100 relative">
                                    <div className="flex text-orange-400 mb-4">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <svg key={star} className={`h-4 w-4 ${star <= review.rating ? "fill-orange-400" : "fill-slate-200 text-slate-200"}`} viewBox="0 0 20 20">
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                            </svg>
                                        ))}
                                    </div>
                                    <p className="text-slate-700 italic text-sm leading-relaxed">
                                        "{review.comment || t("noComment")}"
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <LeadModal
                isOpen={isLeadModalOpen}
                onClose={() => setIsLeadModalOpen(false)}
                projectId={projectData.id}
                projectName={projectData.name}
            />
        </div>
    );
}

function RelatedProjectsCarousel({
    title,
    items,
}: {
    title: string;
    items: CatalogProjectPreview[] | undefined;
}) {
    const t = useTranslations("ProjectDetails");
    const [api, setApi] = useState<CarouselApi>();
    const [current, setCurrent] = useState(0);
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!api) return;
        setCount(api.scrollSnapList().length);
        setCurrent(api.selectedScrollSnap());
        api.on("select", () => {
            setCurrent(api.selectedScrollSnap());
        });
    }, [api]);

    if (!items?.length) return null;

    return (
        <div className="mb-10 md:mb-12">
            <h2 className="text-xl md:text-2xl font-black text-[#1E3A8A] mb-4 md:mb-6 uppercase tracking-tight">
                {title}
            </h2>
            <Carousel setApi={setApi} opts={{ loop: false, align: "start" }} className="w-full">
                <CarouselContent className="-ml-2 md:-ml-3">
                    {items.map((p) => (
                        <CarouselItem
                            key={p.id}
                            className="pl-2 md:pl-3 basis-full sm:basis-1/2 lg:basis-1/3"
                        >
                            <Link
                                href={`/catalog/${p.id}`}
                                className="block group h-full rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-lg hover:border-slate-300 transition-all"
                            >
                                <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                                    {p.imageUrl ? (
                                        <img
                                            src={p.imageUrl}
                                            alt=""
                                            className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                                        />
                                    ) : null}
                                </div>
                                <div className="p-4">
                                    <p className="font-black text-[#1E3A8A] uppercase tracking-tight text-sm leading-snug line-clamp-2 group-hover:text-orange-600 transition-colors">
                                        {p.name}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1.5 font-medium line-clamp-1">
                                        {[p.district, p.location].filter(Boolean).join(", ")}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2 mt-3">
                                        {p.priceFrom != null && p.priceFrom > 0 ? (
                                            <span className="text-xs font-black text-[#F97316]">
                                                {t("priceFromShort")} {formatUzsPerM2(p.priceFrom)}/{t("perM2")}
                                            </span>
                                        ) : null}
                                        {p.hasInstallment ? (
                                            <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                                                {t("installment")}
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 tracking-wide">
                                        {p.deliveryDate}
                                    </p>
                                </div>
                            </Link>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                {count > 1 ? (
                    <div className="flex justify-center gap-1.5 mt-4">
                        {Array.from({ length: count }).map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Slide ${i + 1}`}
                                onClick={() => api?.scrollTo(i)}
                                className={cn(
                                    "h-1.5 rounded-full transition-all duration-300",
                                    current === i ? "w-6 bg-[#1E3A8A]" : "w-1.5 bg-slate-300 hover:bg-slate-400",
                                )}
                            />
                        ))}
                    </div>
                ) : null}
            </Carousel>
        </div>
    );
}

function VideoPlayer({ url }: { url: string }) {
    const getYoutubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const isInstagram = url.includes("instagram.com");
    const getInstagramEmbed = (url: string) => {
        const cleanUrl = url.split("?")[0];
        return `${cleanUrl.endsWith("/") ? cleanUrl : cleanUrl + "/"}embed`;
    };

    const youtubeId = getYoutubeId(url);
    if (youtubeId) {
        return (
            <div className="aspect-video w-full max-w-full overflow-hidden bg-slate-900">
                <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    title="YouTube"
                    className="block h-full w-full max-w-full rounded-3xl border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>
        );
    }

    if (isInstagram) {
        return (
            <div className="flex w-full max-w-full justify-center overflow-hidden bg-black">
                <iframe
                    src={getInstagramEmbed(url)}
                    title="Instagram"
                    className="block h-[min(550px,78dvh)] w-full max-w-full rounded-3xl border-0 md:h-[650px]"
                    frameBorder="0"
                    scrolling="no"
                    allow="encrypted-media"
                />
            </div>
        );
    }

    return (
        <div className="aspect-[9/16] w-full max-w-full overflow-hidden bg-black">
            <video
                controls
                playsInline
                className="h-full w-full max-w-full rounded-3xl object-cover"
            >
                <source src={url} type="video/mp4" />
                Your browser does not support the video tag.
            </video>
        </div>
    );
}