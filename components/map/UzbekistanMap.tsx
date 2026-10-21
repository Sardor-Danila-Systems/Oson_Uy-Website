"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Maximize, MapPin, Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatProjectsCount } from "@/lib/counts";
import { formatUzsPerM2OrNegotiable } from "@/lib/currency";
import { minPricePerM2FromApiProject } from "@/lib/project-price";
import {
  LABEL_OVERRIDES,
  REGIONS,
  UZB_BBOX,
  regionName,
  tilesFor,
  toMapProject,
  type ApiProjectLike,
  type GeoRegion,
  type MapProject,
} from "@/lib/geo/regions";

type ViewBox = [number, number, number, number];
type BBox = [number, number, number, number];

const NARROW_PX = 640;
const CLUSTER_PX = 22;
/** Small eastern regions whose labels collide on a phone; they get callouts in the empty top-right corner. */
const CALLOUT_IDS = ["tashkent-region", "namangan", "andijan", "fergana", "tashkent-city"];

/** Smallest viewBox of the given aspect ratio that contains `bbox` with some padding. */
function fitVb(bbox: BBox, aspect: number, pad: number): ViewBox {
  const [x0, y0, x1, y1] = bbox;
  let w = (x1 - x0) * pad;
  let h = (y1 - y0) * pad;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
}

const aspectFor = (narrow: boolean, region: boolean) => {
  if (narrow) return region ? 0.9 : 1.3;
  return region ? 1.45 : (UZB_BBOX[2] - UZB_BBOX[0]) / (UZB_BBOX[3] - UZB_BBOX[1]);
};

const ctxBBox = (r: GeoRegion | null): BBox => (r ? r.bbox : UZB_BBOX);
const ctxFit = (r: GeoRegion | null, aspect: number) => fitVb(ctxBBox(r), aspect, r ? 1.18 : 1.04);

function clampVb(v: ViewBox, region: GeoRegion | null, aspect: number): ViewBox {
  const base = ctxFit(region, aspect);
  const maxW = base[2] * 1.25;
  const minW = base[2] / (region ? 150 : 25);
  const w = Math.min(maxW, Math.max(minW, v[2]));
  const h = w / aspect;
  const [x0, y0, x1, y1] = ctxBBox(region);
  const mx = (x1 - x0) * 0.15;
  const my = (y1 - y0) * 0.15;
  const cx = Math.min(x1 + mx, Math.max(x0 - mx, v[0] + v[2] / 2));
  const cy = Math.min(y1 + my, Math.max(y0 - my, v[1] + v[3] / 2));
  return [cx - w / 2, cy - h / 2, w, h];
}

/** Camera with eased transitions (buttons, region changes) and immediate updates (drag, pinch, wheel). */
function useCamera(initial: ViewBox) {
  const [vb, setVb] = useState<ViewBox>(initial);
  const cur = useRef<ViewBox>(initial);
  const raf = useRef(0);

  const set = useCallback((target: ViewBox, animate = false) => {
    cancelAnimationFrame(raf.current);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduced) {
      cur.current = target;
      setVb(target);
      return;
    }
    const from = cur.current;
    const start = performance.now();
    const duration = 550;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      const next = from.map((v, i) => v + (target[i] - v) * e) as ViewBox;
      cur.current = next;
      setVb(next);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return { vb, cur, set };
}

const mix = (a: number[], b: number[], k: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`;

function regionFill(count: number, max: number): { fill: string; dark: boolean } {
  if (count === 0) return { fill: "#E2E8F0", dark: false };
  const k = Math.min(1, 0.25 + 0.75 * (max > 0 ? count / max : 0));
  return { fill: mix([191, 208, 245], [30, 58, 138], k), dark: k > 0.55 };
}

const SHORT_REGION_NAMES: Record<string, Record<string, string>> = {
  "tashkent-region": { en: "Tashkent Reg.", ru: "Ташкентская", uz: "Toshkent v." },
  "tashkent-city": { en: "Tashkent", ru: "Ташкент", uz: "Toshkent" },
};

/** Compact label for the country map. */
function shortName(r: GeoRegion, locale: string): string {
  return SHORT_REGION_NAMES[r.id]?.[locale] ?? regionName(r, locale).replace(/ (область|viloyati|Region)$/i, "");
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

type Cluster = { key: string; x: number; y: number; items: { p: MapProject; index: number }[] };

/** Groups pins that would overlap on screen so dense areas (e.g. Samarkand city) stay readable. */
function clusterPins(list: MapProject[], vb: ViewBox, u: number): Cluster[] {
  const radius = CLUSTER_PX * u;
  const out: Cluster[] = [];
  list.forEach((p, index) => {
    const hit = out.find((c) => Math.hypot(c.x - p.pos[0], c.y - p.pos[1]) < radius);
    if (hit) {
      hit.items.push({ p, index });
      const n = hit.items.length;
      hit.x += (p.pos[0] - hit.x) / n;
      hit.y += (p.pos[1] - hit.y) / n;
    } else {
      out.push({ key: p.id, x: p.pos[0], y: p.pos[1], items: [{ p, index }] });
    }
  });
  const [x, y, w, h] = vb;
  const m = radius * 2;
  return out.filter((c) => c.x > x - m && c.x < x + w + m && c.y > y - m && c.y < y + h + m);
}

export default function UzbekistanMap() {
  const t = useTranslations("Map");
  const locale = useLocale();

  const [projects, setProjects] = useState<MapProject[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverRegion, setHoverRegion] = useState<string | null>(null);
  const [hoverProject, setHoverProject] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const [widthPx, setWidthPx] = useState(900);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const selRef = useRef<string | null>(null);
  const draggedRef = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const narrow = widthPx < NARROW_PX;
  const aspect = aspectFor(narrow, selectedId !== null);
  const selected = REGIONS.find((r) => r.id === selectedId) ?? null;

  const { vb, cur, set } = useCamera(fitVb(UZB_BBOX, aspectFor(false, false), 1.04));
  const aspectRef = useRef(aspect);
  useEffect(() => {
    aspectRef.current = aspect;
  }, [aspect]);

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

  const goTo = useCallback(
    (id: string | null, animate: boolean) => {
      selRef.current = id;
      setSelectedId(id);
      setHoverRegion(null);
      setHoverProject(null);
      setActiveId(null);
      setTip(null);
      const region = REGIONS.find((r) => r.id === id) ?? null;
      const w = wrapRef.current?.clientWidth ?? 900;
      set(ctxFit(region, aspectFor(w < NARROW_PX, region !== null)), animate);
    },
    [set],
  );

  // Keep ?region= in the URL so a zoomed region can be shared / reached with Back.
  useEffect(() => {
    const read = () => {
      const id = new URLSearchParams(window.location.search).get("region");
      goTo(REGIONS.some((r) => r.id === id) ? id : null, false);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [goTo]);

  const select = useCallback(
    (id: string | null) => {
      goTo(id, true);
      window.history.pushState(null, "", id ? `/map?region=${id}` : "/map");
    },
    [goTo],
  );

  // Track width; refit when crossing the phone / desktop breakpoint.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let wasNarrow: boolean | null = null;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 900;
      setWidthPx(w);
      const n = w < NARROW_PX;
      if (wasNarrow !== n) {
        const region = REGIONS.find((r) => r.id === selRef.current) ?? null;
        set(ctxFit(region, aspectFor(n, region !== null)), false);
      }
      wasNarrow = n;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [set]);

  const u = vb[2] / widthPx; // map units per screen pixel

  // Once the pins are known, frame the area they actually occupy instead of the whole (mostly empty) region.
  const framedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId) {
      framedFor.current = null;
      return;
    }
    if (!projects || framedFor.current === selectedId) return;
    framedFor.current = selectedId;
    const pins = projects.filter((p) => p.regionId === selectedId);
    const region = REGIONS.find((r) => r.id === selectedId);
    if (!region || pins.length === 0) return;
    const xs = pins.map((p) => p.pos[0]);
    const ys = pins.map((p) => p.pos[1]);
    const box: BBox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const pad = Math.max(box[2] - box[0], box[3] - box[1], 4) * 0.2 + 3;
    const framed = fitVb([box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad], aspectRef.current, 1);
    const full = ctxFit(region, aspectRef.current);
    if (framed[2] < full[2] * 0.7) set(clampVb(framed, region, aspectRef.current), true);
  }, [projects, selectedId, set]);

  /** Zoom by `factor` keeping the map point under (cx, cy) (client coords) fixed. */
  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number, animate = false) => {
      const svg = svgRef.current;
      if (!svg) return;
      const box = svg.getBoundingClientRect();
      const fx = cx == null ? 0.5 : (cx - box.left) / box.width;
      const fy = cy == null ? 0.5 : (cy - box.top) / box.height;
      const [x, y, w, h] = cur.current;
      const nw = w / factor;
      const nh = nw / aspectRef.current;
      const next: ViewBox = [x + fx * w - fx * nw, y + fy * h - fy * nh, nw, nh];
      const region = REGIONS.find((r) => r.id === selRef.current) ?? null;
      set(clampVb(next, region, aspectRef.current), animate);
    },
    [cur, set],
  );

  // Wheel zoom needs a non-passive listener. On the country map it requires Ctrl/⌘ so the page still scrolls.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (!selRef.current && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX, e.clientY);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    draggedRef.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    const svg = svgRef.current;
    if (!prev || !svg) return;
    const region = REGIONS.find((r) => r.id === selRef.current) ?? null;
    const box = svg.getBoundingClientRect();
    const unit = cur.current[2] / box.width;

    if (map.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (!draggedRef.current && Math.hypot(dx, dy) < 4) return;
      if (!draggedRef.current) {
        draggedRef.current = true;
        svg.setPointerCapture(e.pointerId);
        setTip(null);
      }
      map.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const v = cur.current;
      set(clampVb([v[0] - dx * unit, v[1] - dy * unit, v[2], v[3]], region, aspectRef.current));
    } else if (map.size === 2) {
      draggedRef.current = true;
      const other = [...map.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (!other) return;
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
      const m0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
      map.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      const m1 = { x: (e.clientX + other.x) / 2, y: (e.clientY + other.y) / 2 };
      const v = cur.current;
      const nw = v[2] / (d1 / Math.max(d0, 1));
      const nh = nw / aspectRef.current;
      const ax = v[0] + ((m0.x - box.left) / box.width) * v[2];
      const ay = v[1] + ((m0.y - box.top) / box.height) * v[3];
      const gx = (m1.x - box.left) / box.width;
      const gy = (m1.y - box.top) / box.height;
      set(clampVb([ax - gx * nw, ay - gy * nh, nw, nh], region, aspectRef.current));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setTimeout(() => (draggedRef.current = false), 0);
  };

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    projects?.forEach((p) => m.set(p.regionId, (m.get(p.regionId) ?? 0) + 1));
    return m;
  }, [projects]);
  const maxCount = Math.max(0, ...counts.values());
  const total = projects?.length ?? 0;

  const regionProjects = useMemo(
    () => (selected ? (projects ?? []).filter((p) => p.regionId === selected.id) : []),
    [projects, selected],
  );
  const clusters = useMemo(
    () => (selected ? clusterPins(regionProjects, vb, u) : []),
    [selected, regionProjects, vb, u],
  );
  const tiles = useMemo(() => (selected ? tilesFor(vb, u) : []), [selected, vb, u]);

  const hovered = REGIONS.find((r) => r.id === hoverRegion) ?? null;
  const hoveredProject = regionProjects.find((p) => p.id === hoverProject) ?? null;
  const activeProject = regionProjects.find((p) => p.id === activeId) ?? null;

  const sorted = useMemo(
    () =>
      [...REGIONS].sort(
        (a, b) =>
          (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
          regionName(a, locale).localeCompare(regionName(b, locale), locale),
      ),
    [counts, locale],
  );

  const zoomed = vb[2] < ctxFit(selected, aspect)[2] * 0.97;

  const onMouseMove = (e: React.MouseEvent) => {
    if (pointers.current.size > 0) return;
    const box = wrapRef.current?.getBoundingClientRect();
    if (box) setTip({ x: e.clientX - box.left, y: e.clientY - box.top });
  };

  /** Zoom so every pin of the cluster is visible; always at least a step closer so the cluster splits. */
  const zoomToCluster = (c: Cluster) => {
    const xs = c.items.map((i) => i.p.pos[0]);
    const ys = c.items.map((i) => i.p.pos[1]);
    const pad = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 0.5) * 0.25 + 40 * u;
    const box: BBox = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
    let target = fitVb(box, aspect, 1);
    const maxW = cur.current[2] / 1.6;
    if (target[2] > maxW) {
      const cx = target[0] + target[2] / 2;
      const cy = target[1] + target[3] / 2;
      target = [cx - maxW / 2, cy - maxW / aspect / 2, maxW, maxW / aspect];
    }
    set(clampVb(target, selected, aspect), true);
  };

  const baseU = ctxFit(null, aspect)[2] / widthPx;
  const useCallouts = narrow && !selected && vb[2] > ctxFit(null, aspect)[2] * 0.6;
  const callouts = useCallouts
    ? CALLOUT_IDS.map((id) => REGIONS.find((r) => r.id === id)!)
        .sort((a, b) => (LABEL_OVERRIDES[a.id] ?? a.center)[1] - (LABEL_OVERRIDES[b.id] ?? b.center)[1])
        .map((r, i) => ({
          r,
          x: UZB_BBOX[2] - 118 * baseU,
          y: UZB_BBOX[1] + (16 + i * 21) * baseU,
          to: r.id === "tashkent-city" ? r.center : (LABEL_OVERRIDES[r.id] ?? r.center),
        }))
    : [];
  const calloutIds = new Set(callouts.map((c) => c.r.id));

  const nameSize = (narrow ? 10 : 12.5) * u;
  const countSize = (narrow ? 10 : 11.5) * u;
  const btn =
    "flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-[#1E3A8A] shadow-sm backdrop-blur transition hover:border-[#3C55BE]/50 active:scale-95 md:h-9 md:w-9";

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-20 md:pt-28">
      <div className="container mx-auto max-w-[1250px] px-3 md:px-5">
        <header className="mb-4 px-1 md:mb-8">
          <h1 className="text-2xl font-black tracking-tight text-[#1E3A8A] md:text-4xl">{t("title")}</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600 md:mt-2 md:text-base">
            {selected ? t("regionHint") : t("hint")}
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
          <div
            ref={wrapRef}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:rounded-3xl"
            onMouseMove={onMouseMove}
            onMouseLeave={() => setTip(null)}
          >
            {selected && (
              <button
                type="button"
                onClick={() => select(null)}
                className="absolute left-3 top-3 z-10 inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3.5 text-sm font-bold text-[#1E3A8A] shadow-sm backdrop-blur transition hover:border-[#3C55BE]/50 active:scale-95 md:h-9"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("back")}
              </button>
            )}

            <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
              <button type="button" aria-label={t("zoomIn")} className={btn} onClick={() => zoomAt(2, undefined, undefined, true)}>
                <Plus className="h-5 w-5" />
              </button>
              <button type="button" aria-label={t("zoomOut")} className={btn} onClick={() => zoomAt(0.5, undefined, undefined, true)}>
                <Minus className="h-5 w-5" />
              </button>
              {zoomed && (
                <button
                  type="button"
                  aria-label={t("reset")}
                  className={btn}
                  onClick={() => set(ctxFit(selected, aspect), true)}
                >
                  <Maximize className="h-4 w-4" />
                </button>
              )}
            </div>

            <svg
              ref={svgRef}
              viewBox={vb.join(" ")}
              className="block h-auto w-full select-none"
              style={{
                aspectRatio: aspect,
                touchAction: selected || zoomed ? "none" : "pan-y",
                cursor: selected || zoomed ? "grab" : "default",
              }}
              role="group"
              aria-label={t("title")}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onClick={() => {
                if (!draggedRef.current) setActiveId(null);
              }}
            >
              {/* street map under the selected region */}
              {selected &&
                tiles.map((tile) => (
                  <image
                    key={tile.key}
                    href={tile.url}
                    x={tile.x}
                    y={tile.y}
                    width={tile.size + u * 0.6}
                    height={tile.size + u * 0.6}
                    preserveAspectRatio="none"
                    pointerEvents="none"
                  />
                ))}

              {REGIONS.map((r) => {
                const count = counts.get(r.id) ?? 0;
                const { fill } = regionFill(count, maxCount);
                const isHover = r.id === hoverRegion && !selected;
                if (selected) {
                  return r.id === selectedId ? null : (
                    <path key={r.id} d={r.path} fill="#CBD5E1" fillOpacity={0.35} pointerEvents="none" />
                  );
                }
                return (
                  <g
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${regionName(r, locale)}: ${formatProjectsCount(count, locale)}`}
                    className="cursor-pointer outline-none"
                    onMouseEnter={() => setHoverRegion(r.id)}
                    onMouseLeave={() => setHoverRegion(null)}
                    onFocus={() => setHoverRegion(r.id)}
                    onBlur={() => setHoverRegion(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!draggedRef.current) select(r.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        select(r.id);
                      }
                    }}
                  >
                    <path
                      d={r.path}
                      fill={isHover ? "#F97316" : fill}
                      stroke={isHover ? "#C2410C" : "#fff"}
                      strokeWidth={isHover ? 2.2 : 1.4}
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                      style={{ transition: "fill 180ms" }}
                    />
                  </g>
                );
              })}

              {/* region view: fade everything outside the region, outline districts */}
              {selected && (
                <>
                  <path
                    d={`M${vb[0] - vb[2]} ${vb[1] - vb[3]}H${vb[0] + vb[2] * 2}V${vb[1] + vb[3] * 2}H${vb[0] - vb[2]}Z${selected.path}`}
                    fill="#F1F5F9"
                    fillOpacity={0.72}
                    fillRule="evenodd"
                    pointerEvents="none"
                  />
                  {selected.districts.map((d) => (
                    <path
                      key={d.name}
                      d={d.path}
                      fill="#3C55BE"
                      fillOpacity={0.05}
                      stroke="#1E3A8A"
                      strokeOpacity={0.45}
                      strokeWidth={1}
                      strokeDasharray="4 3"
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                      pointerEvents="none"
                    />
                  ))}
                  <path
                    d={selected.path}
                    fill="none"
                    stroke="#1E3A8A"
                    strokeWidth={2.5}
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    pointerEvents="none"
                  />
                  {(!narrow || zoomed) &&
                    selected.districts.map((d) => (
                    <text
                      key={d.name}
                      x={d.center[0]}
                      y={d.center[1]}
                      fontSize={10.5 * u}
                      textAnchor="middle"
                      fill="#334155"
                      stroke="#ffffffdd"
                      strokeWidth={3 * u}
                      paintOrder="stroke"
                      pointerEvents="none"
                      fontWeight={700}
                    >
                      {d.name.replace(/ (city|district)$/i, "")}
                    </text>
                  ))}
                </>
              )}

              {/* region labels on the country map */}
              {!selected &&
                REGIONS.filter((r) => !calloutIds.has(r.id)).map((r) => {
                  const [x, y] = LABEL_OVERRIDES[r.id] ?? r.center;
                  const count = counts.get(r.id) ?? 0;
                  const hot = r.id === hoverRegion;
                  const small = r.id === "tashkent-city";
                  const light = false;
                  return (
                    <g key={r.id} pointerEvents="none" textAnchor="middle">
                      {small && <circle cx={x} cy={y} r={4 * u} fill="#F97316" stroke="#fff" strokeWidth={1.5 * u} />}
                      <text
                        x={x}
                        y={small ? y - 8 * u : y - 1 * u}
                        fontSize={small ? nameSize * 0.92 : nameSize}
                        fontWeight={800}
                        fill={light ? "#fff" : "#0F172A"}
                        stroke={light ? "none" : "#ffffffcc"}
                        strokeWidth={3 * u}
                        paintOrder="stroke"
                      >
                        {shortName(r, locale)}
                      </text>
                      {!small && (
                        <text
                          x={x}
                          y={y + countSize * 1.15}
                          fontSize={countSize}
                          fontWeight={700}
                          fill="#C2410C"
                          stroke="#ffffffdd"
                          strokeWidth={3 * u}
                          paintOrder="stroke"
                        >
                          {projects ? count : "…"}
                        </text>
                      )}
                    </g>
                  );
                })}

              {callouts.map(({ r, x, y, to }) => {
                const c = counts.get(r.id) ?? 0;
                return (
                  <g key={`co${r.id}`} pointerEvents="none">
                    <line x1={x - 4 * u} y1={y - 3.5 * u} x2={to[0]} y2={to[1]} stroke="#0F172A" strokeOpacity={0.55} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    <circle cx={to[0]} cy={to[1]} r={2.5 * u} fill="#0F172A" />
                    <text x={x} y={y} fontSize={10.5 * u} fontWeight={800} fill="#0F172A" stroke="#ffffffdd" strokeWidth={3 * u} paintOrder="stroke">
                      {shortName(r, locale)} <tspan fill="#C2410C">{projects ? c : "…"}</tspan>
                    </text>
                  </g>
                );
              })}

              {/* project pins, merged into clusters when they would overlap */}
              {selected &&
                clusters.map((c) => {
                  if (c.items.length > 1) {
                    const r = (14 + Math.min(6, c.items.length / 2)) * u;
                    return (
                      <g
                        key={`c${c.key}`}
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!draggedRef.current) zoomToCluster(c);
                        }}
                      >
                        <circle cx={c.x} cy={c.y} r={r} fill="#1E3A8A" stroke="#fff" strokeWidth={2.5 * u} />
                        <text
                          x={c.x}
                          y={c.y + 4.5 * u}
                          fontSize={13 * u}
                          fontWeight={800}
                          fill="#fff"
                          textAnchor="middle"
                          pointerEvents="none"
                        >
                          {c.items.length}
                        </text>
                      </g>
                    );
                  }
                  const { p, index } = c.items[0];
                  const hot = p.id === hoverProject || p.id === activeId;
                  const r = (hot ? 14 : 12) * u;
                  return (
                    <g
                      key={p.id}
                      className="cursor-pointer outline-none"
                      role="button"
                      tabIndex={0}
                      aria-label={p.name}
                      onMouseEnter={() => setHoverProject(p.id)}
                      onMouseLeave={() => setHoverProject(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!draggedRef.current) setActiveId(p.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setActiveId(p.id);
                      }}
                    >
                      {p.id === activeId && (
                        <circle cx={p.pos[0]} cy={p.pos[1]} r={r + 6 * u} fill="#F97316" fillOpacity={0.25} />
                      )}
                      <circle
                        cx={p.pos[0]}
                        cy={p.pos[1]}
                        r={r}
                        fill={p.approx ? "#FB923C" : "#F97316"}
                        stroke="#fff"
                        strokeWidth={2.2 * u}
                        style={{ filter: "drop-shadow(0 2px 3px rgba(15,23,42,.4))" }}
                      />
                      <text
                        x={p.pos[0]}
                        y={p.pos[1] + 4 * u}
                        fontSize={11.5 * u}
                        fontWeight={800}
                        fill="#fff"
                        textAnchor="middle"
                        pointerEvents="none"
                      >
                        {index + 1}
                      </text>
                    </g>
                  );
                })}
            </svg>

            {/* hover tooltip (mouse only) */}
            {tip && (hovered || hoveredProject) && !activeProject && (
              <div
                className="pointer-events-none absolute z-20 hidden -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-xl md:block"
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

            {/* selected complex card */}
            {activeProject && (
              <div className="absolute inset-x-3 bottom-12 z-20 flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xl md:bottom-11">
                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {activeProject.imageUrl && (
                    <Image src={activeProject.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1 pr-5">
                  <span className="block truncate text-sm font-bold text-slate-900">{activeProject.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {activeProject.district || (selected && regionName(selected, locale))}
                  </span>
                  <span className="block truncate text-xs font-semibold text-[#1E3A8A]">
                    {formatUzsPerM2OrNegotiable(activeProject.priceFrom, t("negotiable"))}
                  </span>
                  <Link
                    href={`/catalog/${activeProject.id}`}
                    className="mt-1.5 inline-flex rounded-lg bg-[#F97316] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#EA580C]"
                  >
                    {t("openComplex")}
                  </Link>
                </span>
                <button
                  type="button"
                  aria-label={t("close")}
                  onClick={() => setActiveId(null)}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-1 border-t border-slate-100 px-3 py-2.5 text-[11px] leading-tight text-slate-500 md:flex-row md:items-center md:justify-between md:px-4 md:text-xs">
              {selected ? (
                <span>{narrow ? t("gestureTouch") : t("gestureMouse")}</span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-12 shrink-0 rounded-full bg-gradient-to-r from-[#BFD0F5] to-[#1E3A8A]" />
                  {t("legend")}
                </span>
              )}
              {selected && (
                <span>
                  {regionProjects.some((p) => p.approx) && `${t("approxNote")} · `}© OpenStreetMap
                </span>
              )}
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm md:rounded-3xl md:p-5 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
            {selected ? (
              <>
                <h2 className="text-xl font-black text-[#1E3A8A]">{regionName(selected, locale)}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {projects ? formatProjectsCount(regionProjects.length, locale) : t("loading")}
                </p>
                <Link
                  href={`/catalog?location=${encodeURIComponent(selected.en)}`}
                  className="mt-3 inline-flex rounded-full bg-[#1E3A8A] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#3C55BE]"
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
                          p.id === hoverProject || p.id === activeId
                            ? "border-[#F97316] bg-orange-50"
                            : "border-slate-100 hover:border-slate-300",
                        )}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F97316] text-[11px] font-black text-white">
                          {i + 1}
                        </span>
                        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          {p.imageUrl && <Image src={p.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
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
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-lg font-black text-[#1E3A8A]">{t("allRegions")}</h2>
                  <span className="text-sm text-slate-500">
                    {projects ? formatProjectsCount(total, locale) : t("loading")}
                  </span>
                </div>
                <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">
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
                            "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition",
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
