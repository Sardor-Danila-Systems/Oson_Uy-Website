"use client";

/* eslint-disable react-hooks/immutability -- three.js objects are mutated imperatively every frame, which is how react-three-fiber is meant to be used. */

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A residential complex being built, driven by a single number: progress 0..1.
 *
 * The page scroll sets that number, so the construction advances as the visitor
 * scrolls. Towers go up floor by floor: a concrete frame leads, the glass
 * facade follows a few floors below it, and a tower crane climbs alongside.
 * Morning turns to dusk as the last tower closes and the windows light up.
 *
 * Everything is procedural (boxes and two small canvas textures); there is no
 * model or image to download.
 */

const FLOOR_H = 1;
const CONCRETE = "#9aa4b8";
const ORANGE = "#F97316";

interface Spec {
  x: number;
  z: number;
  size: number;
  floors: number;
  /** Progress at which the tower starts and finishes growing. */
  start: number;
  end: number;
  crane: boolean;
}

const TOWERS: Spec[] = [
  { x: -10.5, z: 0, size: 5, floors: 18, start: 0.04, end: 0.62, crane: true },
  { x: -3.2, z: -4.2, size: 4.6, floors: 27, start: 0.07, end: 0.82, crane: true },
  { x: 4.2, z: -0.6, size: 5, floors: 15, start: 0.16, end: 0.7, crane: false },
  { x: 11.2, z: -3, size: 4.2, floors: 21, start: 0.22, end: 0.88, crane: true },
  { x: 0.4, z: 6.4, size: 6.4, floors: 5, start: 0.46, end: 0.76, crane: false },
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Mostly linear, so a floor count follows scroll, with soft ends. */
const grow = (t: number) => t * 0.75 + (t * t * (3 - 2 * t)) * 0.25;

/** Deterministic noise: windows stay lit or dark across renders. */
function noise(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** One tile of facade: 4 bays by 4 floors. Returns the colour map and the lit-windows map. */
function makeFacadeTextures() {
  const cell = 64;
  const n = 4;
  const size = cell * n;
  const color = document.createElement("canvas");
  const glow = document.createElement("canvas");
  color.width = color.height = glow.width = glow.height = size;
  const c = color.getContext("2d")!;
  const g = glow.getContext("2d")!;
  c.fillStyle = "#dde4f0";
  c.fillRect(0, 0, size, size);
  g.fillStyle = "#000";
  g.fillRect(0, 0, size, size);

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * cell;
      const y = j * cell;
      const grad = c.createLinearGradient(0, y + 8, 0, y + cell - 14);
      grad.addColorStop(0, "#5f86d6");
      grad.addColorStop(1, "#2b4a8f");
      c.fillStyle = grad;
      c.fillRect(x + 9, y + 9, cell - 18, cell - 22);
      c.fillStyle = "rgba(255,255,255,0.28)";
      c.fillRect(x + 9, y + 9, cell - 18, 8);
      // Slab line under each floor.
      c.fillStyle = "#b9c3d6";
      c.fillRect(x, y + cell - 7, cell, 7);

      if (noise(i + 3, j + 11) < 0.5) {
        g.fillStyle = noise(i + 7, j + 2) < 0.25 ? "#ffd9a0" : "#ffb458";
        g.fillRect(x + 9, y + 9, cell - 18, cell - 22);
      }
    }
  }
  const map = new THREE.CanvasTexture(color);
  const emissive = new THREE.CanvasTexture(glow);
  for (const t of [map, emissive]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
  }
  return { map, emissive };
}

interface Shared {
  progress: MutableRefObject<number>;
  /** The damped value every part of the scene reads, updated once per frame. */
  p: { current: number };
}

function Tower({ spec, index, shared, textures }: { spec: Spec; index: number; shared: Shared; textures: ReturnType<typeof makeFacadeTextures> }) {
  const { x, z, size, floors } = spec;
  const total = floors * FLOOR_H;

  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), []);
  const material = useMemo(() => {
    const map = textures.map.clone();
    const emissiveMap = textures.emissive.clone();
    for (const t of [map, emissiveMap]) {
      t.repeat.set(size / 4, total / 4);
      t.needsUpdate = true;
    }
    return new THREE.MeshStandardMaterial({
      map,
      emissiveMap,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0,
      roughness: 0.55,
      metalness: 0.15,
      side: THREE.DoubleSide,
      clippingPlanes: [plane],
    });
  }, [textures, size, total, plane]);

  const cap = useRef<THREE.Mesh>(null);
  const pillars = useRef<THREE.Group>(null);
  const slabs = useRef<(THREE.Mesh | null)[]>([]);
  const crane = useRef<THREE.Group>(null);
  const jib = useRef<THREE.Group>(null);
  const trolley = useRef<THREE.Group>(null);
  const mast = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const p = shared.p.current;
    const t = clamp01((p - spec.start) / (spec.end - spec.start));
    const height = total * grow(t);
    // The glass follows the frame by a few floors, and catches up at the end.
    const lag = 3 * FLOOR_H * (1 - smooth(0.9, 1, t));
    const facade = Math.max(0, height - lag);
    const frame = height;

    plane.constant = facade;
    material.emissiveIntensity = smooth(0.78, 0.98, p) * 1.15;

    if (cap.current) {
      cap.current.visible = facade > 0.05;
      cap.current.position.y = facade + 0.07;
    }
    // Concrete frame above the facade: four pillars and up to three slabs.
    const open = frame - facade;
    if (pillars.current) {
      pillars.current.visible = open > 0.05;
      pillars.current.position.y = facade + open / 2;
      pillars.current.scale.y = Math.max(0.001, open);
    }
    slabs.current.forEach((s, k) => {
      if (!s) return;
      const y = facade + (k + 1) * FLOOR_H;
      s.visible = y <= frame + 0.01 && open > 0.05;
      s.position.y = y;
    });

    if (crane.current) {
      const working = t > 0 && t < 1;
      const gone = smooth(1, 1.06, (p - spec.start) / (spec.end - spec.start));
      crane.current.visible = (working || t >= 1) && gone < 1;
      crane.current.scale.setScalar(1 - gone);
      const top = Math.max(7, frame + 4);
      if (mast.current) {
        mast.current.scale.y = top;
        mast.current.position.y = top / 2;
      }
      if (jib.current) {
        jib.current.position.y = top + 0.3;
        jib.current.rotation.y = 0.7 * Math.sin(clock.elapsedTime * 0.22 + index * 1.7) + index * 0.9;
      }
      if (trolley.current) {
        trolley.current.position.x = 4 + 2.2 * Math.sin(clock.elapsedTime * 0.5 + index);
      }
    }
  });

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, total / 2, 0]} material={material}>
        <boxGeometry args={[size, total, size]} />
      </mesh>

      <mesh ref={cap} position={[0, 0, 0]}>
        <boxGeometry args={[size + 0.12, 0.14, size + 0.12]} />
        <meshStandardMaterial color="#c8d0e0" roughness={0.8} />
      </mesh>

      <group ref={pillars}>
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz], k) => (
          <mesh key={k} position={[(sx! * (size - 0.3)) / 2, 0, (sz! * (size - 0.3)) / 2]}>
            <boxGeometry args={[0.3, 1, 0.3]} />
            <meshStandardMaterial color={CONCRETE} roughness={0.9} />
          </mesh>
        ))}
      </group>
      {[0, 1, 2].map((k) => (
        <mesh key={k} ref={(m) => void (slabs.current[k] = m)}>
          <boxGeometry args={[size + 0.05, 0.16, size + 0.05]} />
          <meshStandardMaterial color={CONCRETE} roughness={0.9} />
        </mesh>
      ))}

      {spec.crane && (
        <group ref={crane} position={[size / 2 + 1.4, 0, size / 2 + 1.4]}>
          <mesh ref={mast}>
            <boxGeometry args={[0.38, 1, 0.38]} />
            <meshStandardMaterial color={ORANGE} roughness={0.6} />
          </mesh>
          <group ref={jib}>
            <mesh position={[3.5, 0, 0]}>
              <boxGeometry args={[9, 0.26, 0.3]} />
              <meshStandardMaterial color={ORANGE} roughness={0.6} />
            </mesh>
            <mesh position={[-2.6, 0, 0]}>
              <boxGeometry args={[3.2, 0.26, 0.3]} />
              <meshStandardMaterial color={ORANGE} roughness={0.6} />
            </mesh>
            <mesh position={[-3.7, -0.5, 0]}>
              <boxGeometry args={[0.9, 0.8, 0.5]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
            <mesh position={[0.3, 0.55, 0]}>
              <boxGeometry args={[0.3, 0.9, 0.3]} />
              <meshStandardMaterial color={ORANGE} />
            </mesh>
            <group ref={trolley}>
              <mesh position={[0, -1.7, 0]}>
                <boxGeometry args={[0.04, 3.3, 0.04]} />
                <meshStandardMaterial color="#1e293b" />
              </mesh>
              <mesh position={[0, -3.4, 0]}>
                <boxGeometry args={[0.5, 0.35, 0.5]} />
                <meshStandardMaterial color="#1e293b" />
              </mesh>
            </group>
          </group>
        </group>
      )}
    </group>
  );
}

function Trees({ shared }: { shared: Shared }) {
  const group = useRef<THREE.Group>(null);
  const spots = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let i = 0; i < 26; i++) {
      const x = -17 + i * 1.35;
      out.push([x, 10.5 + noise(i, 1) * 1.2, 0.7 + noise(i, 2) * 0.5]);
    }
    for (let i = 0; i < 8; i++) out.push([-15 + i * 4.3, 2.4 + noise(i, 5) * 0.6, 0.6 + noise(i, 6) * 0.4]);
    return out;
  }, []);

  useFrame(() => {
    const k = smooth(0.84, 0.97, shared.p.current);
    group.current?.children.forEach((c, i) => {
      const s = clamp01(k * 1.6 - (i % 7) * 0.08);
      c.scale.setScalar(Math.max(0.0001, s));
    });
  });

  return (
    <group ref={group}>
      {spots.map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]} scale={0.0001}>
          <mesh position={[0, 0.35 * s, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 0.7 * s, 6]} />
            <meshStandardMaterial color="#5b4636" />
          </mesh>
          <mesh position={[0, 1.15 * s, 0]}>
            <coneGeometry args={[0.45 * s, 1.3 * s, 7]} />
            <meshStandardMaterial color="#3f8f5b" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Site({ shared }: { shared: Shared }) {
  const fence = useRef<THREE.Group>(null);
  const ground = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const p = shared.p.current;
    if (fence.current) {
      const s = 1 - smooth(0.06, 0.14, p);
      fence.current.visible = s > 0.01;
      fence.current.scale.y = Math.max(0.001, s);
    }
    ground.current?.color.set("#d6deec").lerp(new THREE.Color("#22345f"), smooth(0.4, 1, p));
  });

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial ref={ground} color="#d6deec" roughness={1} />
      </mesh>
      {/* the plot */}
      <mesh position={[0, 0.02, 1]}>
        <boxGeometry args={[40, 0.08, 20]} />
        <meshStandardMaterial color="#b7c2d8" roughness={1} />
      </mesh>
      {/* road in front */}
      <mesh position={[0, 0.03, 13]}>
        <boxGeometry args={[60, 0.06, 3.4]} />
        <meshStandardMaterial color="#3b465e" roughness={1} />
      </mesh>
      {/* site hoarding, taken down once work is under way */}
      <group ref={fence} position={[0, 0.4, 0]}>
        {Array.from({ length: 17 }, (_, i) => (
          <mesh key={i} position={[-19.5 + i * 2.45, 0.4, 11]}>
            <boxGeometry args={[2.3, 0.8, 0.08]} />
            <meshStandardMaterial color={i % 2 ? "#f1f5f9" : ORANGE} roughness={0.8} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/** Camera path and sky, both read from the damped progress. */
function Rig({ shared, progress }: { shared: Shared; progress: MutableRefObject<number> }) {
  const { camera, scene, size } = useThree();
  const sky = useMemo(() => new THREE.Color(), []);
  const keys = useMemo(
    () => [
      { p: 0, pos: new THREE.Vector3(3, 9, 54), look: new THREE.Vector3(0, 5, 0) },
      { p: 0.33, pos: new THREE.Vector3(-26, 14, 46), look: new THREE.Vector3(-4, 9, 0) },
      { p: 0.68, pos: new THREE.Vector3(24, 22, 46), look: new THREE.Vector3(2, 13, -1) },
      { p: 1, pos: new THREE.Vector3(0, 17, 60), look: new THREE.Vector3(0, 12, -1) },
    ],
    [],
  );
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const colors = useMemo(
    () => ({ dawn: new THREE.Color("#a9c3ee"), day: new THREE.Color("#5f8fe0"), dusk: new THREE.Color("#0d1c45") }),
    [],
  );

  useFrame((_, dt) => {
    // One damped value, shared by every part of the scene.
    shared.p.current = THREE.MathUtils.damp(shared.p.current, progress.current, 5, dt);
    const p = shared.p.current;

    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1]!.p) i++;
    const k0 = keys[i]!;
    const k1 = keys[i + 1]!;
    const t = smooth(k0.p, k1.p, p);
    pos.copy(a.copy(k0.pos).lerp(k1.pos, t));
    look.copy(b.copy(k0.look).lerp(k1.look, t));
    // Portrait screens need to stand further back to keep the towers in frame.
    const aspect = size.width / size.height;
    const back = 1 + Math.max(0, 1.2 - aspect) * 0.95;
    pos.sub(look).multiplyScalar(back).add(look);
    camera.position.copy(pos);
    camera.lookAt(look);

    sky.copy(colors.dawn).lerp(colors.day, smooth(0, 0.5, p)).lerp(colors.dusk, smooth(0.62, 1, p));
    if (scene.background instanceof THREE.Color) scene.background.copy(sky);
    if (scene.fog) scene.fog.color.copy(sky);
  });
  return null;
}

function Lights({ shared }: { shared: Shared }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  useFrame(() => {
    const p = shared.p.current;
    const night = smooth(0.62, 1, p);
    if (sun.current) {
      sun.current.intensity = 2.1 - 1.55 * night;
      sun.current.color.set("#fff1dc").lerp(new THREE.Color("#8fa6ff"), night);
    }
    if (hemi.current) hemi.current.intensity = 1.1 - 0.55 * night;
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={["#dfeaff", "#7c8aa8", 1.1]} />
      <directionalLight ref={sun} position={[14, 26, 18]} intensity={2.1} />
    </>
  );
}

function Scene({ progress }: { progress: MutableRefObject<number> }) {
  const shared = useMemo<Shared>(() => ({ progress, p: { current: 0 } }), [progress]);
  const textures = useMemo(() => makeFacadeTextures(), []);
  const { scene } = useThree();

  useEffect(() => {
    scene.background = new THREE.Color("#a9c3ee");
    scene.fog = new THREE.Fog("#a9c3ee", 80, 230);
  }, [scene]);

  return (
    <>
      <Rig shared={shared} progress={progress} />
      <Lights shared={shared} />
      <Site shared={shared} />
      {TOWERS.map((spec, i) => (
        <Tower key={i} spec={spec} index={i} shared={shared} textures={textures} />
      ))}
      <Trees shared={shared} />
    </>
  );
}

export default function BuildScene({
  progress,
  className,
}: {
  /** Mutable 0..1 value that the page writes (from scroll) and the scene reads. */
  progress: MutableRefObject<number>;
  className?: string;
}) {
  return (
    <Canvas
      className={className}
      dpr={[1, 1.75]}
      camera={{ fov: 38, near: 0.5, far: 320, position: [3, 9, 54] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Scene progress={progress} />
    </Canvas>
  );
}
