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
  const [layoutIdx, setLayoutIdx] = useState(0);
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
    setLayoutIdx(0);
  }, [activeFloor?.id]);

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
              <div className="relative aspect-[16/10] w-full bg-slate-200">
                {activeLayouts.length > 0 ? (
                  <>
                    <img
                      src={activeLayouts[layoutIdx]?.imageUrl}
                      alt={activeLayouts[layoutIdx]?.title ?? ""}
                      className="h-full w-full object-cover"
                    />
                    {activeLayouts.length > 1 ? (
                      <>
                        <button
                          type="button"
                          aria-label="Previous layout"
                          className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/55"
                          onClick={() =>
                            setLayoutIdx((i) =>
                              i <= 0 ? activeLayouts.length - 1 : i - 1,
                            )
                          }
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Next layout"
                          className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/55"
                          onClick={() =>
                            setLayoutIdx((i) =>
                              i >= activeLayouts.length - 1 ? 0 : i + 1,
                            )
                          }
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                        <div className="absolute bottom-14 left-0 right-0 flex justify-center gap-1">
                          {activeLayouts.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              aria-label={`Layout ${i + 1}`}
                              className={cn(
                                "h-1.5 rounded-full transition-all",
                                i === layoutIdx
                                  ? "w-6 bg-white shadow"
                                  : "w-1.5 bg-white/45 hover:bg-white/70",
                              )}
                              onClick={() => setLayoutIdx(i)}
                            />
                          ))}
                        </div>
                      </>
                    ) : null}
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 px-6 text-center">
                    <Building2 className="h-10 w-10 text-slate-300" />
                    <p className="text-xs font-bold text-slate-500">
                      {t("noLayouts")}
                    </p>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6 pt-16">
                  <DialogHeader className="space-y-0 text-left">
                    <DialogTitle className="text-2xl font-black uppercase italic text-white">
                      {floorTitle(activeFloor)}
                      {activeFloor.title ? ` · ${activeFloor.title}` : ""}
                    </DialogTitle>
                    {activeLayouts[layoutIdx]?.title ? (
                      <p className="mt-1 text-sm font-semibold text-white/90">
                        {activeLayouts[layoutIdx].title}
                      </p>
                    ) : null}
                  </DialogHeader>
                </div>
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
