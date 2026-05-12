"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Html, PerspectiveCamera, RoundedBox, useCursor } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import * as THREE from "three";
import type { ProjectFloor } from "@/types";

export type BuildingModelStaticProps = {
  floors: ProjectFloor[];
  hoverId: number | null;
  onHover: (id: number | null) => void;
  onPick: (floor: ProjectFloor) => void;
};

/** Высота одного этажа в «схематичной» башне */
const SLAB_H = 0.42;
const W = 2.8;
const D = 1.0;
const GAP = 0.04;

const VISUAL_LIFT = 0.15;

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

    const paddingPx = 16;
    const usableWidth = Math.max(size.width - 2 * paddingPx, size.width * 0.55);
    const horizontalFitScale = size.width / usableWidth;

    const halfH = sizeVec.y * 0.5;
    const halfW = Math.max(sizeVec.x, sizeVec.z) * 0.5;
    const distV = halfH / tanHalfV;
    const distH = halfW / tanHalfH;
    let dist = Math.max(distV, distH) * horizontalFitScale * 1.05;
    if (!Number.isFinite(dist) || dist <= 0) return;

    const dir = new THREE.Vector3(0, 0.08, 1).normalize();
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

  const { centersY, botY } = useMemo(() => {
    if (n === 0) {
      return { centersY: [] as number[], botY: 0 };
    }
    const step = SLAB_H + GAP;
    const total = n * step - GAP;
    const centers: number[] = [];
    // sorted[0] = самый верхний этаж по номеру — выше по Y
    let y = total / 2 - SLAB_H / 2;
    for (let i = 0; i < n; i++) {
      centers.push(y);
      y -= step;
    }
    return {
      centersY: centers,
      botY: -total / 2,
    };
  }, [n]);

  const fitDeps = [n, sorted.map((f) => f.id).join(",")];
  const groundY =
    n > 0
      ? centersY[n - 1]! -
        SLAB_H / 2 -
        SLAB_H * 0.45 -
        SLAB_H * 0.25 -
        0.12 +
        VISUAL_LIFT
      : botY - SLAB_H * 0.85 + VISUAL_LIFT;

  return (
    <>
      <color attach="background" args={["#e8ecf2"]} />

      <hemisphereLight intensity={0.85} groundColor="#d4d0c8" color="#ffffff" />
      <directionalLight position={[4, 14, 8]} intensity={1.05} castShadow />
      <directionalLight position={[-4, 8, -2]} intensity={0.45} color="#eef4ff" />
      <ambientLight intensity={0.55} />

      <group ref={buildingRef}>
        <group position={[0, VISUAL_LIFT, 0]}>
          {sorted.map((f, idx) => {
            const y = centersY[idx] ?? 0;
            const hov = hoverId === f.id;
            const zFace = D / 2 + 0.02;
            const hitPad = 0.08;

            return (
              <group key={f.id} position={[0, y, 0]}>
                {/* Невидимая плоскость для клика по фасаду */}
                <mesh
                  position={[0, 0, zFace + 0.06]}
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
                  <planeGeometry args={[W + hitPad, SLAB_H + hitPad]} />
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
                </mesh>

                <RoundedBox
                  args={[W, SLAB_H, D]}
                  radius={0.04}
                  smoothness={3}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial
                    color={hov ? "#bfdbfe" : idx % 2 === 0 ? "#e2e8f0" : "#f1f5f9"}
                    roughness={0.45}
                    metalness={0.05}
                    emissive={hov ? "#3b82f6" : "#000000"}
                    emissiveIntensity={hov ? 0.12 : 0}
                  />
                </RoundedBox>

                {/* Разделитель этажей — чёткая линия */}
                <mesh position={[0, -SLAB_H / 2 - GAP * 0.35, zFace - 0.02]} receiveShadow>
                  <boxGeometry args={[W * 1.02, 0.025, 0.04]} />
                  <meshStandardMaterial color="#94a3b8" roughness={0.5} />
                </mesh>

                <Html
                  position={[W * 0.52 + 0.35, 0, 0]}
                  center
                  distanceFactor={6}
                  style={{ pointerEvents: "none" }}
                  zIndexRange={[200, 0]}
                >
                  <div
                    className={`rounded-md border-2 px-2.5 py-1 font-black uppercase tracking-wide shadow-md ${
                      hov
                        ? "border-orange-400 bg-orange-500 text-white"
                        : "border-slate-300 bg-white text-[#1E3A8A]"
                    } text-[11px] sm:text-xs`}
                  >
                    {t("floorLabel", { n: f.floor })}
                  </div>
                </Html>
              </group>
            );
          })}

          {/* Крыша — простой блок */}
          {n > 0 ? (
            <mesh
              position={[0, centersY[0]! + SLAB_H / 2 + SLAB_H * 0.28, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[W + 0.12, SLAB_H * 0.55, D + 0.1]} />
              <meshStandardMaterial color="#64748b" roughness={0.65} />
            </mesh>
          ) : null}

          {/* Цоколь */}
          {n > 0 ? (
            <mesh
              position={[0, centersY[n - 1]! - SLAB_H / 2 - SLAB_H * 0.45, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[W + 0.1, SLAB_H * 0.5, D + 0.08]} />
              <meshStandardMaterial color="#475569" roughness={0.75} />
            </mesh>
          ) : null}
        </group>
      </group>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY, 0]} receiveShadow>
        <planeGeometry args={[5, 5]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.92} />
      </mesh>

      <ContactShadows
        frames={1}
        position={[0, groundY + 0.02, 0]}
        opacity={0.28}
        scale={6}
        blur={2.2}
        far={4}
      />

      <CameraFit buildingRef={buildingRef} deps={fitDeps} />
    </>
  );
}

export function BuildingModelStatic(props: BuildingModelStaticProps) {
  return (
    <div
      className="relative mx-auto aspect-[4/3] w-full max-h-[min(480px,65vh)] min-h-[260px] overflow-hidden rounded-xl border border-slate-200/90 bg-[#e8ecf2] shadow-inner sm:aspect-[5/3] sm:rounded-2xl md:max-h-[520px]"
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
        <PerspectiveCamera makeDefault fov={36} near={0.05} far={120} />
        <BuildingScene {...props} />
      </Canvas>
    </div>
  );
}
