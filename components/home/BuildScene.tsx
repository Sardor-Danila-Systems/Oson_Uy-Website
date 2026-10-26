"use client";

/* eslint-disable react-hooks/immutability -- three.js objects are mutated imperatively every frame, which is how react-three-fiber is meant to be used. */

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A residential complex being built, driven by a single number: progress 0..1.
 *
 * The page scroll sets that number, so the construction advances as the visitor
 * scrolls. Towers go up floor by floor: a concrete frame leads (wrapped in
 * safety netting), the glass facade follows a few floors below it, and tower
 * cranes climb alongside. The day runs from morning to dusk while the site is
 * cleaned up, the street fills with traffic and, at the end, every window and
 * lamp lights up.
 *
 * Everything is procedural (boxes, a few canvas textures and a sky shader);
 * there is no model or image to download.
 */

const FLOOR_H = 1;
const ORANGE = "#F97316";
const CONCRETE = "#a3acbf";

interface Spec {
  x: number;
  z: number;
  size: number;
  floors: number;
  /** Progress at which the tower starts and finishes growing. */
  start: number;
  end: number;
  crane: boolean;
  tint: string;
}

const TOWERS: Spec[] = [
  { x: -10.5, z: 0, size: 5, floors: 18, start: 0.05, end: 0.62, crane: true, tint: "#ffffff" },
  { x: -3.2, z: -4.2, size: 4.6, floors: 27, start: 0.08, end: 0.82, crane: true, tint: "#f6f1e8" },
  { x: 4.2, z: -0.6, size: 5, floors: 15, start: 0.17, end: 0.7, crane: false, tint: "#eef3fb" },
  { x: 11.2, z: -3, size: 4.2, floors: 21, start: 0.22, end: 0.88, crane: true, tint: "#ffffff" },
  { x: 0.4, z: 6.4, size: 6.4, floors: 5, start: 0.46, end: 0.76, crane: false, tint: "#f6f1e8" },
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Mostly linear, so a floor count follows scroll, with soft ends. */
const grow = (t: number) => t * 0.75 + t * t * (3 - 2 * t) * 0.25;

/** Deterministic noise: windows stay lit or dark across renders. */
function noise(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

interface Shared {
  /** The damped progress every part of the scene reads; written once per frame by <Rig>. */
  p: { current: number };
  /** True on small screens: cheaper shadows. */
  small: boolean;
  /** Drops when the device cannot keep up: 0 full, 1 lower resolution, 2 no shadows. */
  quality: { level: number };
}

/** 0 by day, 1 at night: windows, lamps and headlights follow it. */
const nightAt = (p: number) => smooth(0.74, 0.97, p);

/* ------------------------------------------------------------------ textures */

/** One tile of facade, 4 bays by 4 floors: the colour map and the lit-windows map. */
function makeFacadeTextures(maxAnisotropy: number) {
  const cell = 128;
  const n = 4;
  const size = cell * n;
  const color = document.createElement("canvas");
  const glow = document.createElement("canvas");
  color.width = color.height = glow.width = glow.height = size;
  const c = color.getContext("2d")!;
  const g = glow.getContext("2d")!;
  c.fillStyle = "#e3e8f2";
  c.fillRect(0, 0, size, size);
  g.fillStyle = "#000";
  g.fillRect(0, 0, size, size);

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * cell;
      const y = j * cell;
      const wx = x + 16;
      const wy = y + 16;
      const ww = cell - 32;
      const wh = cell - 44;

      // Window recess, then the glass with a sky-coloured gradient and a soft reflection.
      c.fillStyle = "#8793ab";
      c.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      const glass = c.createLinearGradient(0, wy, 0, wy + wh);
      glass.addColorStop(0, "#6d95e0");
      glass.addColorStop(0.55, "#3b5fae");
      glass.addColorStop(1, "#243d78");
      c.fillStyle = glass;
      c.fillRect(wx, wy, ww, wh);
      c.fillStyle = "rgba(255,255,255,0.22)";
      c.beginPath();
      c.moveTo(wx, wy);
      c.lineTo(wx + ww * 0.55, wy);
      c.lineTo(wx, wy + wh * 0.6);
      c.closePath();
      c.fill();
      // Mullion.
      c.fillStyle = "#cfd6e4";
      c.fillRect(wx + ww / 2 - 2, wy, 4, wh);

      // Floor slab and a balcony ledge on every other floor.
      c.fillStyle = "#b4bdd0";
      c.fillRect(x, y + cell - 10, cell, 10);
      if (j % 2 === 0) {
        c.fillStyle = "#99a3b9";
        c.fillRect(x + 6, y + cell - 22, cell - 12, 6);
      }

      if (noise(i + 3, j + 11) < 0.52) {
        const roll = noise(i + 7, j + 2);
        g.fillStyle = roll < 0.18 ? "#9cc4ff" : roll < 0.5 ? "#ffd9a0" : "#ffb458";
        g.fillRect(wx, wy, ww, wh);
      }
    }
  }
  const map = new THREE.CanvasTexture(color);
  const emissive = new THREE.CanvasTexture(glow);
  for (const t of [map, emissive]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAnisotropy;
  }
  return { map, emissive };
}

/** Diagonal lattice on a transparent background, for crane masts and jibs. */
function makeLatticeTexture() {
  const s = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = s;
  const g = canvas.getContext("2d")!;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 6;
  g.strokeRect(2, 2, s - 4, s - 4);
  g.beginPath();
  g.moveTo(2, 2);
  g.lineTo(s - 2, s - 2);
  g.moveTo(s - 2, 2);
  g.lineTo(2, s - 2);
  g.stroke();
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

type FacadeTextures = ReturnType<typeof makeFacadeTextures>;

/* ----------------------------------------------------------------------- sky */

const SKY_KEYS: { p: number; top: string; bottom: string }[] = [
  { p: 0, top: "#4a86ee", bottom: "#d9e8fb" },
  { p: 0.4, top: "#3f7be6", bottom: "#bfdaf8" },
  { p: 0.7, top: "#3a5cb2", bottom: "#f4b184" },
  { p: 0.88, top: "#16296a", bottom: "#8a5f8f" },
  { p: 1, top: "#050d2b", bottom: "#1c2e66" },
];

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y * 1.8, 0.0, 1.0);
    gl_FragColor = vec4(mix(uBottom, uTop, pow(h, 0.7)), 1.0);
    #include <colorspace_fragment>
  }
`;

function Sky({ shared }: { shared: Shared }) {
  const { scene } = useThree();
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        uniforms: { uTop: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() } },
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
      }),
    [],
  );
  const keys = useMemo(
    () => SKY_KEYS.map((k) => ({ p: k.p, top: new THREE.Color(k.top), bottom: new THREE.Color(k.bottom) })),
    [],
  );
  const palette = useMemo(
    () => ({
      sunDay: new THREE.Color("#fff4d6"),
      sunSet: new THREE.Color("#ff9a55"),
      cloud: new THREE.Color(),
      cloudDay: new THREE.Color("#ffffff"),
      cloudSet: new THREE.Color("#f6c9a4"),
      cloudNight: new THREE.Color("#25356b"),
    }),
    [],
  );
  const stars = useRef<THREE.Points>(null);
  const sun = useRef<THREE.Mesh>(null);
  const moon = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Group>(null);

  const starGeometry = useMemo(() => {
    const pos = new Float32Array(420 * 3);
    for (let i = 0; i < 420; i++) {
      const a = noise(i, 1) * Math.PI * 2;
      const e = 0.12 + noise(i, 2) * 1.35;
      const r = 235;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r - 20;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  const cloudSpots = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        x: -150 + noise(i, 7) * 300,
        y: 38 + noise(i, 8) * 30,
        z: -90 - noise(i, 9) * 70,
        s: 0.8 + noise(i, 10) * 1.1,
      })),
    [],
  );

  useEffect(
    () => () => {
      material.dispose();
      starGeometry.dispose();
    },
    [material, starGeometry],
  );

  useFrame((_, dt) => {
    const p = shared.p.current;
    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1]!.p) i++;
    const a = keys[i]!;
    const b = keys[i + 1]!;
    const t = smooth(a.p, b.p, p);
    const top = material.uniforms.uTop!.value as THREE.Color;
    const bottom = material.uniforms.uBottom!.value as THREE.Color;
    top.copy(a.top).lerp(b.top, t);
    bottom.copy(a.bottom).lerp(b.bottom, t);
    if (scene.fog) scene.fog.color.copy(bottom);

    const night = nightAt(p);
    if (stars.current) (stars.current.material as THREE.PointsMaterial).opacity = smooth(0.84, 1, p);
    // The sun sets towards the end; the moon rises behind the towers.
    const arc = clamp01(p / 0.86);
    if (sun.current) {
      sun.current.position.set(-130 + arc * 260, 30 + Math.sin(arc * Math.PI) * 120 - arc * 28, -170);
      sun.current.visible = p < 0.9;
      (sun.current.material as THREE.MeshBasicMaterial).color.copy(palette.sunDay).lerp(palette.sunSet, smooth(0.55, 0.86, p));
    }
    if (moon.current) {
      moon.current.position.set(75, 95, -180);
      moon.current.visible = night > 0.05;
      (moon.current.material as THREE.MeshBasicMaterial).opacity = night;
    }
    clouds.current?.children.forEach((c, k) => {
      c.position.x += dt * (0.6 + (k % 3) * 0.25);
      if (c.position.x > 170) c.position.x = -170;
    });
    palette.cloud.copy(palette.cloudDay).lerp(palette.cloudSet, smooth(0.6, 0.86, p)).lerp(palette.cloudNight, night);
    clouds.current?.children.forEach((c) =>
      c.children.forEach((m) => ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).color.copy(palette.cloud)),
    );
  });

  return (
    <>
      <mesh renderOrder={-10}>
        <sphereGeometry args={[280, 32, 20]} />
        <primitive object={material} attach="material" />
      </mesh>
      <points ref={stars} geometry={starGeometry} renderOrder={-9}>
        <pointsMaterial color="#ffffff" size={1.7} sizeAttenuation={false} transparent opacity={0} depthWrite={false} fog={false} />
      </points>
      <mesh ref={sun}>
        <sphereGeometry args={[9, 20, 12]} />
        <meshBasicMaterial color="#fff4d6" fog={false} toneMapped={false} />
      </mesh>
      <mesh ref={moon} visible={false}>
        <sphereGeometry args={[5.5, 20, 12]} />
        <meshBasicMaterial color="#e8eeff" transparent opacity={0} fog={false} toneMapped={false} />
      </mesh>
      <group ref={clouds}>
        {cloudSpots.map((c, i) => (
          <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
            {[
              [0, 0, 0, 14],
              [11, 1, 2, 10],
              [-11, -1, 1, 11],
              [4, 4, -2, 9],
            ].map(([x, y, z, r], k) => (
              <mesh key={k} position={[x!, y!, z!]} scale={[1, 0.42, 0.7]}>
                <sphereGeometry args={[r!, 14, 10]} />
                <meshBasicMaterial color="#ffffff" fog={false} transparent opacity={0.92} depthWrite={false} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </>
  );
}

/* -------------------------------------------------------------------- lights */

function Lights({ shared }: { shared: Shared }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const moon = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const warm = useMemo(() => new THREE.Color("#fff3df"), []);
  const gold = useMemo(() => new THREE.Color("#ffb676"), []);

  useFrame(() => {
    const p = shared.p.current;
    const night = nightAt(p);
    const arc = clamp01(p / 0.86);
    if (sun.current) {
      sun.current.castShadow = shared.quality.level < 2;
      sun.current.position.set(-34 + arc * 68, 14 + Math.sin(arc * Math.PI) * 30, 26);
      sun.current.intensity = 2.5 * (1 - smooth(0.74, 0.93, p));
      sun.current.color.copy(warm).lerp(gold, smooth(0.5, 0.84, p));
    }
    if (moon.current) moon.current.intensity = 0.65 * smooth(0.8, 1, p);
    if (hemi.current) hemi.current.intensity = 1.15 - 0.62 * night;
  });

  const mapSize = shared.small ? 1024 : 2048;
  return (
    <>
      <hemisphereLight ref={hemi} args={["#dbe8ff", "#8a8f9e", 1.15]} />
      <directionalLight
        ref={sun}
        position={[-34, 20, 26]}
        intensity={2.5}
        castShadow
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-left={-36}
        shadow-camera-right={36}
        shadow-camera-top={34}
        shadow-camera-bottom={-22}
        shadow-camera-near={5}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <directionalLight ref={moon} position={[24, 40, 30]} intensity={0} color="#8fa6ff" />
    </>
  );
}

/* ------------------------------------------------------------------- towers */

function Crane({
  index,
  topRef,
  active,
  shared,
  lattice,
}: {
  index: number;
  topRef: MutableRefObject<number>;
  active: MutableRefObject<number>;
  shared: Shared;
  lattice: THREE.Texture;
}) {
  const group = useRef<THREE.Group>(null);
  const mast = useRef<THREE.Mesh>(null);
  const slew = useRef<THREE.Group>(null);
  const trolley = useRef<THREE.Group>(null);
  const hook = useRef<THREE.Group>(null);
  const light = useRef<THREE.Mesh>(null);

  const mastMat = useMemo(() => {
    const map = lattice.clone();
    map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, color: ORANGE, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.6 });
  }, [lattice]);
  const jibMat = useMemo(() => {
    const map = lattice.clone();
    map.needsUpdate = true;
    map.repeat.set(9, 1);
    return new THREE.MeshStandardMaterial({ map, color: ORANGE, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.6 });
  }, [lattice]);

  useEffect(
    () => () => {
      mastMat.map?.dispose();
      jibMat.map?.dispose();
      mastMat.dispose();
      jibMat.dispose();
    },
    [mastMat, jibMat],
  );

  useFrame(({ clock }) => {
    const live = active.current;
    if (!group.current) return;
    group.current.visible = live > 0.001;
    group.current.scale.setScalar(Math.max(0.0001, live));
    if (live <= 0.001) return;
    const t = clock.elapsedTime;
    const top = Math.max(8, topRef.current + 4);
    if (mast.current) {
      mast.current.scale.y = top;
      mast.current.position.y = top / 2;
      mastMat.map!.repeat.set(1, top / 1.4);
    }
    if (slew.current) {
      slew.current.position.y = top;
      slew.current.rotation.y = 0.7 * Math.sin(t * 0.2 + index * 1.7) + index * 0.9;
    }
    const reach = 4.5 + 2.4 * Math.sin(t * 0.45 + index);
    if (trolley.current) trolley.current.position.x = reach;
    if (hook.current) hook.current.position.y = -2.4 - 1.2 * (0.5 + 0.5 * Math.sin(t * 0.3 + index * 2));
    if (light.current) {
      const m = light.current.material as THREE.MeshBasicMaterial;
      m.color.set("#ff3b30").multiplyScalar(0.35 + 0.65 * smooth(0.5, 0.95, shared.p.current) * (0.55 + 0.45 * Math.sin(t * 4)));
    }
  });

  return (
    <group ref={group}>
      <mesh ref={mast} castShadow>
        <boxGeometry args={[0.55, 1, 0.55]} />
        <primitive object={mastMat} attach="material" />
      </mesh>
      <group ref={slew}>
        {/* working jib and counter-jib */}
        <mesh position={[4.2, 0.35, 0]} castShadow>
          <boxGeometry args={[9.6, 0.5, 0.5]} />
          <primitive object={jibMat} attach="material" />
        </mesh>
        <mesh position={[-2.6, 0.2, 0]} castShadow>
          <boxGeometry args={[3.6, 0.4, 0.45]} />
          <meshStandardMaterial color={ORANGE} roughness={0.6} />
        </mesh>
        {[-3.9, -3.3, -2.7].map((x) => (
          <mesh key={x} position={[x, -0.2, 0]} castShadow>
            <boxGeometry args={[0.5, 0.7, 0.8]} />
            <meshStandardMaterial color="#6b7280" roughness={0.9} />
          </mesh>
        ))}
        {/* cab and A-frame */}
        <mesh position={[0.5, -0.25, 0.45]} castShadow>
          <boxGeometry args={[0.9, 0.8, 0.7]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.7} />
        </mesh>
        <mesh position={[0.97, -0.2, 0.45]}>
          <boxGeometry args={[0.04, 0.45, 0.5]} />
          <meshStandardMaterial color="#2b4a8f" roughness={0.2} metalness={0.4} />
        </mesh>
        <mesh position={[0, 1.15, 0]} castShadow>
          <coneGeometry args={[0.45, 1.8, 4]} />
          <meshStandardMaterial color={ORANGE} roughness={0.6} />
        </mesh>
        <mesh ref={light} position={[0, 2.15, 0]}>
          <sphereGeometry args={[0.14, 8, 6]} />
          <meshBasicMaterial color="#ff3b30" toneMapped={false} />
        </mesh>
        {/* trolley, rope and hook block */}
        <group ref={trolley} position={[5, 0, 0]}>
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[0.55, 0.22, 0.6]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0, -2, 0]}>
            <boxGeometry args={[0.04, 4, 0.04]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <group ref={hook} position={[0, -2.8, 0]}>
            <mesh position={[0, -1.1, 0]} castShadow>
              <boxGeometry args={[0.5, 0.4, 0.5]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

function Tower({ spec, index, shared, textures, lattice }: { spec: Spec; index: number; shared: Shared; textures: FacadeTextures; lattice: THREE.Texture }) {
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
      color: spec.tint,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0,
      roughness: 0.42,
      metalness: 0.22,
      side: THREE.DoubleSide,
      clippingPlanes: [plane],
      clipShadows: true,
    });
  }, [textures, size, total, plane, spec.tint]);
  useEffect(
    () => () => {
      material.map?.dispose();
      material.emissiveMap?.dispose();
      material.dispose();
    },
    [material],
  );

  const plinth = useRef<THREE.Mesh>(null);
  const cap = useRef<THREE.Mesh>(null);
  const pillars = useRef<THREE.Group>(null);
  const slabs = useRef<(THREE.Mesh | null)[]>([]);
  const net = useRef<THREE.Mesh>(null);
  const roof = useRef<THREE.Group>(null);
  const craneActive = useRef(0);
  const craneTop = useRef(8);

  useFrame(() => {
    const p = shared.p.current;
    const t = clamp01((p - spec.start) / (spec.end - spec.start));
    const height = total * grow(t);
    // The glass follows the frame by a few floors and catches up at the end.
    const lag = 3 * FLOOR_H * (1 - smooth(0.9, 1, t));
    const facade = Math.max(0, height - lag);
    const open = height - facade;

    plane.constant = facade;
    material.emissiveIntensity = nightAt(p) * 1.25;

    if (plinth.current) {
      const s = smooth(spec.start - 0.05, spec.start, p);
      plinth.current.visible = s > 0.001;
      plinth.current.scale.set(1, Math.max(0.001, s), 1);
    }
    if (cap.current) {
      cap.current.visible = facade > 0.05;
      cap.current.position.y = facade + 0.07;
    }
    if (pillars.current) {
      pillars.current.visible = open > 0.05;
      pillars.current.position.y = facade + open / 2;
      pillars.current.scale.y = Math.max(0.001, open);
    }
    slabs.current.forEach((s, k) => {
      if (!s) return;
      const y = facade + (k + 1) * FLOOR_H;
      s.visible = open > 0.05 && y <= height + 0.01;
      s.position.y = y;
    });
    if (net.current) {
      const h = Math.max(0.001, open + 2.2);
      net.current.visible = t > 0 && t < 0.985;
      net.current.scale.y = h;
      net.current.position.y = Math.max(0, facade - 1.6) + h / 2;
    }
    if (roof.current) {
      const r = smooth(0.96, 1, t);
      roof.current.visible = r > 0.001;
      roof.current.position.y = total;
      roof.current.scale.setScalar(Math.max(0.001, r));
    }
    // Cranes work while their tower grows, then are taken down.
    craneActive.current = t <= 0 ? 0 : 1 - smooth(1, 1.07, (p - spec.start) / (spec.end - spec.start));
    craneTop.current = height;
  });

  const half = size / 2;
  return (
    <group position={[x, 0, z]}>
      <mesh ref={plinth} position={[0, 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[size + 1.6, 0.36, size + 1.6]} />
        <meshStandardMaterial color="#8d97ac" roughness={0.95} />
      </mesh>

      <mesh position={[0, total / 2, 0]} material={material} castShadow receiveShadow>
        <boxGeometry args={[size, total, size]} />
      </mesh>

      <mesh ref={cap} castShadow receiveShadow>
        <boxGeometry args={[size + 0.14, 0.14, size + 0.14]} />
        <meshStandardMaterial color="#c9d1e1" roughness={0.8} />
      </mesh>

      {/* concrete frame above the glass */}
      <group ref={pillars}>
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ].map(([sx, sz], k) => (
          <mesh key={k} position={[(sx! * (size - 0.34)) / 2, 0, (sz! * (size - 0.34)) / 2]} castShadow>
            <boxGeometry args={[0.34, 1, 0.34]} />
            <meshStandardMaterial color={CONCRETE} roughness={0.95} />
          </mesh>
        ))}
      </group>
      {[0, 1, 2].map((k) => (
        <mesh key={k} ref={(m) => void (slabs.current[k] = m)} castShadow receiveShadow>
          <boxGeometry args={[size + 0.06, 0.18, size + 0.06]} />
          <meshStandardMaterial color={CONCRETE} roughness={0.95} />
        </mesh>
      ))}

      {/* safety netting round the working floors */}
      <mesh ref={net}>
        <boxGeometry args={[size + 0.3, 1, size + 0.3]} />
        <meshStandardMaterial color="#2f9e63" transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} roughness={1} />
      </mesh>

      {/* roof: parapet, plant room and, on the tallest tower, an antenna */}
      <group ref={roof}>
        <mesh position={[0, 0.34, 0]} castShadow>
          <boxGeometry args={[size + 0.18, 0.5, size + 0.18]} />
          <meshStandardMaterial color="#d3dae8" roughness={0.8} />
        </mesh>
        <mesh position={[-half * 0.25, 0.95, half * 0.2]} castShadow>
          <boxGeometry args={[size * 0.38, 0.9, size * 0.34]} />
          <meshStandardMaterial color="#aab4c8" roughness={0.85} />
        </mesh>
        {floors > 24 && (
          <mesh position={[half * 0.3, 2.4, -half * 0.3]} castShadow>
            <cylinderGeometry args={[0.05, 0.09, 4.2, 6]} />
            <meshStandardMaterial color="#cbd5e1" />
          </mesh>
        )}
      </group>

      {spec.crane && (
        <group position={[half + 1.5, 0, half + 1.5]}>
          <Crane index={index} topRef={craneTop} active={craneActive} shared={shared} lattice={lattice} />
        </group>
      )}
    </group>
  );
}

/* --------------------------------------------------------------------- site */

function Site({ shared }: { shared: Shared }) {
  const fence = useRef<THREE.Group>(null);
  const tidy = useRef<THREE.Group>(null);
  const lawns = useRef<THREE.Group>(null);
  const ground = useRef<THREE.MeshStandardMaterial>(null);
  const pad = useRef<THREE.MeshStandardMaterial>(null);
  const soil = useMemo(() => new THREE.Color("#c4b295"), []);
  const grass = useMemo(() => new THREE.Color("#8fa57c"), []);
  const dirtPad = useMemo(() => new THREE.Color("#b09f86"), []);
  const paved = useMemo(() => new THREE.Color("#aeb7c9"), []);

  useFrame(() => {
    const p = shared.p.current;
    if (fence.current) {
      const s = 1 - smooth(0.12, 0.22, p);
      fence.current.visible = s > 0.01;
      fence.current.scale.y = Math.max(0.001, s);
    }
    if (tidy.current) {
      const s = 1 - smooth(0.58, 0.72, p);
      tidy.current.visible = s > 0.01;
      tidy.current.scale.setScalar(Math.max(0.001, s));
    }
    if (lawns.current) {
      const s = smooth(0.8, 0.92, p);
      lawns.current.visible = s > 0.01;
      lawns.current.scale.set(1, Math.max(0.001, s), 1);
    }
    ground.current?.color.copy(soil).lerp(grass, smooth(0.5, 0.85, p));
    pad.current?.color.copy(dirtPad).lerp(paved, smooth(0.45, 0.8, p));
  });

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[300, 48]} />
        <meshStandardMaterial ref={ground} color="#c4b295" roughness={1} />
      </mesh>
      {/* the plot */}
      <mesh position={[0, 0.03, 1]} receiveShadow>
        <boxGeometry args={[44, 0.1, 22]} />
        <meshStandardMaterial ref={pad} color="#b09f86" roughness={1} />
      </mesh>
      {/* road, kerbs and dashes */}
      <mesh position={[0, 0.04, 16]} receiveShadow>
        <boxGeometry args={[200, 0.08, 5]} />
        <meshStandardMaterial color="#2f3647" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.07, 13.1]} receiveShadow>
        <boxGeometry args={[200, 0.14, 1.4]} />
        <meshStandardMaterial color="#9aa3b5" roughness={1} />
      </mesh>
      <mesh position={[0, 0.07, 18.9]} receiveShadow>
        <boxGeometry args={[200, 0.14, 1.2]} />
        <meshStandardMaterial color="#9aa3b5" roughness={1} />
      </mesh>
      {Array.from({ length: 28 }, (_, i) => (
        <mesh key={i} position={[-84 + i * 6.2, 0.1, 16]}>
          <boxGeometry args={[2.6, 0.02, 0.16]} />
          <meshStandardMaterial color="#e6e9f0" roughness={0.9} />
        </mesh>
      ))}

      {/* site hoarding, taken down once work is under way */}
      <group ref={fence} position={[0, 0, 0]}>
        {Array.from({ length: 18 }, (_, i) => (
          <mesh key={i} position={[-20.8 + i * 2.45, 0.55, 11.4]} castShadow>
            <boxGeometry args={[2.3, 1.1, 0.1]} />
            <meshStandardMaterial color={i % 2 ? "#f1f5f9" : ORANGE} roughness={0.8} />
          </mesh>
        ))}
      </group>

      {/* containers and material piles, cleared away before the finish */}
      <group ref={tidy}>
        {[
          [-17, 6, "#3b6fb5"],
          [-17, 3.2, "#f59e0b"],
          [-14.3, 6, "#e5e7eb"],
        ].map(([cx, cz, col], i) => (
          <mesh key={i} position={[cx as number, 0.75, cz as number]} castShadow receiveShadow>
            <boxGeometry args={[2.4, 1.5, 5]} />
            <meshStandardMaterial color={col as string} roughness={0.7} metalness={0.2} />
          </mesh>
        ))}
        {[
          [15, 7.5, 1.6],
          [17.5, 6.4, 1.1],
          [14.2, 4.8, 1.3],
        ].map(([px, pz, s], i) => (
          <mesh key={i} position={[px as number, (s as number) * 0.45, pz as number]} castShadow>
            <coneGeometry args={[s as number, (s as number) * 0.95, 7]} />
            <meshStandardMaterial color={i % 2 ? "#8b7355" : "#9ca3af"} roughness={1} />
          </mesh>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[12 + i * 1.5, 0.3, 8.8]} castShadow>
            <boxGeometry args={[1.2, 0.6, 1.2]} />
            <meshStandardMaterial color="#d6c9a8" roughness={1} />
          </mesh>
        ))}
      </group>

      {/* lawns and paths once the site is finished */}
      <group ref={lawns}>
        {[
          [-12, 9, 9, 5],
          [0, 11, 8, 2.4],
          [12.5, 8.6, 10, 5.4],
        ].map(([lx, lz, w, d], i) => (
          <mesh key={i} position={[lx as number, 0.12, lz as number]} receiveShadow>
            <boxGeometry args={[w as number, 0.12, d as number]} />
            <meshStandardMaterial color="#5f9a6b" roughness={1} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/** Round and pointed trees plus bushes; they grow in near the end. */
function Greenery({ shared }: { shared: Shared }) {
  const group = useRef<THREE.Group>(null);
  const spots = useMemo(() => {
    const out: { x: number; z: number; s: number; round: boolean }[] = [];
    for (let i = 0; i < 24; i++) out.push({ x: -21 + i * 1.8, z: 12 + noise(i, 1) * 0.9, s: 0.7 + noise(i, 2) * 0.55, round: i % 3 === 0 });
    for (let i = 0; i < 9; i++) out.push({ x: -19 + i * 4.8, z: 8.4 + noise(i, 5) * 0.8, s: 0.6 + noise(i, 6) * 0.4, round: i % 2 === 0 });
    return out;
  }, []);

  useFrame(() => {
    const k = smooth(0.82, 0.97, shared.p.current);
    group.current?.children.forEach((c, i) => {
      const s = clamp01(k * 1.7 - (i % 7) * 0.09);
      c.visible = s > 0.001;
      c.scale.setScalar(Math.max(0.0001, s));
    });
  });

  return (
    <group ref={group}>
      {spots.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={0.0001}>
          <mesh position={[0, 0.4 * t.s, 0]} castShadow>
            <cylinderGeometry args={[0.07 * t.s, 0.1 * t.s, 0.8 * t.s, 6]} />
            <meshStandardMaterial color="#5b4636" roughness={1} />
          </mesh>
          {t.round ? (
            <mesh position={[0, 1.35 * t.s, 0]} castShadow>
              <icosahedronGeometry args={[0.72 * t.s, 1]} />
              <meshStandardMaterial color="#4c9a62" roughness={0.95} flatShading />
            </mesh>
          ) : (
            <mesh position={[0, 1.3 * t.s, 0]} castShadow>
              <coneGeometry args={[0.5 * t.s, 1.5 * t.s, 8]} />
              <meshStandardMaterial color="#3a8456" roughness={0.95} flatShading />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/** Street lamps and traffic along the road in front of the site. */
function Street({ shared }: { shared: Shared }) {
  const heads = useRef<THREE.MeshBasicMaterial[]>([]);
  const pools = useRef<THREE.MeshBasicMaterial[]>([]);
  const carRefs = useRef<(THREE.Group | null)[]>([]);
  const lamps = useMemo(() => Array.from({ length: 9 }, (_, i) => -30 + i * 7.5), []);
  const cars = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        lane: i % 2 === 0 ? 1 : -1,
        speed: 3.4 + noise(i, 3) * 3.2,
        offset: noise(i, 4) * 120,
        color: ["#e5e7eb", "#1f2937", "#b91c1c", "#1d4ed8", "#cbd5e1", "#0f766e", "#f59e0b"][i]!,
      })),
    [],
  );
  const headLights = useRef<THREE.MeshBasicMaterial[]>([]);

  useFrame(({ clock }) => {
    const night = nightAt(shared.p.current);
    heads.current.forEach((m) => m && m.color.set("#ffe2a8").multiplyScalar(0.25 + 1.4 * night));
    pools.current.forEach((m) => m && (m.opacity = 0.26 * night));
    headLights.current.forEach((m) => m && m.color.set("#fff4cf").multiplyScalar(0.4 + 1.6 * night));
    const t = clock.elapsedTime;
    cars.forEach((c, i) => {
      const g = carRefs.current[i];
      if (!g) return;
      const span = 130;
      const along = (((t * c.speed + c.offset) % span) + span) % span;
      g.position.x = c.lane > 0 ? -65 + along : 65 - along;
      g.position.z = 16 + c.lane * 1.05;
      g.rotation.y = c.lane > 0 ? 0 : Math.PI;
    });
  });

  return (
    <>
      {lamps.map((x, i) => (
        <group key={i} position={[x, 0, 13.1]}>
          <mesh position={[0, 2.4, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.1, 4.8, 8]} />
            <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[0, 4.75, 0.55]} castShadow>
            <boxGeometry args={[0.16, 0.12, 1.3]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          <mesh position={[0, 4.65, 1.05]}>
            <boxGeometry args={[0.5, 0.1, 0.34]} />
            <meshBasicMaterial ref={(m) => void (m && (heads.current[i] = m))} color="#ffe2a8" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.13, 2.4]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[3.4, 24]} />
            <meshBasicMaterial ref={(m) => void (m && (pools.current[i] = m))} color="#ffd9a0" transparent opacity={0} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {cars.map((c, i) => (
        <group key={i} ref={(g) => void (carRefs.current[i] = g)} position={[0, 0, 16]}>
          <mesh position={[0, 0.42, 0]} castShadow>
            <boxGeometry args={[2.3, 0.55, 1.05]} />
            <meshStandardMaterial color={c.color} roughness={0.35} metalness={0.5} />
          </mesh>
          <mesh position={[-0.1, 0.88, 0]} castShadow>
            <boxGeometry args={[1.25, 0.4, 0.95]} />
            <meshStandardMaterial color="#1e293b" roughness={0.15} metalness={0.6} />
          </mesh>
          {[-0.75, 0.75].map((wx) =>
            [-0.5, 0.5].map((wz) => (
              <mesh key={`${wx}${wz}`} position={[wx, 0.2, wz]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.22, 0.22, 0.16, 10]} />
                <meshStandardMaterial color="#111827" roughness={0.9} />
              </mesh>
            )),
          )}
          {[-0.36, 0.36].map((hz) => (
            <mesh key={hz} position={[1.16, 0.46, hz]}>
              <boxGeometry args={[0.06, 0.14, 0.22]} />
              <meshBasicMaterial ref={(m) => void (m && (headLights.current[i * 2 + (hz > 0 ? 1 : 0)] = m))} color="#fff4cf" toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/* ---------------------------------------------------------------------- rig */

function Rig({ shared, progress }: { shared: Shared; progress: MutableRefObject<number> }) {
  const { camera, size, setDpr } = useThree();
  const frames = useRef({ time: 0, count: 0 });
  const keys = useMemo(
    () => [
      { p: 0, pos: new THREE.Vector3(5, 7.5, 50), look: new THREE.Vector3(0, 3.5, 0) },
      { p: 0.3, pos: new THREE.Vector3(-25, 12, 45), look: new THREE.Vector3(-4, 8, 0) },
      { p: 0.66, pos: new THREE.Vector3(25, 20, 45), look: new THREE.Vector3(2, 13, -1) },
      { p: 1, pos: new THREE.Vector3(0, 15, 60), look: new THREE.Vector3(0, 11.5, -1) },
    ],
    [],
  );
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }, dt) => {
    // One damped value, shared by every part of the scene.
    shared.p.current = THREE.MathUtils.damp(shared.p.current, progress.current, 5, Math.min(dt, 0.1));

    // Step quality down if frames stay slow (ignoring pauses from a hidden tab).
    if (dt < 0.5 && !document.hidden) {
      frames.current.time += dt;
      frames.current.count++;
      if (frames.current.count >= 90) {
        const avg = frames.current.time / frames.current.count;
        frames.current.time = 0;
        frames.current.count = 0;
        if (avg > 0.038 && shared.quality.level < 2) {
          shared.quality.level++;
          if (shared.quality.level === 1) setDpr(1);
        }
      }
    }
    const p = shared.p.current;

    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1]!.p) i++;
    const k0 = keys[i]!;
    const k1 = keys[i + 1]!;
    const t = smooth(k0.p, k1.p, p);
    pos.copy(a.copy(k0.pos).lerp(k1.pos, t));
    look.copy(b.copy(k0.look).lerp(k1.look, t));

    // A slow sway keeps the picture alive between scroll steps.
    const s = clock.elapsedTime;
    pos.x += Math.sin(s * 0.17) * 0.9;
    pos.y += Math.sin(s * 0.23) * 0.25;

    // Portrait screens: a wider lens, less sideways travel, and enough distance
    // for the whole site (about 38 units across) to fit the narrow view.
    const aspect = size.width / size.height;
    const portrait = clamp01((1.2 - aspect) / 0.8);
    const cam = camera as THREE.PerspectiveCamera;
    const fov = 38 + portrait * 16;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    pos.x = look.x + (pos.x - look.x) * (1 - portrait * 0.7);
    const dir = pos.clone().sub(look);
    const need = 31 / (2 * Math.tan((fov * Math.PI) / 360) * Math.min(aspect, 1.4));
    dir.setLength(Math.max(dir.length(), need));
    pos.copy(look).add(dir);
    pos.y += portrait * 9;
    look.y -= portrait * 1;
    camera.position.copy(pos);
    camera.lookAt(look);
  });
  return null;
}

function Scene({ progress, small }: { progress: MutableRefObject<number>; small: boolean }) {
  const shared = useMemo<Shared>(() => ({ p: { current: 0 }, small, quality: { level: 0 } }), [small]);
  const { gl, scene } = useThree();
  const textures = useMemo(() => makeFacadeTextures(Math.min(8, gl.capabilities.getMaxAnisotropy())), [gl]);
  const lattice = useMemo(() => makeLatticeTexture(), []);

  useEffect(() => {
    scene.fog = new THREE.Fog("#f7dcbf", 70, 215);
    return () => {
      textures.map.dispose();
      textures.emissive.dispose();
      lattice.dispose();
    };
  }, [scene, textures, lattice]);

  return (
    <>
      <Rig shared={shared} progress={progress} />
      <Sky shared={shared} />
      <Lights shared={shared} />
      <Site shared={shared} />
      <Street shared={shared} />
      {TOWERS.map((spec, i) => (
        <Tower key={i} spec={spec} index={i} shared={shared} textures={textures} lattice={lattice} />
      ))}
      <Greenery shared={shared} />
    </>
  );
}

export default function BuildScene({
  progress,
  active = true,
  className,
}: {
  /** Mutable 0..1 value that the page writes (from scroll) and the scene reads. */
  progress: MutableRefObject<number>;
  /** False while the section is far off-screen: rendering stops and the last frame stays. */
  active?: boolean;
  className?: string;
}) {
  const small = typeof window !== "undefined" && window.innerWidth < 700;
  return (
    <Canvas
      className={className}
      frameloop={active ? "always" : "never"}
      dpr={small ? [1, 1.5] : [1, 2]}
      shadows="soft"
      camera={{ fov: 38, near: 0.5, far: 520, position: [5, 7.5, 50] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.02;
      }}
    >
      <Scene progress={progress} small={small} />
    </Canvas>
  );
}
