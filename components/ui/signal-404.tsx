"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Brand navy field, with white and orange glyphs on it. */
const GROUND = "#1e3a8a";
const MARKS = ["#ffffff", "#F97316"] as const;

type Glyph = "square" | "diamond" | "ring" | "x";

const TAU = Math.PI * 2;

const settings = {
  seed: 3827,
  cells: 88,
  bands: 6,
  wave: 0.45,
  tilt: -0.69,
  detail: 0.63,
  size: 0.79,
  edges: 0.7,
  flecks: 0.03,
  smears: 0.26,
  dots: 0.45,
  drift: 0.6,
  fps: 12,
  frames: 36,
};

function hash(x: number, y: number, seed: number) {
  let value = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1274126177);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function noise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const dx = x - x0;
  const dy = y - y0;
  const sx = dx * dx * (3 - 2 * dx);
  const sy = dy * dy * (3 - 2 * dy);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

function xorshift(seed: number) {
  let value = seed >>> 0 || 1;
  return () => {
    value ^= value << 13;
    value >>>= 0;
    value ^= value >>> 17;
    value >>>= 0;
    value ^= value << 5;
    value >>>= 0;
    return value / 4294967296;
  };
}

/** Per-band glyph and ink, and the scalar field that decides which band a cell is in. */
function makeField(phase: number) {
  const driftX = Math.cos(phase) * settings.drift * 0.4;
  const driftY = Math.sin(phase) * settings.drift * 0.4;
  const seedA = settings.seed * 7 + 1;
  const generator = xorshift((Math.imul(settings.seed, 2246822519) ^ 0x27d4eb2f) >>> 0);
  const glyphs: Glyph[] = ["square", "diamond", "ring", "x"];
  const bandGlyph: Glyph[] = [];
  const bandInk: string[] = [];
  let previousGlyph = -1;
  let previousInk = -1;

  for (let band = 0; band < settings.bands; band += 1) {
    let glyphIndex = (generator() * glyphs.length) | 0;
    if (glyphIndex === previousGlyph) glyphIndex = (glyphIndex + 1) % glyphs.length;
    let inkIndex = (generator() * MARKS.length) | 0;
    if (inkIndex === previousInk) inkIndex = (inkIndex + 1) % MARKS.length;
    bandGlyph.push(glyphs[glyphIndex]!);
    bandInk.push(MARKS[inkIndex]!);
    previousGlyph = glyphIndex;
    previousInk = inkIndex;
  }

  const spine = 0.5 + (generator() - 0.5) * 0.2;
  const secondY = 0.55 + generator() * 0.3;
  const secondX = 0.3 + generator() * 0.4;
  const detailScale = 1 + settings.detail * 3;
  const wave = settings.wave;

  const scalar = (u: number, v: number) => {
    const widthAtV =
      0.16 +
      0.5 *
        wave *
        (0.3 +
          noise(v * detailScale * 1.6 + driftX + 3, 0.5 + driftY, seedA) +
          0.35 * noise(v * detailScale * 4 + driftY + 9, 1.5 + driftX, seedA));
    const centerAtV = spine + settings.tilt * (v - 0.5);
    const mainFigure = Math.abs(u - centerAtV) / widthAtV;
    const secondWidth =
      0.12 + 0.36 * wave * (0.4 + noise(v * detailScale * 1.9 + driftX + 13, 2.5 + driftY, seedA));
    const secondFigure =
      Math.sqrt(((u - secondX) / secondWidth) ** 2 + ((v - secondY) / (secondWidth * 1.6)) ** 2) * 0.9;
    return Math.min(1, mainFigure, secondFigure);
  };

  return { scalar, bandGlyph, bandInk };
}

function paint(context: CanvasRenderingContext2D, width: number, height: number, phase: number) {
  if (!width || !height) return;
  const seed = settings.seed;
  const dotColor = "rgba(255,255,255,0.22)";
  const { scalar, bandGlyph, bandInk } = makeField(phase);
  const columns = Math.max(8, settings.cells | 0);
  const cellSize = width / columns;
  const rows = Math.ceil(height / cellSize);
  const glyphSize = cellSize * settings.size;
  const bands = new Int8Array(columns * rows);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let band = Math.floor(scalar((column + 0.5) / columns, (row + 0.5) / rows) * settings.bands);
      if (band >= settings.bands) band = settings.bands - 1;
      bands[row * columns + column] = band;
    }
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;
  context.fillStyle = GROUND;
  context.fillRect(0, 0, width, height);
  context.lineCap = "butt";
  context.lineJoin = "miter";

  // A few rows are smeared into solid horizontal bars.
  const smearStart = new Int16Array(rows).fill(-1);
  const smearLength = new Int16Array(rows);
  for (let row = 0; row < rows; row += 1) {
    if (hash(row, 1, seed) < settings.smears) {
      smearStart[row] = Math.floor(hash(row, 2, seed) * columns);
      smearLength[row] = 3 + Math.floor(hash(row, 3, seed) * Math.min(14, columns * 0.2));
    }
  }

  for (let row = 0; row < rows; row += 1) {
    const y = (row + 0.5) * cellSize;
    for (let column = 0; column < columns; column += 1) {
      const x = (column + 0.5) * cellSize;
      const band = bands[row * columns + column]!;
      const randomCell = hash(column, row, seed);

      // The outermost band is the quiet background: faint dots and rare flecks.
      if (band === settings.bands - 1) {
        if (settings.dots > 0 && randomCell > settings.flecks * 0.4) {
          context.fillStyle = dotColor;
          context.beginPath();
          context.arc(x, y, Math.max(0.3, cellSize * 0.09 * settings.dots), 0, TAU);
          context.fill();
        } else if (settings.flecks > 0 && randomCell <= settings.flecks * 0.4) {
          context.fillStyle = MARKS[(hash(column, row + 7, seed) * MARKS.length) | 0]!;
          context.fillRect(x - glyphSize * 0.3, y - glyphSize * 0.3, glyphSize * 0.6, glyphSize * 0.6);
        }
        continue;
      }

      let ink = bandInk[band]!;
      let kind = bandGlyph[band]!;
      if (randomCell < settings.flecks) {
        ink = MARKS[(hash(column, row + 7, seed) * MARKS.length) | 0]!;
        kind = "square";
      } else {
        const right = column + 1 < columns ? bands[row * columns + column + 1] : band;
        const left = column > 0 ? bands[row * columns + column - 1] : band;
        const below = row + 1 < rows ? bands[(row + 1) * columns + column] : band;
        const above = row > 0 ? bands[(row - 1) * columns + column] : band;
        const edge = right !== band || left !== band || below !== band || above !== band;
        if (edge && hash(column, row + 3, seed) < settings.edges) {
          kind = "x";
          const current = Math.max(0, MARKS.indexOf(ink as (typeof MARKS)[number]));
          const offset = 1 + ((hash(column, row + 11, seed) * (MARKS.length - 1)) | 0);
          ink = MARKS[(current + offset) % MARKS.length]!;
        }
      }

      if (smearStart[row]! >= 0 && column >= smearStart[row]! && column < smearStart[row]! + smearLength[row]!) {
        context.fillStyle = ink;
        context.fillRect(x - cellSize * 0.5, y - glyphSize * 0.32, cellSize + 0.5, glyphSize * 0.64);
        continue;
      }

      context.fillStyle = ink;
      if (kind === "square") {
        context.fillRect(x - glyphSize * 0.5, y - glyphSize * 0.5, glyphSize, glyphSize);
      } else if (kind === "diamond") {
        const h = glyphSize * 0.55;
        context.beginPath();
        context.moveTo(x, y - h);
        context.lineTo(x + h * 0.78, y);
        context.lineTo(x, y + h);
        context.lineTo(x - h * 0.78, y);
        context.closePath();
        context.fill();
      } else if (kind === "ring") {
        context.fillRect(x - glyphSize * 0.5, y - glyphSize * 0.5, glyphSize, glyphSize);
        context.strokeStyle = GROUND;
        context.lineWidth = Math.max(0.6, glyphSize * 0.1);
        context.beginPath();
        context.arc(x, y, glyphSize * 0.3, 0, TAU);
        context.stroke();
        context.fillStyle = GROUND;
        context.beginPath();
        context.arc(x, y, glyphSize * 0.1, 0, TAU);
        context.fill();
      } else {
        context.strokeStyle = ink;
        context.lineWidth = Math.max(0.6, glyphSize * 0.16);
        const h = glyphSize * 0.36;
        context.beginPath();
        context.moveTo(x - h, y - h);
        context.lineTo(x + h, y + h);
        context.moveTo(x + h, y - h);
        context.lineTo(x - h, y + h);
        context.stroke();
      }
    }
  }
}

/** A tower crane standing in for the zero of "404": lattice mast, jib, counterweight and a swinging load. */
function CraneNought() {
  const ink = GROUND;
  const orange = "#F97316";
  // Lattice zigzag between two verticals, as one path.
  const zig = (x0: number, x1: number, y0: number, y1: number, step: number) => {
    let d = `M${x0} ${y0}`;
    let right = true;
    for (let y = y0; y < y1; y += step) {
      d += `L${right ? x1 : x0} ${Math.min(y + step, y1)}`;
      right = !right;
    }
    return d;
  };
  const mast = zig(46, 58, 34, 146, 12);
  const jib = "M52 22L112 22M52 32L112 32M52 22L112 32M64 22L64 32M64 32L76 22M76 22L76 32M76 32L88 22M88 22L88 32M88 32L100 22M100 22L100 32";
  const counter = "M52 24L14 24M52 32L14 32M26 24L26 32M38 24L38 32";

  const shape = (
    <>
      <path d="M40 148H64V158H40Z" />
      <path d="M46 34V148M58 34V148" />
      <path d={mast} />
      <path d={jib} />
      <path d={counter} />
      <path d="M52 22L52 4L46 22M52 4L58 22" />
      <path d="M52 6L100 22M52 6L12 24" />
      <rect x={10} y={30} width={16} height={16} />
      <rect x={42} y={30} width={20} height={4} />
    </>
  );

  return (
    <svg
      viewBox="0 0 120 160"
      aria-hidden="true"
      className="signal-404-crane"
      style={{ height: "0.78em", width: "auto", overflow: "visible", flex: "none" }}
    >
      <style>{`
        @keyframes signal-404-swing { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
        @keyframes signal-404-blink { 0%,100% { opacity: 1; } 50% { opacity: .15; } }
        @keyframes signal-404-slide { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-16px); } }
        .signal-404-load { transform-box: view-box; transform-origin: 96px 30px; animation: signal-404-swing 3.4s ease-in-out infinite; }
        .signal-404-trolley { animation: signal-404-slide 7s ease-in-out infinite; }
        .signal-404-light { animation: signal-404-blink 1.1s steps(1) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .signal-404-load, .signal-404-trolley, .signal-404-light { animation: none; }
        }
      `}</style>

      {/* outline in the field colour, so the crane reads over the busy glyphs */}
      <g fill={ink} stroke={ink} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round">
        {shape}
        <g className="signal-404-trolley">
          <g className="signal-404-load">
            <path d="M96 32V104" fill="none" />
            <rect x={84} y={104} width={24} height={20} />
          </g>
        </g>
      </g>

      <g fill="none" stroke={orange} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
        {shape}
      </g>
      <g fill={orange} stroke="none">
        <rect x={10} y={30} width={16} height={16} />
        <rect x={40} y={148} width={24} height={10} />
      </g>
      <g className="signal-404-trolley">
        <g className="signal-404-load">
          <path d="M96 32V104" fill="none" stroke="#ffffff" strokeWidth={2.4} />
          <rect x={84} y={104} width={24} height={20} fill="#ffffff" />
          <path d="M84 110H108M84 116H108" stroke={orange} strokeWidth={3} />
        </g>
      </g>
      <circle className="signal-404-light" cx={52} cy={2} r={4.2} fill="#ff4b3a" />
    </svg>
  );
}

/**
 * Full-bleed 404 page: a navy field of dithered glyphs drifting slowly behind
 * an oversized "4 [tower crane] 4". The field is drawn on a canvas, so there are
 * no assets to load; the zero is a crane that keeps lifting its load.
 */
export default function Signal404({
  children,
  label = "404",
}: {
  /** Text and actions shown at the bottom of the screen. */
  children?: ReactNode;
  /** Accessible name of the numeral. */
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const interval = 1000 / settings.fps;
    let width = 0;
    let height = 0;
    let frame = 30;
    let origin = 0;
    let request = 0;

    const draw = () => paint(context, width, height, (frame / settings.frames) * TAU);

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(bounds.width * scale));
      height = Math.max(1, Math.round(bounds.height * scale));
      canvas.width = width;
      canvas.height = height;
      draw();
    };

    const animate = (time: number) => {
      const next = Math.floor((time - origin) / interval) % settings.frames;
      if (next !== frame) {
        frame = next;
        draw();
      }
      request = window.requestAnimationFrame(animate);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (!reduced) {
      origin = performance.now() - frame * interval;
      request = window.requestAnimationFrame(animate);
    }

    return () => {
      window.cancelAnimationFrame(request);
      observer.disconnect();
    };
  }, []);

  const outline = (c: string) =>
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0.7, 0.7],
      [-0.7, 0.7],
      [0.7, -0.7],
      [-0.7, -0.7],
    ]
      .map(([x, y]) => `${(x! * 0.05).toFixed(3)}em ${(y! * 0.05).toFixed(3)}em 0 ${c}`)
      .join(",");

  return (
    <div
      data-slot="signal-404"
      style={{
        position: "relative",
        width: "100%",
        height: "100dvh",
        minHeight: 480,
        overflow: "hidden",
        isolation: "isolate",
        background: GROUND,
      }}
    >
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", background: GROUND }}>
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      </div>

      <h1
        aria-label={label}
        style={{
          position: "absolute",
          zIndex: 1,
          top: "42%",
          left: "50%",
          margin: 0,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: "0.05em",
          transform: "translate(-50%, -50%)",
          color: "#fff",
          fontFamily: 'var(--font-sans), "Arial Black", "Helvetica Neue", system-ui, sans-serif',
          fontSize: "min(440px, 46vw, 46vh)",
          fontWeight: 900,
          letterSpacing: "-0.02em",
          lineHeight: 0.8,
          textShadow: outline(GROUND),
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        <span aria-hidden="true">4</span>
        <CraneNought />
        <span aria-hidden="true">4</span>
      </h1>

      {children ? (
        <div
          style={{
            position: "absolute",
            zIndex: 2,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            justifyContent: "center",
            padding: "0 16px max(28px, env(safe-area-inset-bottom))",
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
