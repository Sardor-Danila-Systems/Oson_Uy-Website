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
        <DialogContent className="max-h-[min(94vh,920px)] w-[calc(100%-1rem)] max-w-6xl gap-0 overflow-hidden rounded-2xl border border-slate-200/80 p-0 shadow-2xl sm:max-w-6xl">
          {activeFloor ? (
            <div className="flex max-h-[min(94vh,920px)] flex-col md:flex-row md:min-h-[min(72vh,560px)]">
              <div className="relative flex min-h-[240px] flex-1 flex-col bg-white md:min-h-0 md:w-[58%]">
                <div className="relative flex min-h-[min(52vh,480px)] flex-1 flex-col overflow-hidden bg-slate-100 group md:min-h-[min(62vh,560px)]">
                  {activeLayouts.length > 0 ? (
                    <>
                      <Carousel
                        key={activeFloor.id}
                        setApi={setLayoutApi}
                        opts={{ loop: true, align: "start" }}
                        className="flex min-h-0 flex-1 flex-col"
                      >
                        <CarouselContent className="m-0 flex h-full min-h-0 flex-1">
                          {activeLayouts.map((layout, idx) => (
                            <CarouselItem
                              key={layout.id ?? idx}
                              className="h-full min-h-0 basis-full shrink-0 grow-0 p-0"
                            >
                              <div className="flex h-full min-h-[min(48vh,420px)] w-full flex-1 items-center justify-center p-3 md:min-h-[min(58vh,520px)] md:p-5">
                                <img
                                  src={layout.imageUrl}
                                  alt={layout.title ?? ""}
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                            </CarouselItem>
                          ))}
                        </CarouselContent>
                      </Carousel>

                      {activeLayouts.length > 1 ? (
                        <>
                          <button
                            type="button"
                            aria-label="Previous layout"
                            onClick={(e) => {
                              e.preventDefault();
                              layoutApi?.scrollPrev();
                            }}
                            className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md transition-opacity hover:bg-white md:left-3 md:opacity-0 md:group-hover:opacity-100"
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
                            className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md transition-opacity hover:bg-white md:right-3 md:opacity-0 md:group-hover:opacity-100"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <div className="flex min-h-[240px] w-full flex-1 flex-col items-center justify-center gap-2 bg-slate-100 px-6 text-center md:min-h-[min(58vh,520px)]">
                      <Building2 className="h-12 w-12 text-slate-400" />
                      <p className="text-sm font-bold text-slate-500">
                        {t("noLayouts")}
                      </p>
                    </div>
                  )}
                </div>

                {activeLayouts.length > 1 ? (
                  <div className="shrink-0 border-t border-slate-200 bg-white px-2 py-3 md:px-4 md:py-3.5">
                    <div className="mb-2.5 flex justify-center gap-1.5">
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
                            "h-1.5 rounded-full transition-all duration-300",
                            layoutSlide === i
                              ? "w-6 bg-[#F97316] shadow-sm"
                              : "w-1.5 bg-slate-300 hover:bg-slate-400",
                          )}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                      {activeLayouts.map((layout, i) => (
                        <button
                          key={layout.id ?? i}
                          type="button"
                          onClick={() => layoutApi?.scrollTo(i)}
                          className={cn(
                            "relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all sm:h-[4.5rem] sm:w-28",
                            layoutSlide === i
                              ? "border-[#F97316] shadow-md ring-2 ring-[#F97316]/30"
                              : "border-slate-200 opacity-90 hover:border-slate-300 hover:opacity-100",
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

              <div className="flex flex-1 flex-col justify-between gap-6 overflow-y-auto bg-white p-6 md:w-[42%] md:max-w-md md:p-8">
                <div className="space-y-4">
                  <DialogHeader className="space-y-2 text-left">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight text-[#1E3A8A] md:text-2xl">
                      {floorTitle(activeFloor)}
                      {activeFloor.title ? ` · ${activeFloor.title}` : ""}
                    </DialogTitle>
                    {activeLayouts[layoutSlide]?.title ? (
                      <p className="text-sm font-semibold text-slate-600">
                        {activeLayouts[layoutSlide].title}
                      </p>
                    ) : null}
                  </DialogHeader>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {t("pricePerM2")}
                      </p>
                      <p className="mt-1 text-lg font-black text-[#1E3A8A] md:text-xl">
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
                  </div>
                </div>

                <Button
                  type="button"
                  className="h-14 w-full shrink-0 rounded-2xl bg-[#F97316] text-base font-black uppercase tracking-wide text-white shadow-lg shadow-orange-900/15 hover:bg-orange-600"
                  onClick={() => {
                    setLeadFloorId(activeFloor.id);
                    setActiveFloor(null);
                    setLeadOpen(true);
                  }}
                >
                  {t("cta")}
                </Button>
              </div>
            </div>
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
