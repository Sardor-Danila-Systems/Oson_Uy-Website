"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Opening splash: a small residential complex goes up floor by floor (with a
 * crane lifting the last load), the windows light up, and then the two halves
 * of the screen slide apart onto the site. It plays by itself, takes about
 * three seconds and is shown once per browser session (always while developing).
 *
 * The markup is part of the server-rendered page, so nothing flashes before it;
 * an inline script in <head> (see app/layout.tsx) sets `data-splash` on <html>
 * to "on" or "off" before first paint, and this component takes it from there.
 */

interface Tower {
  x: number;
  w: number;
  floors: number;
  delay: number;
}

const GROUND = 190;
const FLOOR = 12;
const TOWERS: Tower[] = [
  { x: 56, w: 46, floors: 9, delay: 0.2 },
  { x: 112, w: 40, floors: 6, delay: 0.42 },
  { x: 162, w: 56, floors: 13, delay: 0 },
  { x: 228, w: 44, floors: 8, delay: 0.55 },
  { x: 282, w: 50, floors: 11, delay: 0.28 },
  { x: 342, w: 38, floors: 5, delay: 0.7 },
];

const BUILD_MS = 2300;
const OPEN_AT = 2650;
const DONE_AT = 3550;

function noise(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export default function SiteSplash() {
  const t = useTranslations("Splash");
  // Development only: ?splashslow=5 plays the splash five times slower, for tuning.
  const [slow, setSlow] = useState(1);
  const [phase, setPhase] = useState<"build" | "open" | "done">("build");
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const finish = () => {
      root.dataset.splash = "done";
      root.style.overflow = "";
      setPhase("done");
      window.dispatchEvent(new Event("oson-splash-end"));
    };

    if (root.dataset.splash !== "on" || reduced) {
      finish();
      return;
    }

    const slowdown =
      process.env.NODE_ENV !== "production" ? Number(new URLSearchParams(location.search).get("splashslow")) || 1 : 1;
    // Applied on the next frame, which is early enough for animations that have only just started.
    const slowFrame = requestAnimationFrame(() => setSlow(slowdown));
    root.style.overflow = "hidden";
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / (BUILD_MS * slowdown));
      setPercent(Math.round((1 - Math.pow(1 - k, 2.2)) * 100));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const open = window.setTimeout(() => setPhase("open"), OPEN_AT * slowdown);
    const done = window.setTimeout(finish, DONE_AT * slowdown);

    return () => {
      cancelAnimationFrame(slowFrame);
      cancelAnimationFrame(raf);
      window.clearTimeout(open);
      window.clearTimeout(done);
      root.style.overflow = "";
    };
  }, []);

  // Floors, windows and their delays are fixed, so the markup is the same on the server and the client.
  const floors = useMemo(
    () =>
      TOWERS.flatMap((tw, ti) =>
        Array.from({ length: tw.floors }, (_, i) => {
          const cols = Math.max(2, Math.floor(tw.w / 13));
          return {
            key: `${ti}-${i}`,
            x: tw.x,
            y: GROUND - (i + 1) * FLOOR,
            w: tw.w,
            delay: tw.delay + i * 0.075,
            windows: Array.from({ length: cols }, (_, c) => ({
              x: tw.x + 5 + c * ((tw.w - 10) / cols) + 1,
              w: (tw.w - 10) / cols - 2.5,
              lit: noise(ti * 31 + c, i + 5) < 0.55,
              delay: 1.55 + noise(ti + c * 7, i * 3) * 0.75,
            })),
          };
        }),
      ),
    [],
  );

  if (phase === "done") return null;

  return (
    <>
      <style>{`
        html[data-splash="off"] #oson-splash { display: none; }
        #oson-splash { position: fixed; inset: 0; z-index: 200; pointer-events: auto; }
        #oson-splash .os-half { position: absolute; top: 0; bottom: 0; width: 50.2%; background: #1e3a8a; transition: transform calc(.85s * var(--os, 1)) cubic-bezier(.77,0,.18,1); will-change: transform; }
        #oson-splash .os-left { left: 0; background: linear-gradient(135deg, #1b3380, #1e3a8a 60%, #234199); }
        #oson-splash .os-right { right: 0; background: linear-gradient(225deg, #1b3380, #1e3a8a 60%, #234199); }
        #oson-splash[data-phase="open"] .os-left { transform: translateX(-101%); }
        #oson-splash[data-phase="open"] .os-right { transform: translateX(101%); }
        #oson-splash .os-stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 24px; transition: opacity calc(.35s * var(--os, 1)) ease, transform calc(.5s * var(--os, 1)) ease; }
        #oson-splash[data-phase="open"] .os-stage { opacity: 0; transform: scale(.96); }
        @keyframes os-floor { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: none; } }
        @keyframes os-win { from { opacity: 0; } to { opacity: 1; } }
        @keyframes os-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes os-swing { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
        @keyframes os-blink { 0%,100% { opacity: 1; } 50% { opacity: .2; } }
        @keyframes os-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        #oson-splash .os-floor { transform-box: fill-box; animation: os-floor calc(.26s * var(--os, 1)) cubic-bezier(.2,.8,.3,1) backwards; }
        #oson-splash .os-win { animation: os-win calc(.35s * var(--os, 1)) ease backwards; }
        #oson-splash .os-mast { transform-box: fill-box; transform-origin: bottom; animation: os-grow calc(.7s * var(--os, 1)) cubic-bezier(.3,.7,.2,1) backwards; }
        #oson-splash .os-load { transform-box: view-box; transform-origin: 392px 40px; animation: os-swing 2.2s ease-in-out infinite; }
        #oson-splash .os-light { animation: os-blink 1s steps(1) infinite; }
        #oson-splash .os-word { animation: os-rise calc(.6s * var(--os, 1)) calc(.2s * var(--os, 1)) ease backwards; }
        #oson-splash .os-bar-fill { transform-origin: left; }
      `}</style>

      <div id="oson-splash" role="status" aria-label={t("tagline")} data-phase={phase} style={{ ["--os" as string]: slow }}>
        <div className="os-half os-left" />
        <div className="os-half os-right" />

        <div className="os-stage">
          <svg viewBox="0 0 480 215" width="100%" style={{ maxWidth: 520, overflow: "visible" }} aria-hidden="true">
            <line x1="20" y1={GROUND + 1} x2="460" y2={GROUND + 1} stroke="#ffffff" strokeOpacity=".35" strokeWidth="2" />

            {floors.map((f) => (
              <g key={f.key}>
                <rect
                  className="os-floor"
                  x={f.x}
                  y={f.y}
                  width={f.w}
                  height={FLOOR - 1}
                  fill="#ffffff"
                  fillOpacity=".93"
                  style={{ animationDelay: `calc(${f.delay}s * var(--os, 1))` }}
                />
                {f.windows.map((w, i) => (
                  <rect
                    key={i}
                    className="os-win"
                    x={w.x}
                    y={f.y + 3}
                    width={w.w}
                    height={5}
                    rx={0.6}
                    fill={w.lit ? "#F97316" : "#1e3a8a"}
                    fillOpacity={w.lit ? 1 : 0.55}
                    style={{ animationDelay: `calc(${w.delay}s * var(--os, 1))` }}
                  />
                ))}
              </g>
            ))}

            {/* the crane works on the right of the site */}
            <g className="os-mast">
              <path d="M424 190V32M436 190V32M424 190L436 178L424 166L436 154L424 142L436 130L424 118L436 106L424 94L436 82L424 70L436 58L424 46L436 34" fill="none" stroke="#F97316" strokeWidth="3" strokeLinejoin="round" />
              <rect x="416" y="187" width="28" height="5" fill="#F97316" />
            </g>
            <path d="M430 28L430 12M430 12L372 30M430 12L452 30M300 30H468M300 38H468M300 30L330 38L360 30L390 38L420 30L450 38" fill="none" stroke="#F97316" strokeWidth="3" strokeLinejoin="round" style={{ animation: "os-rise calc(.5s * var(--os, 1)) calc(.45s * var(--os, 1)) ease backwards" }} />
            <rect x="446" y="30" width="22" height="14" fill="#F97316" />
            <g className="os-load">
              <path d="M392 40V104" stroke="#ffffff" strokeWidth="2" />
              <rect x="380" y="104" width="24" height="16" fill="#ffffff" />
              <path d="M380 109H404M380 114H404" stroke="#F97316" strokeWidth="2.5" />
            </g>
            <circle className="os-light" cx="430" cy="9" r="3.4" fill="#ff4b3a" />
          </svg>

          <div style={{ textAlign: "center", color: "#fff" }}>
            <div
              className="os-word"
              style={{ fontFamily: 'var(--font-sans), "Arial Black", system-ui, sans-serif', fontSize: "clamp(34px, 8vw, 56px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}
            >
              Oson <span style={{ color: "#F97316" }}>Uy</span>
            </div>
            <div className="os-word" style={{ marginTop: 10, fontSize: 14, fontWeight: 600, opacity: 0.8, animationDelay: "calc(.35s * var(--os, 1))" }}>
              {t("tagline")}
            </div>
          </div>

          <div style={{ width: "min(260px, 70vw)" }}>
            <div style={{ height: 3, borderRadius: 3, background: "rgba(255,255,255,.2)", overflow: "hidden" }}>
              <div className="os-bar-fill" style={{ height: "100%", background: "#F97316", transform: `scaleX(${percent / 100})` }} />
            </div>
            <div style={{ marginTop: 8, textAlign: "center", color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: ".2em", opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>
              {percent}%
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
