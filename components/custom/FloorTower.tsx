"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatUzsPerM2 } from "@/lib/currency";
import { LeadModal } from "@/components/custom/LeadModal";
import { BuildingModelStatic } from "@/components/custom/BuildingModelStatic";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import type { ProjectFloor } from "@/types";
import { Building2, ChevronLeft, ChevronRight, Layers } from "lucide-react";

type FloorTowerProps = {
  projectId: number;
  projectName: string;
  floors: ProjectFloor[];
  totalFloorsHint?: number | null;
};

function areaChipsText(f: ProjectFloor): string {
  const areas = (f.areaOptions ?? [])
    .map((o) => o.areaSqm)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (!areas.length) return "—";
  return `${areas.map((a) => (Number.isInteger(a) ? String(a) : a.toFixed(1))).join(" · ")} m²`;
}

export function FloorTower({
  projectId,
  projectName,
  floors,
  totalFloorsHint,
}: FloorTowerProps) {
  const t = useTranslations("FloorTower");
  const [activeFloor, setActiveFloor] = useState<ProjectFloor | null>(null);
  const [layoutApi, setLayoutApi] = useState<CarouselApi>();
  const [layoutSlide, setLayoutSlide] = useState(0);
  const [layoutCount, setLayoutCount] = useState(0);
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadFloorId, setLeadFloorId] = useState<number | undefined>();
  const [hoverId, setHoverId] = useState<number | null>(null);

  const sorted = useMemo(() => {
    return [...floors].sort((a, b) => b.floor - a.floor);
  }, [floors]);

  const floorTitle = (f: ProjectFloor) => t("floorLabel", { n: f.floor });

  const placeholderCount = useMemo(() => {
    if (!totalFloorsHint || totalFloorsHint <= sorted.length) return 0;
    return Math.min(totalFloorsHint - sorted.length, 24);
  }, [totalFloorsHint, sorted.length]);

  const activeLayouts = activeFloor?.layouts ?? [];

  useEffect(() => {
    if (!layoutApi) return;
    const sync = () => {
      setLayoutCount(layoutApi.scrollSnapList().length);
      setLayoutSlide(layoutApi.selectedScrollSnap());
    };
    sync();
    layoutApi.on("select", sync);
    return () => {
      layoutApi.off("select", sync);
    };
  }, [layoutApi]);

  useEffect(() => {
    if (!layoutApi || !activeLayouts.length) return;
    layoutApi.scrollTo(0);
  }, [activeFloor?.id, layoutApi, activeLayouts.length]);

  if (!sorted.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-10 text-center">
        <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-bold text-slate-500">{t("empty")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto mb-8 max-w-2xl space-y-3 text-center sm:mb-10">
        <h3 className="text-xl font-black uppercase tracking-tight text-[#1E3A8A] sm:text-2xl md:text-3xl">
          {t("title")}
        </h3>
        <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
          {t("description")}
        </p>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 sm:text-sm">
          {t("hint")}
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-1 sm:px-2">
        <div
          className="pointer-events-none absolute -inset-x-4 -bottom-8 top-1/3 rounded-[2rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_75%,rgba(249,115,22,0.08),transparent_65%)]"
          aria-hidden
        />

        <BuildingModelStatic
          floors={sorted}
          hoverId={hoverId}
          onHover={setHoverId}
          onPick={setActiveFloor}
        />

        <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {t("pickerHint")}
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-3 sm:gap-3.5">
          {sorted.map((f) => {
            const hovered = hoverId === f.id;
            const selected = activeFloor?.id === f.id;
            const focus = hovered || selected;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFloor(f)}
                onMouseEnter={() => setHoverId(f.id)}
                onMouseLeave={() => setHoverId(null)}
                className={cn(
                  "group relative min-w-[7.25rem] cursor-pointer rounded-2xl border-2 px-3.5 py-3 text-left shadow-md outline-none transition-all duration-200 sm:min-w-[7.75rem]",
                  "focus-visible:ring-2 focus-visible:ring-[#F97316]/50 focus-visible:ring-offset-2",
                  focus
                    ? "border-[#F97316] bg-gradient-to-br from-orange-50 via-white to-slate-50/90 shadow-lg shadow-orange-900/10 ring-2 ring-[#F97316]/20"
                    : "border-slate-100/90 bg-white hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-lg active:scale-[0.98]",
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[#1E3A8A]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#1E3A8A]">
                    <Layers className="h-3 w-3 opacity-80" aria-hidden />
                    {floorTitle(f)}
                  </span>
                </div>
                <span className="block text-sm font-black tabular-nums tracking-tight text-slate-900">
                  {formatUzsPerM2(f.pricePerM2)}
                </span>
                <span className="mt-1.5 block border-t border-slate-100 pt-1.5 text-[10px] font-semibold leading-snug text-slate-500">
                  <span className="text-slate-400">{t("areaVariantsShort")}: </span>
                  {areaChipsText(f)}
                </span>
              </button>
            );
          })}
        </div>

        {placeholderCount > 0 ? (
          <p className="mt-4 text-center text-xs text-slate-400">
            {t("placeholderMore", { count: placeholderCount })}
          </p>
        ) : null}
      </div>

      <Dialog
        open={activeFloor !== null}
        onOpenChange={(open) => !open && setActiveFloor(null)}
      >
        <DialogContent className="max-w-lg overflow-hidden rounded-[2rem] border-none p-0">
          {activeFloor ? (
            <>
              <div className="flex flex-col bg-slate-200">
                <div className="relative aspect-[16/10] w-full overflow-hidden group">
                  {activeLayouts.length > 0 ? (
                    <>
                      <Carousel
                        key={activeFloor.id}
                        setApi={setLayoutApi}
                        opts={{ loop: true, align: "start" }}
                        className="h-full w-full"
                      >
                        <CarouselContent className="m-0 h-full flex">
                          {activeLayouts.map((layout, idx) => (
                            <CarouselItem
                              key={layout.id ?? idx}
                              className="p-0 h-full basis-full shrink-0 grow-0"
                            >
                              <div className="relative h-full min-h-[180px] w-full bg-slate-200">
                                <img
                                  src={layout.imageUrl}
                                  alt={layout.title ?? ""}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            </CarouselItem>
                          ))}
                        </CarouselContent>
                      </Carousel>

                      {activeLayouts.length > 1 ? (
                        <>
                          <div className="absolute inset-x-0 bottom-12 z-20 flex justify-center gap-1.5 md:bottom-14">
                            {Array.from({ length: layoutCount }).map((_, i) => (
                              <button
                                key={i}
                                type="button"
                                aria-label={`Slide ${i + 1}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  layoutApi?.scrollTo(i);
                                }}
                                className={cn(
                                  "h-1 rounded-full transition-all duration-300",
                                  layoutSlide === i
                                    ? "w-5 bg-white shadow-lg"
                                    : "w-1 bg-white/40 hover:bg-white/60",
                                )}
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            aria-label="Previous layout"
                            onClick={(e) => {
                              e.preventDefault();
                              layoutApi?.scrollPrev();
                            }}
                            className="absolute left-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white opacity-0 backdrop-blur-md transition-all hover:bg-white/20 group-hover:opacity-100"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Next layout"
                            onClick={(e) => {
                              e.preventDefault();
                              layoutApi?.scrollNext();
                            }}
                            className="absolute right-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white opacity-0 backdrop-blur-md transition-all hover:bg-white/20 group-hover:opacity-100"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </>
                      ) : null}

                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-5 pt-12 md:p-6 md:pt-16">
                        <DialogHeader className="space-y-0 text-left">
                          <DialogTitle className="text-xl font-black uppercase italic text-white md:text-2xl">
                            {floorTitle(activeFloor)}
                            {activeFloor.title ? ` · ${activeFloor.title}` : ""}
                          </DialogTitle>
                          {activeLayouts[layoutSlide]?.title ? (
                            <p className="mt-1 text-sm font-semibold text-white/90">
                              {activeLayouts[layoutSlide].title}
                            </p>
                          ) : null}
                        </DialogHeader>
                      </div>
                    </>
                  ) : (
                    <div className="flex aspect-[16/10] h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 px-6 text-center">
                      <Building2 className="h-10 w-10 text-slate-300" />
                      <p className="text-xs font-bold text-slate-500">
                        {t("noLayouts")}
                      </p>
                    </div>
                  )}
                </div>

                {activeLayouts.length > 1 ? (
                  <div className="border-t border-white/10 bg-black/35 px-2 py-2.5 backdrop-blur-md md:px-3 md:py-3">
                    <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin]">
                      {activeLayouts.map((layout, i) => (
                        <button
                          key={layout.id ?? i}
                          type="button"
                          onClick={() => layoutApi?.scrollTo(i)}
                          className={cn(
                            "relative h-14 w-[5.5rem] shrink-0 overflow-hidden rounded-xl border-2 transition-all md:h-16 md:w-24",
                            layoutSlide === i
                              ? "border-[#F97316] shadow-lg ring-2 ring-[#F97316]/40"
                              : "border-white/20 opacity-90 hover:border-white/50 hover:opacity-100",
                          )}
                        >
                          <img
                            src={layout.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="space-y-4 p-6 md:p-8">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {t("pricePerM2")}
                  </p>
                  <p className="mt-1 text-lg font-black text-[#1E3A8A]">
                    {formatUzsPerM2(activeFloor.pricePerM2)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {t("areaVariants")}
                  </p>
                  <p className="mt-2 text-base font-black leading-relaxed text-[#1E3A8A]">
                    {areaChipsText(activeFloor)}
                  </p>
                </div>
                <Button
                  type="button"
                  className="h-14 w-full rounded-2xl bg-[#F97316] text-base font-black uppercase tracking-wide text-white shadow-lg shadow-orange-900/15 hover:bg-orange-600"
                  onClick={() => {
                    setLeadFloorId(activeFloor.id);
                    setActiveFloor(null);
                    setLeadOpen(true);
                  }}
                >
                  {t("cta")}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <LeadModal
        isOpen={leadOpen}
        onClose={() => {
          setLeadOpen(false);
          setLeadFloorId(undefined);
        }}
        projectId={projectId}
        projectName={projectName}
        floorId={leadFloorId}
      />
    </>
  );
}
