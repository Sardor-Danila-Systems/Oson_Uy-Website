"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatProjectsCount } from "@/lib/counts";
import { formatUzsPerM2OrNegotiable } from "@/lib/currency";
import { minPricePerM2FromApiProject } from "@/lib/project-price";
import {
  LABEL_OVERRIDES,
  REGIONS,
  UZB_BBOX,
  regionName,
  toMapProject,
  type ApiProjectLike,
  type GeoRegion,
  type MapProject,
} from "@/lib/geo/regions";

type ViewBox = [number, number, number, number];

const ASPECT = (UZB_BBOX[2] - UZB_BBOX[0]) / (UZB_BBOX[3] - UZB_BBOX[1]);
const NATIONAL_VB: ViewBox = [
  UZB_BBOX[0],
  UZB_BBOX[1],
  UZB_BBOX[2] - UZB_BBOX[0],
  UZB_BBOX[3] - UZB_BBOX[1],
];

function regionViewBox(r: GeoRegion): ViewBox {
  const [x0, y0, x1, y1] = r.bbox;
  let w = (x1 - x0) * 1.18;
  let h = (y1 - y0) * 1.18;
  if (w / h > ASPECT) h = w / ASPECT;
  else w = h * ASPECT;
  return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
}

/** Eases the SVG viewBox toward `target` so zooming into a region feels continuous. */
function useAnimatedViewBox(target: ViewBox): ViewBox {
  const [vb, setVb] = useState<ViewBox>(target);
  const current = useRef<ViewBox>(target);

  useEffect(() => {
    const from = current.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const duration = reduced ? 1 : 650;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      const next = from.map((v, i) => v + (target[i] - v) * e) as ViewBox;
      current.current = next;
      setVb(next);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return vb;
}

const SHORT_REGION_NAMES: Record<string, Record<string, string>> = {
  "tashkent-region": { en: "Tashkent Reg.", ru: "Ташкентская", uz: "Toshkent v." },
  "tashkent-city": { en: "Tashkent", ru: "Ташкент", uz: "Toshkent" },
};

/** Compact label for the national map. */
function shortName(r: GeoRegion, locale: string): string {
  return (
    SHORT_REGION_NAMES[r.id]?.[locale] ?? regionName(r, locale).replace(/ (область|viloyati|Region)$/i, "")
  );
}

const mix = (a: number[], b: number[], k: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`;

function regionFill(count: number, max: number): { fill: string; dark: boolean } {
  if (count === 0) return { fill: "#E2E8F0", dark: false };
  const k = Math.min(1, 0.25 + 0.75 * (max > 0 ? count / max : 0));
  return { fill: mix([191, 208, 245], [30, 58, 138], k), dark: k > 0.55 };
}

function formatDelivery(raw: string, locale: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US", {
    month: "short",
    year: "numeric",
  });
}

export default function UzbekistanMap() {
  const t = useTranslations("Map");
  const locale = useLocale();

  const [projects, setProjects] = useState<MapProject[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverRegion, setHoverRegion] = useState<string | null>(null);
  const [hoverProject, setHoverProject] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [widthPx, setWidthPx] = useState(900);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidthPx(el.clientWidth || 900));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
        const res = await fetch(`${apiUrl}/projects`, { cache: "no-store" });
        const data = res.ok ? ((await res.json()) as ApiProjectLike[]) : [];
        if (cancelled) return;
        setProjects(
          data
            .map((p) =>
              toMapProject(p, minPricePerM2FromApiProject(p as { floors?: { pricePerM2: number }[] }) || null),
            )
            .filter((p): p is MapProject => p !== null),
        );
      } catch {
        if (!cancelled) setProjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep ?region= in the URL so a zoomed region can be shared / reached with Back.
  useEffect(() => {
    const read = () => {
      const id = new URLSearchParams(window.location.search).get("region");
      setSelectedId(REGIONS.some((r) => r.id === id) ? id : null);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    setHoverRegion(null);
    setHoverProject(null);
    setTip(null);
    const url = id ? `/map?region=${id}` : "/map";
    window.history.pushState(null, "", url);
  }, []);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    projects?.forEach((p) => m.set(p.regionId, (m.get(p.regionId) ?? 0) + 1));
    return m;
  }, [projects]);
  const maxCount = Math.max(0, ...counts.values());
  const total = projects?.length ?? 0;

  const selected = REGIONS.find((r) => r.id === selectedId) ?? null;
  const regionProjects = useMemo(
    () => (selected ? (projects ?? []).filter((p) => p.regionId === selected.id) : []),
    [projects, selected],
  );

  const targetVb = useMemo(() => (selected ? regionViewBox(selected) : NATIONAL_VB), [selected]);
  const vb = useAnimatedViewBox(targetVb);
  // Map units per screen pixel: labels and pins are sized in px so they stay readable at any zoom / width.
  const u = vb[2] / widthPx;

  const onMove = (e: React.MouseEvent) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (box) setTip({ x: e.clientX - box.left, y: e.clientY - box.top });
  };

  const hovered = REGIONS.find((r) => r.id === hoverRegion) ?? null;
  const hoveredProject = regionProjects.find((p) => p.id === hoverProject) ?? null;

  const sorted = useMemo(
    () =>
      [...REGIONS].sort(
        (a, b) =>
          (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
          regionName(a, locale).localeCompare(regionName(b, locale), locale),
      ),
    [counts, locale],
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-24 md:pt-28">
      <div className="container mx-auto max-w-[1250px] px-5">
        <header className="mb-6 md:mb-8">
          <h1 className="text-3xl font-black tracking-tight text-[#1E3A8A] md:text-4xl">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
            {selected ? t("regionHint") : t("hint")}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div
            ref={wrapRef}
            className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            onMouseMove={onMove}
            onMouseLeave={() => setTip(null)}
          >
            {selected && (
              <button
                type="button"
                onClick={() => select(null)}
                className="absolute left-4 top-4 z-10 inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-bold text-[#1E3A8A] shadow-sm backdrop-blur transition hover:border-[#3C55BE]/40"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("back")}
              </button>
            )}

            <svg
              viewBox={vb.join(" ")}
              className="block h-auto w-full select-none"
              style={{ aspectRatio: ASPECT }}
              role="group"
              aria-label={t("title")}
            >
              {REGIONS.map((r) => {
                const count = counts.get(r.id) ?? 0;
                const { fill } = regionFill(count, maxCount);
                const isSel = r.id === selectedId;
                const dimmed = selected !== null && !isSel;
                const isHover = r.id === hoverRegion && !selected;
                return (
                  <g
                    key={r.id}
                    role="button"
                    tabIndex={selected ? -1 : 0}
                    aria-label={`${regionName(r, locale)}: ${formatProjectsCount(count, locale)}`}
                    className={cn("outline-none transition-opacity duration-500", !selected && "cursor-pointer")}
                    style={{ opacity: dimmed ? 0.18 : 1, pointerEvents: selected ? "none" : "auto" }}
                    onMouseEnter={() => setHoverRegion(r.id)}
                    onMouseLeave={() => setHoverRegion(null)}
                    onFocus={() => setHoverRegion(r.id)}
                    onBlur={() => setHoverRegion(null)}
                    onClick={() => select(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        select(r.id);
                      }
                    }}
                  >
                    <path
                      d={r.path}
                      fill={isSel ? "#F8FAFC" : isHover ? "#F97316" : fill}
                      stroke={isHover ? "#C2410C" : "#fff"}
                      strokeWidth={isHover ? 2.2 : 1.4}
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                      style={{ transition: "fill 180ms" }}
                    />
                  </g>
                );
              })}

              {selected?.districts.map((d) => (
                <path
                  key={d.name}
                  d={d.path}
                  fill="#EEF2FF"
                  stroke="#94A3B8"
                  strokeWidth={0.8}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  className="animate-in fade-in duration-700"
                />
              ))}
              {selected && (
                <path
                  d={selected.path}
                  fill="none"
                  stroke="#1E3A8A"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              )}

              {/* region labels */}
              {!selected &&
                REGIONS.map((r) => {
                  const [x, y] = LABEL_OVERRIDES[r.id] ?? r.center;
                  const count = counts.get(r.id) ?? 0;
                  const { dark } = regionFill(count, maxCount);
                  const hot = r.id === hoverRegion;
                  const small = r.id === "tashkent-city";
                  return (
                    <g key={r.id} pointerEvents="none" textAnchor="middle">
                      {small && <circle cx={x} cy={y} r={4 * u} fill="#F97316" stroke="#fff" strokeWidth={1.5 * u} />}
                      <text
                        x={x}
                        y={small ? y - 9 * u : y - 1 * u}
                        fontSize={(small ? 11 : 12.5) * u}
                        fontWeight={800}
                        fill={hot || (dark && !small) ? "#fff" : "#0F172A"}
                        stroke={hot || (dark && !small) ? "none" : "#ffffffcc"}
                        strokeWidth={3 * u}
                        paintOrder="stroke"
                      >
                        {shortName(r, locale)}
                      </text>
                      {!small && (
                        <text
                          x={x}
                          y={y + 13 * u}
                          fontSize={11.5 * u}
                          fontWeight={700}
                          fill={hot || dark ? "#FED7AA" : "#C2410C"}
                          stroke={hot || dark ? "none" : "#ffffffcc"}
                          strokeWidth={3 * u}
                          paintOrder="stroke"
                        >
                          {projects ? count : "…"}
                        </text>
                      )}
                    </g>
                  );
                })}

              {/* district labels in region view */}
              {selected?.districts.map((d) => (
                <text
                  key={d.name}
                  x={d.center[0]}
                  y={d.center[1]}
                  fontSize={10 * u}
                  textAnchor="middle"
                  fill="#64748B"
                  stroke="#ffffffcc"
                  strokeWidth={3 * u}
                  paintOrder="stroke"
                  pointerEvents="none"
                  fontWeight={600}
                >
                  {d.name.replace(/ (city|district)$/i, "")}
                </text>
              ))}

              {/* project pins */}
              {selected &&
                regionProjects.map((p, i) => {
                  const hot = p.id === hoverProject;
                  const r = (hot ? 13 : 11) * u;
                  return (
                    <a
                      key={p.id}
                      href={`/catalog/${p.id}`}
                      aria-label={p.name}
                      onMouseEnter={() => setHoverProject(p.id)}
                      onMouseLeave={() => setHoverProject(null)}
                      onFocus={() => setHoverProject(p.id)}
                      onBlur={() => setHoverProject(null)}
                      className="cursor-pointer outline-none"
                    >
                      <circle
                        cx={p.pos[0]}
                        cy={p.pos[1]}
                        r={r}
                        fill="#F97316"
                        stroke="#fff"
                        strokeWidth={2 * u}
                        style={{ filter: "drop-shadow(0 2px 3px rgba(15,23,42,.35))" }}
                      />
                      <text
                        x={p.pos[0]}
                        y={p.pos[1] + 4 * u}
                        fontSize={11 * u}
                        fontWeight={800}
                        fill="#fff"
                        textAnchor="middle"
                        pointerEvents="none"
                      >
                        {i + 1}
                      </text>
                    </a>
                  );
                })}
            </svg>

            {/* tooltip */}
            {tip && (hovered || hoveredProject) && (
              <div
                className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[120%] whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-xl"
                style={{ left: tip.x, top: tip.y }}
              >
                {hoveredProject ? (
                  <>
                    <div className="font-bold">{hoveredProject.name}</div>
                    <div className="text-slate-300">
                      {[hoveredProject.district, formatUzsPerM2OrNegotiable(hoveredProject.priceFrom, t("negotiable"))]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </>
                ) : (
                  hovered && (
                    <>
                      <div className="font-bold">{regionName(hovered, locale)}</div>
                      <div className="text-orange-300">
                        {projects ? formatProjectsCount(counts.get(hovered.id) ?? 0, locale) : t("loading")}
                      </div>
                    </>
                  )
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-14 rounded-full bg-gradient-to-r from-[#BFD0F5] to-[#1E3A8A]" />
                {t("legend")}
              </span>
              {selected && regionProjects.some((p) => p.approx) && <span>{t("approxNote")}</span>}
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
            {selected ? (
              <>
                <h2 className="text-xl font-black text-[#1E3A8A]">{regionName(selected, locale)}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {projects ? formatProjectsCount(regionProjects.length, locale) : t("loading")}
                </p>
                <Link
                  href={`/catalog?location=${encodeURIComponent(selected.en)}`}
                  className="mt-3 inline-flex rounded-full bg-[#1E3A8A] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#3C55BE]"
                >
                  {t("openCatalog")}
                </Link>

                <ul className="mt-4 space-y-2">
                  {regionProjects.map((p, i) => (
                    <li key={p.id}>
                      <Link
                        href={`/catalog/${p.id}`}
                        onMouseEnter={() => setHoverProject(p.id)}
                        onMouseLeave={() => setHoverProject(null)}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border p-2 transition",
                          p.id === hoverProject
                            ? "border-[#F97316] bg-orange-50"
                            : "border-slate-100 hover:border-slate-300",
                        )}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F97316] text-[11px] font-black text-white">
                          {i + 1}
                        </span>
                        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          {p.imageUrl && (
                            <Image src={p.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-slate-900">{p.name}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {p.district || regionName(selected, locale)}
                          </span>
                          <span className="block truncate text-xs font-semibold text-[#1E3A8A]">
                            {formatUzsPerM2OrNegotiable(p.priceFrom, t("negotiable"))}
                            {p.deliveryDate && ` · ${formatDelivery(p.deliveryDate, locale)}`}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {projects && regionProjects.length === 0 && (
                  <p className="mt-6 text-center text-sm text-slate-500">{t("empty")}</p>
                )}
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-black text-[#1E3A8A]">{t("allRegions")}</h2>
                  <span className="text-sm text-slate-500">
                    {projects ? formatProjectsCount(total, locale) : t("loading")}
                  </span>
                </div>
                <ul className="mt-3 space-y-1">
                  {sorted.map((r) => {
                    const c = counts.get(r.id) ?? 0;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => select(r.id)}
                          onMouseEnter={() => setHoverRegion(r.id)}
                          onMouseLeave={() => setHoverRegion(null)}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition",
                            r.id === hoverRegion ? "bg-orange-50" : "hover:bg-slate-50",
                          )}
                        >
                          <MapPin className="h-4 w-4 shrink-0 text-[#F97316]" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                            {regionName(r, locale)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-[#1E3A8A]">
                            {projects ? c : "…"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
