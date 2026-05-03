"use client";

import { Canvas, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Html,
  PerspectiveCamera,
  RoundedBox,
  useCursor,
} from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import * as THREE from "three";
import type { ProjectFloor } from "@/types";

export type BuildingModelStaticProps = {
  floors: ProjectFloor[];
  hoverId: number | null;
  onHover: (id: number | null) => void;
  onPick: (floor: ProjectFloor) => void;
};

/** Высота одного яруса в модели (больше — проще попасть на этаж). */
const FH = 0.3;
const W = 4.6;
const D_CORE = 0.58;
const BALCONY_D = 0.38;
const D_TOTAL = D_CORE + BALCONY_D;
const SECTION_COUNT = 3;
const ROT_Y = 0;

/** «Поднять» корпус над плоскостью земли (только визуализация). */
const VISUAL_FLOOR_LIFT = FH * 2;

/** Палитра близко к референсному фасаду: терракота 1-го, крем серединных, пояс крыши */
const REF = {
  ground: "#b5655a",
  groundDeep: "#8f463e",
  plinth: "#6b3a33",
  cream: "#ebe4d6",
  creamAlt: "#dfd5c4",
  band: "#a05045",
  glass: "#9ecae8",
  glassBalcony: "#7eb8dc",
  frame: "#4a3f36",
  pilaster: "#5a534c",
  floorLine: "#9a9285",
  rail: "#6b7280",
  sill: "#d8d0c4",
  roof: "#7a828c",
};

function CameraFit({
  buildingRef,
  deps,
}: {
  buildingRef: React.RefObject<THREE.Group | null>;
  deps: unknown[];
}) {
  const { camera, size } = useThree();

  useLayoutEffect(() => {
    const g = buildingRef.current;
    if (!g) return;
    if (size.width < 4 || size.height < 4) return;

    g.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(g);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const sizeVec = box.getSize(new THREE.Vector3());
    if (
      !Number.isFinite(center.x) ||
      !Number.isFinite(sizeVec.x) ||
      sizeVec.x <= 0 ||
      sizeVec.y <= 0
    ) {
      return;
    }

    const persp = camera as THREE.PerspectiveCamera;
    const vFov = (persp.fov * Math.PI) / 180;
    const aspect = size.width / Math.max(size.height, 1e-6);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const tanHalfV = Math.tan(vFov / 2);
    const tanHalfH = Math.max(Math.tan(hFov / 2), 1e-4);

    /** ~15px поля слева/справа в пикселях канваса */
    const paddingPx = 15;
    const usableWidth = Math.max(size.width - 2 * paddingPx, size.width * 0.55);
    const horizontalFitScale = size.width / usableWidth;

    const halfH = sizeVec.y * 0.5;
    const halfW = Math.max(sizeVec.x, sizeVec.z) * 0.5;
    const distV = halfH / tanHalfV;
    const distH = halfW / tanHalfH;
    let dist = Math.max(distV, distH) * horizontalFitScale * 1.01;
    if (!Number.isFinite(dist) || dist <= 0) return;

    // Ровно перед фасадом: по центру по X, лёгкий подъём по Y
    const dir = new THREE.Vector3(0, 0.045, 1).normalize();
    const offset = dir.multiplyScalar(dist);
    persp.position.copy(center.clone().add(offset));
    persp.up.set(0, 1, 0);
    persp.lookAt(center.x, center.y, center.z);
    persp.near = Math.max(dist / 250, 0.04);
    persp.far = dist * 60;
    persp.updateProjectionMatrix();
  }, [camera, size.height, size.width, buildingRef, ...deps]);

  return null;
}

type FacadeCol = { xCenter: number; width: number; kind: "win" | "balcony" };

function buildFacadeColumns(): FacadeCol[] {
  const sectionW = (W * 0.92) / SECTION_COUNT;
  const xStart = -W * 0.46;
  const wFrac = [0.2, 0.2, 0.36, 0.2, 0.2];
  const cols: FacadeCol[] = [];
  for (let s = 0; s < SECTION_COUNT; s++) {
    const sx = xStart + s * sectionW;
    const sum = wFrac.reduce((a, b) => a + b, 0);
    let x = sx + sectionW * 0.02;
    const inner = sectionW * 0.96;
    for (let k = 0; k < 5; k++) {
      const cw = (wFrac[k]! / sum) * inner;
      cols.push({
        xCenter: x + cw / 2,
        width: cw * 0.92,
        kind: k === 2 ? "balcony" : "win",
      });
      x += cw;
    }
  }
  return cols;
}

const FACADE_COLS = buildFacadeColumns();

function SideFacadeWindows({
  nFloors,
  floorCentersY,
  slabHeights,
}: {
  nFloors: number;
  floorCentersY: number[];
  slabHeights: number[];
}) {
  const rows = Math.max(nFloors, 1);
  const cols = 3;
  const faceX = W / 2 - 0.015;
  const spanZ = D_CORE * 0.82;
  const z0 = -spanZ / 2 + spanZ / (cols - 1) / 2;
  const winW = spanZ / cols - 0.08;

  const nodes: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const y = floorCentersY[r] ?? 0;
    const winH = Math.max((slabHeights[r] ?? FH) * 0.52, FH * 0.4);
    for (let c = 0; c < cols; c++) {
      const z = z0 + (c * spanZ) / Math.max(cols - 1, 1);
      nodes.push(
        <group key={`${r}-${c}`} position={[faceX, y, z]}>
          <mesh castShadow>
            <boxGeometry args={[0.04, winH + 0.04, winW + 0.04]} />
            <meshStandardMaterial color={REF.sill} roughness={0.72} />
          </mesh>
          <mesh position={[0.022, 0, 0]}>
            <planeGeometry args={[0.01, winH]} />
            <meshStandardMaterial
              color={REF.glass}
              roughness={0.2}
              metalness={0.14}
            />
          </mesh>
        </group>,
      );
    }
  }
  return <>{nodes}</>;
}

function BuildingScene({
  floors,
  hoverId,
  onHover,
  onPick,
}: BuildingModelStaticProps) {
  const t = useTranslations("FloorTower");
  const buildingRef = useRef<THREE.Group>(null);
  useCursor(hoverId !== null);

  const sorted = useMemo(
    () => [...floors].sort((a, b) => b.floor - a.floor),
    [floors],
  );
  const n = sorted.length;
  const { slabHeights, floorCentersY, totalStack } = useMemo(() => {
    if (n === 0) {
      return {
        slabHeights: [] as number[],
        floorCentersY: [] as number[],
        totalStack: 0,
      };
    }
    const h = sorted.map(() => FH);
    const sum = h.reduce((a, b) => a + b, 0);
    const centers: number[] = new Array(n);
    let acc = -sum / 2;
    for (let idx = n - 1; idx >= 0; idx--) {
      const hh = h[idx]!;
      centers[idx] = acc + hh / 2;
      acc += hh;
    }
    return {
      slabHeights: h,
      floorCentersY: centers,
      totalStack: sum,
    };
  }, [n, sorted]);

  const topY = totalStack / 2;
  const botY = -totalStack / 2;
  const groundY = botY - FH * 1.35 + VISUAL_FLOOR_LIFT;
  const totalHeight = totalStack + 0.48;
  const fitDeps = [n, sorted.map((f) => f.id).join(",")];

  const sectionW = (W * 0.92) / SECTION_COUNT;
  const xStart = -W * 0.46;
  const hitZ = D_CORE / 2 + BALCONY_D + 0.12;
  const faceZ = D_CORE / 2 + 0.018;
  const wallD = 0.052;

  return (
    <>
      <color attach="background" args={["#e4e8ee"]} />

      <hemisphereLight intensity={0.9} groundColor="#e5e0d8" color="#ffffff" />
      <directionalLight
        position={[2.5, 20, 14]}
        intensity={1.08}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={60}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={12}
        shadow-camera-bottom={-8}
        shadow-bias={-0.00012}
        shadow-radius={2.5}
      />
      <directionalLight position={[-5, 12, -3]} intensity={0.48} color="#eef4ff" />
      <ambientLight intensity={0.52} />

      <group ref={buildingRef}>
        <group rotation={[0, ROT_Y, 0]} position={[0, VISUAL_FLOOR_LIFT, 0]}>
          {/* Вертикальные пояса между тремя секциями */}
          {Array.from({ length: SECTION_COUNT + 1 }).map((_, i) => {
            const x = xStart + i * sectionW;
            return (
              <mesh
                key={`pil-${i}`}
                position={[x, 0, D_CORE / 2 - 0.01]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[0.07, totalHeight, 0.06]} />
                <meshStandardMaterial color={REF.pilaster} roughness={0.78} />
              </mesh>
            );
          })}

          {sorted.map((f, idx) => {
            const y = floorCentersY[idx] ?? 0;
            const hov = hoverId === f.id;
            const floorH = slabHeights[idx] ?? FH;
            const bodyY = 0;
            const hitH = Math.max(floorH * 1.32, FH * 1.2);

            const isBottom = n > 1 && idx === n - 1;
            const isTop = n > 1 && idx === 0;
            const panelBase = isBottom
              ? REF.ground
              : isTop
                ? REF.cream
                : idx % 2 === 0
                  ? REF.cream
                  : REF.creamAlt;

            const botH = floorH * 0.16;
            const winHR = floorH * 0.52;
            const topH = floorH * 0.32;
            const y0 = bodyY - floorH * 0.5;

            return (
              <group key={f.id} position={[0, y, 0]}>
                <mesh
                  position={[0, bodyY, hitZ]}
                  renderOrder={100}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPick(f);
                  }}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    onHover(f.id);
                  }}
                  onPointerOut={(e) => {
                    e.stopPropagation();
                    onHover(null);
                  }}
                >
                  <planeGeometry args={[W * 0.99, hitH]} />
                  <meshBasicMaterial
                    transparent
                    opacity={0}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                  />
                </mesh>

                {hov ? (
                  <Html
                    position={[0, bodyY + floorH * 0.1, hitZ + 0.06]}
                    center
                    distanceFactor={5.5}
                    style={{ pointerEvents: "none" }}
                    zIndexRange={[200, 0]}
                  >
                    <div className="rounded-md border-2 border-white/90 bg-[#1e3a5f] px-2 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow-lg">
                      {t("floorLabel", { n: f.floor })}
                    </div>
                  </Html>
                ) : null}

                {/* Чёткая горизонталь этажа */}
                <mesh position={[0, y0 - 0.008, faceZ + 0.012]} receiveShadow>
                  <boxGeometry args={[W * 0.93, 0.02, 0.045]} />
                  <meshStandardMaterial color={REF.floorLine} roughness={0.55} />
                </mesh>

                <RoundedBox
                  args={[W * 0.96, floorH * 0.86, D_CORE * 0.78]}
                  radius={0.012}
                  smoothness={2}
                  position={[0, bodyY, -BALCONY_D * 0.42]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial
                    color={hov ? "#f5f0e6" : panelBase}
                    roughness={0.56}
                    metalness={0.02}
                    emissive={hov ? "#fed7aa" : "#000000"}
                    emissiveIntensity={hov ? 0.16 : 0}
                  />
                </RoundedBox>

                {/* Типичный пояс последнего этажа — тёмная горизонталь посередине окна */}
                {isTop ? (
                  <mesh
                    position={[0, y0 + botH + winHR * 0.48, faceZ + 0.025]}
                    castShadow
                  >
                    <boxGeometry args={[W * 0.9, winHR * 0.2, 0.035]} />
                    <meshStandardMaterial color={REF.band} roughness={0.62} />
                  </mesh>
                ) : null}

                {FACADE_COLS.map((col, bi) => {
                  const bw = col.width;
                  const x = col.xCenter;
                  const topCy = y0 + botH + winHR + topH / 2;
                  const botCy = y0 + botH / 2;
                  const winCy = y0 + botH + winHR / 2;
                  const gw = col.kind === "balcony" ? bw * 0.88 : bw * 0.78;
                  const gh = col.kind === "balcony" ? winHR * 0.92 : winHR * 0.84;
                  const recessC = faceZ - wallD * 0.5 - 0.055;
                  const zGlass =
                    col.kind === "balcony" ? faceZ + 0.055 : recessC + 0.02;
                  const panelTint = panelBase;

                  return (
                    <group key={`${f.id}-${bi}`}>
                      <mesh position={[x, topCy, faceZ - wallD / 2]} castShadow receiveShadow>
                        <boxGeometry args={[bw, topH, wallD]} />
                        <meshStandardMaterial
                          color={panelTint}
                          roughness={0.54}
                          metalness={0.02}
                        />
                      </mesh>
                      <mesh position={[x, botCy, faceZ - wallD / 2]} castShadow receiveShadow>
                        <boxGeometry args={[bw, botH, wallD]} />
                        <meshStandardMaterial color={REF.sill} roughness={0.6} metalness={0.02} />
                      </mesh>

                      <group position={[x, winCy, col.kind === "balcony" ? zGlass - 0.02 : recessC]}>
                        <mesh position={[0, 0, -0.03]}>
                          <boxGeometry args={[gw + 0.06, gh + 0.06, 0.032]} />
                          <meshStandardMaterial color={REF.frame} roughness={0.75} />
                        </mesh>
                        {(() => {
                          const ft = col.kind === "balcony" ? 0.018 : 0.02;
                          const fz = col.kind === "balcony" ? 0.02 : -0.01;
                          return (
                            <>
                              <mesh position={[0, gh / 2 + ft / 2, fz]}>
                                <boxGeometry args={[gw + ft * 2, ft, 0.026]} />
                                <meshStandardMaterial color={REF.frame} roughness={0.55} />
                              </mesh>
                              <mesh position={[0, -gh / 2 - ft / 2, fz]}>
                                <boxGeometry args={[gw + ft * 2, ft, 0.026]} />
                                <meshStandardMaterial color={REF.frame} roughness={0.55} />
                              </mesh>
                              <mesh position={[-gw / 2 - ft / 2, 0, fz]}>
                                <boxGeometry args={[ft, gh + ft * 2, 0.026]} />
                                <meshStandardMaterial color={REF.frame} roughness={0.55} />
                              </mesh>
                              <mesh position={[gw / 2 + ft / 2, 0, fz]}>
                                <boxGeometry args={[ft, gh + ft * 2, 0.026]} />
                                <meshStandardMaterial color={REF.frame} roughness={0.55} />
                              </mesh>
                            </>
                          );
                        })()}
                        <mesh position={[0, 0, col.kind === "balcony" ? 0.04 : 0.016]}>
                          <planeGeometry args={[gw * 0.92, gh * 0.92]} />
                          <meshStandardMaterial
                            color={col.kind === "balcony" ? REF.glassBalcony : REF.glass}
                            roughness={col.kind === "balcony" ? 0.12 : 0.18}
                            metalness={col.kind === "balcony" ? 0.28 : 0.16}
                          />
                        </mesh>
                        {col.kind === "balcony" ? (
                          <mesh position={[0, -gh * 0.38, 0.06]}>
                            <boxGeometry args={[gw * 0.95, 0.032, 0.02]} />
                            <meshStandardMaterial color={REF.rail} roughness={0.4} metalness={0.35} />
                          </mesh>
                        ) : null}
                      </group>
                    </group>
                  );
                })}
              </group>
            );
          })}

          <SideFacadeWindows
            nFloors={n}
            floorCentersY={floorCentersY}
            slabHeights={slabHeights}
          />

          <mesh position={[0, topY + FH * 0.82, -0.06]} castShadow receiveShadow>
            <boxGeometry args={[W + 0.12, 0.1, D_TOTAL + 0.08]} />
            <meshStandardMaterial color={REF.roof} roughness={0.7} metalness={0.08} />
          </mesh>

          {/* Три техблока над центральными лоджиями */}
          {[0, 1, 2].map((s) => {
            const cx = xStart + (s + 0.5) * sectionW;
            return (
              <mesh
                key={`roof-${s}`}
                position={[cx, topY + FH * 1.02, D_CORE * 0.06]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[sectionW * 0.34, FH * 1.05, D_CORE * 0.5]} />
                <meshStandardMaterial color={REF.roof} roughness={0.72} metalness={0.1} />
              </mesh>
            );
          })}

          <mesh position={[0, botY - FH * 0.62, 0]} castShadow receiveShadow>
            <boxGeometry args={[W + 0.1, 0.26, D_TOTAL + 0.06]} />
            <meshStandardMaterial color={REF.plinth} roughness={0.82} />
          </mesh>

          {[-W * 0.34, W * 0.34].map((x, i) => (
            <group key={i} position={[x, botY - FH * 0.02, D_CORE / 2 + 0.14]}>
              <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.52, 0.12, 0.32]} />
                <meshStandardMaterial color={REF.groundDeep} roughness={0.55} metalness={0.12} />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, groundY, 0]}
        receiveShadow
      >
        <planeGeometry args={[5.5, 5.5]} />
        <meshStandardMaterial color="#b8c0cc" roughness={0.9} />
      </mesh>

      <ContactShadows
        frames={1}
        position={[0, groundY + 0.02, 0]}
        opacity={0.3}
        scale={7}
        blur={2.4}
        far={4}
      />

      <CameraFit buildingRef={buildingRef} deps={fitDeps} />
    </>
  );
}

export function BuildingModelStatic(props: BuildingModelStaticProps) {
  return (
    <div
      className="relative mx-auto aspect-[4/3] w-full max-h-[min(520px,70vh)] min-h-[300px] overflow-hidden rounded-xl border border-slate-200/90 bg-[#e4e8ee] shadow-inner sm:aspect-[5/3] sm:rounded-2xl md:max-h-[580px]"
      onPointerLeave={() => props.onHover(null)}
    >
      <Canvas
        shadows
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        dpr={[1, 2]}
      >
        <PerspectiveCamera makeDefault fov={33} near={0.05} far={160} />
        <BuildingScene {...props} />
      </Canvas>
    </div>
  );
}
