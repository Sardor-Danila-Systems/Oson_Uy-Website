"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowDown } from "lucide-react";

// three.js is only needed in the browser, and only for this section.
const BuildScene = dynamic(() => import("@/components/home/BuildScene"), { ssr: false });

/** 0 → 1 over [a, b], held, then 1 → 0 over [c, d] of the scroll. */
function windowAt(p: number, a: number, b: number, c: number, d: number) {
  if (p <= a || p >= d) return 0;
  if (p < b) return (p - a) / (b - a);
  if (p <= c) return 1;
  return (d - p) / (d - c);
}

const INTRO_MS = 2600;
/** How far the build runs by itself when the page opens, before any scrolling. */
const INTRO_PROGRESS = 0.14;

/**
 * Opening of the home page. A residential complex goes up in 3D while the
 * visitor scrolls: the scene stays pinned to the screen, scroll drives the
 * construction, and when the last tower is finished the pin lets go and the
 * ordinary page continues. A short part plays by itself on arrival, so the
 * page is alive before the first scroll.
 */
export function BuildScrollIntro() {
  const t = useTranslations("Home");
  // null until checked on the client; false means no WebGL, and the section is left out.
  const [supported, setSupported] = useState<boolean | null>(null);
  const [live, setLive] = useState(true);
  const trackRef = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const scrolled = useRef(0);

  const { scrollYProgress } = useScroll({ target: trackRef, offset: ["start start", "end end"] });

  // The scene reads one number: whichever is further along, the self-playing
  // opening or the scroll position.
  const write = (auto: number) => {
    progress.current = Math.max(auto, scrolled.current);
  };
  const autoRef = useRef(0);

  // Captions are written straight to the DOM from the scroll position, so they
  // never lag behind or depend on the browser's scroll-timeline support.
  const titleEl = useRef<HTMLDivElement>(null);
  const hintEl = useRef<HTMLDivElement>(null);
  const barEl = useRef<HTMLDivElement>(null);
  const stepEls = useRef<(HTMLDivElement | null)[]>([]);
  const applyCaptions = (v: number) => {
    if (titleEl.current) titleEl.current.style.opacity = String(1 - Math.min(1, Math.max(0, (v - 0.1) / 0.1)));
    if (hintEl.current) hintEl.current.style.opacity = String(1 - Math.min(1, v / 0.04));
    if (barEl.current) barEl.current.style.transform = `scaleX(${v})`;
    const spans: [number, number, number, number][] = [
      [0.12, 0.18, 0.3, 0.36],
      [0.38, 0.44, 0.56, 0.62],
      [0.64, 0.7, 0.8, 0.86],
      [0.88, 0.93, 0.999, 1],
    ];
    spans.forEach(([a, b, c, d], i) => {
      const el = stepEls.current[i];
      if (!el) return;
      const o = windowAt(v, a, b, c, d);
      el.style.opacity = String(o);
      el.style.transform = `translateY(${(1 - o) * 18}px)`;
    });
  };

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    scrolled.current = v;
    write(autoRef.current);
    applyCaptions(v);
  });

  useEffect(() => {
    const probe = () => {
      try {
        const canvas = document.createElement("canvas");
        setSupported(Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl")));
      } catch {
        setSupported(false);
      }
    };
    probe();
  }, []);

  // Stop drawing while the section is far off-screen; the last frame stays.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || !supported) return;
    const io = new IntersectionObserver(([entry]) => setLive(entry?.isIntersecting ?? true), { rootMargin: "200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [supported]);

  // react-three-fiber can miss its first measurement when the canvas mounts
  // late (it is loaded on demand); a resize nudge makes it measure and draw.
  useEffect(() => {
    const nudge = () => window.dispatchEvent(new Event("resize"));
    const ids = [60, 400, 1200].map((ms) => window.setTimeout(nudge, ms));
    return () => ids.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    scrolled.current = scrollYProgress.get();
    applyCaptions(scrolled.current);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / INTRO_MS);
      autoRef.current = INTRO_PROGRESS * (1 - Math.pow(1 - k, 3));
      write(autoRef.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    const el = trackRef.current;
    if (!el) return;
    window.scrollTo({ top: el.offsetTop + el.offsetHeight, behavior: "smooth" });
  };

  if (supported === false) return null;

  return (
    <section ref={trackRef} className="relative h-[330vh] w-full bg-[#9bb6e6] md:h-[380vh]" aria-label={t("introTitle")}>
      <div className="sticky top-0 h-svh w-full overflow-hidden">
        <BuildScene progress={progress} active={live} className="!absolute inset-0 size-full" />

        {/* soft shades keep the header and the captions legible over the scene */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-slate-900/15 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-slate-950/55 via-slate-950/20 to-transparent" />

        <div ref={titleEl} className="pointer-events-none absolute inset-x-0 top-24 px-5 text-center md:top-28">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/90 drop-shadow md:text-sm">Oson Uy</p>
          <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_18px_rgba(15,23,42,0.45)] sm:text-5xl md:text-6xl">
            {t("introTitle")}
          </h2>
        </div>

        <div className="pointer-events-none absolute bottom-10 left-5 right-5 md:bottom-14 md:left-14 md:right-auto md:w-[28rem]">
          {(["introStep1", "introStep2", "introStep3"] as const).map((k, i) => (
            <div key={k} ref={(el) => void (stepEls.current[i] = el)} className="absolute bottom-0 left-0 right-0 opacity-0">
              <p className="text-xs font-bold tracking-[0.25em] text-orange-300">0{i + 1}</p>
              <p className="mt-1 text-2xl font-black leading-tight text-white drop-shadow-[0_2px_14px_rgba(15,23,42,0.55)] md:text-3xl">
                {t(k)}
              </p>
              <p className="mt-2 text-sm font-medium text-white/85 drop-shadow md:text-base">{t(`${k}Text`)}</p>
            </div>
          ))}
          <div ref={(el) => void (stepEls.current[3] = el)} className="absolute bottom-0 left-0 right-0 opacity-0">
            <p className="text-2xl font-black leading-tight text-white drop-shadow-[0_2px_14px_rgba(15,23,42,0.55)] md:text-3xl">
              {t("introDone")}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-orange-300 md:text-base">
              {t("introDoneText")} <ArrowDown className="h-4 w-4 animate-bounce" />
            </p>
          </div>
        </div>

        <div
          ref={hintEl}
          className="pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white drop-shadow md:bottom-10"
        >
          {t("introScroll")}
          <ArrowDown className="h-5 w-5 animate-bounce" />
        </div>

        <button
          type="button"
          onClick={skip}
          className="absolute right-4 top-20 z-10 cursor-pointer rounded-full border border-white/40 bg-slate-900/25 px-4 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-slate-900/45 md:right-8 md:top-24"
        >
          {t("introSkip")}
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/15">
          <div ref={barEl} className="h-full origin-left bg-[#F97316]" style={{ transform: "scaleX(0)" }} />
        </div>
      </div>
    </section>
  );
}
