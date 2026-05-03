"use client";

import React, { useMemo, useState, useEffect } from "react";
import { MapPin, Star, CheckCircle2, ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { Project } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LeadModal } from "@/components/custom/LeadModal";
import { formatUzsPerM2 } from "@/lib/currency";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

export interface ProjectCardProps {
    project: Project;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
    const t = useTranslations("ProjectCard");
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
    const [api, setApi] = useState<CarouselApi>();
    const [current, setCurrent] = useState(0);
    const [count, setCount] = useState(0);

    const gallery = useMemo(
        () =>
            project.images?.length
                ? project.images
                : [project.image || project.mainImage].filter(Boolean),
        [project.images, project.image, project.mainImage],
    );

    useEffect(() => {
        if (!api) return;
        setCount(api.scrollSnapList().length);
        setCurrent(api.selectedScrollSnap());

        api.on("select", () => {
            setCurrent(api.selectedScrollSnap());
        });
    }, [api]);

    return (
        <Card className="group relative overflow-hidden rounded-[2rem] bg-white shadow-sm transition-all duration-500 border border-slate-200 flex flex-col hover:shadow-2xl hover:shadow-blue-900/10 hover:-translate-y-1">
            <div className="relative aspect-[16/10] overflow-hidden">
                <Carousel 
                    setApi={setApi}
                    opts={{ loop: true, align: "start" }} 
                    className="h-full w-full"
                >
                    <CarouselContent className="m-0 h-full flex">
                        {(gallery.length ? gallery : [""]).map((image, index) => (
                            <CarouselItem key={`${project.id}-${index}`} className="p-0 h-full basis-full grow-0 shrink-0 overflow-hidden">
                                {image ? (
                                    <img
                                        src={image}
                                        alt={`${project.name} ${index + 1}`}
                                        className="h-full w-full object-cover transition-opacity duration-500"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <div className="h-full w-full bg-slate-200" />
                                )}
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    
                    {gallery.length > 1 && (
                        <>
                            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 z-20">
                                {Array.from({ length: count }).map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            api?.scrollTo(i);
                                        }}
                                        className={cn(
                                            "h-1.5 rounded-full transition-all duration-300",
                                            current === i 
                                                ? "w-6 bg-white shadow-lg" 
                                                : "w-1.5 bg-white/40 hover:bg-white/60"
                                        )}
                                    />
                                ))}
                            </div>
                            
                            <button 
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    api?.scrollPrev();
                                }}
                                className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center hover:bg-white hover:text-primary z-20"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button 
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    api?.scrollNext();
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center hover:bg-white hover:text-primary z-20"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </>
                    )}
                </Carousel>

                <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
                    {(project.isPopular || project.plan === "ULTIMATE") && (
                        <Badge className="bg-[#FB7185] text-white text-[10px] font-black px-3 py-1 rounded-full border-none uppercase tracking-widest shadow-lg shadow-rose-900/20">
                            {t("popular")}
                        </Badge>
                    )}
                    {(project.badgeTrusted || project.plan === "ULTIMATE") && (
                        <Badge className="bg-emerald-600 text-white text-[10px] font-black px-3 py-1 rounded-full border-none uppercase tracking-widest shadow-lg shadow-emerald-900/20">
                            {t("topChoice")}
                        </Badge>
                    )}
                </div>
            </div>

            <CardContent className="p-6 flex-1 flex flex-col">
                <div className="mb-4 flex items-start justify-between gap-2">
                    <h3 className="text-xl font-black text-[#1E3A8A] leading-tight uppercase tracking-tight">
                        {project.name}
                    </h3>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t("fromPerM2")}</p>
                        <span className="text-xl font-black text-[#F97316] tracking-tighter">
                            {project.priceFrom > 0 ? formatUzsPerM2(project.priceFrom) : "—"}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-3 mb-6">
                    <p className="text-sm text-slate-500 leading-relaxed flex items-center gap-1.5 font-bold">
                        <MapPin className="h-4 w-4 text-[#F97316]" /> {project.district || project.location},{" "}
                        {project.location}
                    </p>
                    
                    {(project.badgeVerified || project.plan === "PRO" || project.plan === "ULTIMATE") && (
                        <div className="flex items-center gap-2 bg-emerald-50 w-fit px-3 py-1 rounded-full border border-emerald-100">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">{t("verifiedDeveloper")}</span>
                        </div>
                    )}

                    {project.hasInstallment ? (
                        <div className="flex items-center gap-2 bg-sky-50 w-fit px-3 py-1 rounded-full border border-sky-100">
                            <CreditCard className="h-3.5 w-3.5 text-sky-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-sky-800">{t("installment")}</span>
                        </div>
                    ) : null}

                    <div className="flex items-center gap-2 text-sm">
                        <div className="flex items-center bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
                            <Star className="h-3.5 w-3.5 fill-orange-400 text-orange-400 mr-1.5" />
                            <span className="font-black text-orange-700">
                                {project.avgRating ? project.avgRating.toFixed(1) : "—"}
                            </span>
                        </div>
                        <span className="text-slate-400 font-bold text-xs uppercase">({project.reviewsCount ?? 0} {t("reviews")})</span>
                    </div>
                </div>

                <div className="mt-auto flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-slate-50">
                    <Link href={`/catalog/${project.id}`} className="w-full sm:flex-1">
                        <Button
                            variant="outline"
                            className="w-full border-slate-200 text-[#1E3A8A] text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 h-12 transition-all active:scale-[0.98]"
                        >
                            {t("details")}
                        </Button>
                    </Link>
                    <Button
                        onClick={() => setIsLeadModalOpen(true)}
                        className="w-full sm:flex-1 bg-[#F97316] hover:bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl h-12 shadow-xl shadow-orange-900/10 transition-all active:scale-[0.98]"
                    >
                        {t("inquiry")}
                    </Button>
                </div>
            </CardContent>
            
            <LeadModal
                isOpen={isLeadModalOpen}
                onClose={() => setIsLeadModalOpen(false)}
                projectName={project.name}
                projectId={Number(project.id)}
            />
        </Card>
    );
};