"use client";

import { useEffect, useRef } from "react";

/**
 * Hero skyline: residential complexes built out of halftone dots.
 *
 * The scene is generated on the dot grid itself, so there is no image to load.
 * Two rows of towers (a dim far row, a brighter near row) are drawn floor by
 * floor from the ground up, left to right; once a tower is finished its
 * windows start to light up one by one. The rows drift against each other, a
 * light band crosses the skyline, and dots swell near the pointer.
 *
 * One canvas, one rAF loop, a few thousand dots a frame. The loop pauses
 * off-screen and on hidden tabs; under reduced motion it draws one finished
 * frame.
 */

const ACCENT = "#F97316";

const BODY = 1;
const WINDOW = 2;
const ROOF = 3;

type Layer = "far" | "near";

interface Building {
  layer: Layer;
  /** Seconds before this tower starts to grow. */
  delay: number;
  /** Seconds it takes to reach full height. */
  grow: number;
  /** Rows tall, for the floor-by-floor reveal. */
  height: number;
}

interface Scene {
  cols: number;
  rows: number;
  kind: Uint8Array;
  owner: Int16Array;
  /** 0 at the ground, 1 at the roof of the owning building. */
  rise: Float32Array;
  /** Wall cells on the outline of their tower. */
  edge: Uint8Array;
  buildings: Building[];
}

/** Small seeded generator: the skyline is the same on every visit. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function buildScene(cols: number, rows: number): Scene {
  const kind = new Uint8Array(cols * rows);
  const owner = new Int16Array(cols * rows).fill(-1);
  const rise = new Float32Array(cols * rows);
  const edge = new Uint8Array(cols * rows);
  const buildings: Building[] = [];
  const rand = rng(20261026);
  const ground = rows - 2;

  const markEdge = (x: number, y: number) => {
    edge[y * cols + x] = 1;
  };

  const put = (x: number, y: number, k: number, id: number, r: number) => {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return;
    const at = y * cols + x;
    kind[at] = k;
    owner[at] = id;
    rise[at] = r;
  };

  /**
   * One tower: a body with a window grid, optionally stepped at the top, and
   * a small roof detail. `width` and `height` are in cells.
   */
  function tower(layer: Layer, x0: number, width: number, height: number, stepped: boolean, delay: number) {
    const id = buildings.length;
    buildings.push({ layer, delay, grow: 1.1 + height / rows, height });
    const top = ground - height;
    for (let y = top; y <= ground; y++) {
      const r = (ground - y) / Math.max(1, height);
      // The crown of a stepped tower is narrower than its base.
      const inset = stepped && r > 0.78 ? Math.max(1, Math.floor(width / 4)) : 0;
      for (let x = x0 + inset; x < x0 + width - inset; x++) {
        const edge = x === x0 + inset || x === x0 + width - inset - 1 || y === top;
        const row = ground - y;
        // Windows sit on every other cell, inside a one-cell wall, above the entrance.
        const window = !edge && row > 1 && (x - x0) % 2 === 1 && row % 2 === 0;
        put(x, y, window ? WINDOW : BODY, id, r);
        if (edge && !window) markEdge(x, y);
      }
    }
    // Antenna / crown detail.
    const mid = x0 + Math.floor(width / 2);
    const tip = stepped ? 3 : 1 + Math.floor(rand() * 2);
    for (let k = 1; k <= tip; k++) put(mid, top - k, ROOF, id, 1);
  }

  const wBase = Math.max(5, Math.round(cols / (cols < 70 ? 7 : 12)));

  // Far row: lower, narrower, packed.
  let x = -2;
  let order = 0;
  while (x < cols) {
    const width = Math.max(4, Math.round(wBase * (0.7 + rand() * 0.6)));
    const height = Math.round(rows * (0.22 + rand() * 0.22));
    tower("far", x, width, height, rand() > 0.7, order * 0.1 + rand() * 0.25);
    x += width + (rand() > 0.55 ? 1 : 0);
    order++;
  }

  // Near row: taller landmarks with gaps, drawn on top of the far row.
  x = Math.round(wBase * -0.4);
  order = 0;
  while (x < cols) {
    const slab = rand() > 0.55;
    const width = Math.max(5, Math.round(wBase * (slab ? 1.35 : 0.9) * (0.85 + rand() * 0.3)));
    const height = Math.round(rows * (slab ? 0.38 + rand() * 0.16 : 0.58 + rand() * 0.34));
    tower("near", x, width, height, !slab && rand() > 0.5, 0.2 + order * 0.16 + rand() * 0.2);
    x += width + 1 + Math.floor(rand() * 3);
    order++;
  }

  return { cols, rows, kind, owner, rise, edge, buildings };
}

export function AsciiSkyline({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let scene: Scene | null = null;
    let width = 0;
    let height = 0;
    let cell = 10;
    let raf = 0;
    let visible = true;
    let startedAt = 0;
    const pointer = { x: -9999, y: -9999, active: false };

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = width < 640 ? 8 : width < 1280 ? 10 : 12;
      scene = buildScene(Math.ceil(width / cell), Math.ceil(height / cell));
    }

    function frame(now: number) {
      if (!scene) return;
      if (!startedAt) startedAt = now;
      const t = reduced ? 30 : (now - startedAt) / 1000;
      const { cols, rows, kind, owner, rise, edge, buildings } = scene;

      ctx!.clearRect(0, 0, width, height);
      const white = new Path2D();
      const faint = new Path2D();
      const accent = new Path2D();
      const light = ((t * 0.12) % 1.6) - 0.3; // light band, in view widths

      const progress = buildings.map((b) => smooth(0, 1, (t - b.delay) / b.grow));
      const sway = reduced ? 0 : Math.sin(t * 0.32) * cell * 1.1;

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const at = j * cols + i;
          const k = kind[at]!;
          if (!k) continue;
          const id = owner[at]!;
          const b = buildings[id]!;
          const p = progress[id]!;
          // Floors appear from the ground up as the tower grows.
          if (rise[at]! > p) continue;

          const near = b.layer === "near";
          const px = (i + 0.5) * cell + (near ? sway : -sway * 0.6);
          const py = (j + 0.5) * cell;

          let radius: number;
          let lit = false;
          if (k === WINDOW) {
            // Windows are gaps in the wall; they switch on slowly once the tower is finished.
            const done = smooth(0.96, 1, p);
            const turn = hash(i, j, Math.floor(t * 0.22 + hash(i, j) * 6));
            lit = done > 0 && turn < 0.4 * done;
            if (!lit) continue;
            radius = 0.52;
          } else if (k === ROOF) {
            radius = 0.34;
          } else {
            // Walls: the outline is denser than the fill so each tower reads as a shape.
            radius = edge[at] ? 0.46 : 0.3;
          }
          if (!near) radius *= 0.7;

          // The tower's top edge flares while it is still being built.
          if (p < 1 && Math.abs(rise[at]! - p) < 0.04) radius = Math.max(radius, 0.5);

          const band = 1 - Math.min(1, Math.abs(px / width - light) * 6);
          radius *= 1 + 0.35 * band;

          if (pointer.active) {
            const dx = px - pointer.x;
            const dy = py - pointer.y;
            const fall = Math.exp(-(dx * dx + dy * dy) / (2 * 90 * 90));
            radius = Math.max(radius * (1 + 0.9 * fall), 0.3 * fall);
          }

          const r = Math.min(0.62, radius) * cell * 0.92;
          if (r < 0.5) continue;
          const path = lit ? accent : near ? white : faint;
          path.moveTo(px + r, py);
          path.arc(px, py, r, 0, Math.PI * 2);
        }
      }

      // White over the dark video, fading into navy where the hero turns pale.
      const tone = (alpha: number) => {
        const g = ctx!.createLinearGradient(0, height * 0.1, 0, height * 0.95);
        g.addColorStop(0, `rgba(255,255,255,${alpha})`);
        g.addColorStop(1, `rgba(30,58,138,${Math.min(1, alpha + 0.25)})`);
        return g;
      };
      ctx!.fillStyle = tone(0.4);
      ctx!.fill(faint);
      ctx!.fillStyle = tone(1);
      ctx!.fill(white);
      ctx!.fillStyle = ACCENT;
      ctx!.fill(accent);
    }

    function loop(now: number) {
      raf = 0;
      if (!visible || document.hidden) return;
      frame(now);
      raf = requestAnimationFrame(loop);
    }

    function start() {
      if (raf || reduced) return;
      raf = requestAnimationFrame(loop);
    }

    resize();
    if (reduced) frame(performance.now());
    else start();

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reduced) frame(performance.now());
    });
    resizeObserver.observe(canvas);

    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) start();
    });
    visibility.observe(canvas);

    const onVisibility = () => {
      if (!document.hidden) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active =
        event.pointerType !== "touch" && pointer.y >= 0 && pointer.y <= rect.height;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
