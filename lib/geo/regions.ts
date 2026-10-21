import geo from "./uzb-geo.json";

export type GeoDistrict = { name: string; path: string; center: [number, number] };

export type GeoRegion = {
  id: string;
  en: string;
  ru: string;
  uz: string;
  path: string;
  /** [minX, minY, maxX, maxY] in map units */
  bbox: [number, number, number, number];
  center: [number, number];
  districts: GeoDistrict[];
};

export const REGIONS = geo.regions as GeoRegion[];

export const UZB_BBOX = geo.bbox as [number, number, number, number];

const WORLD = geo.world as number;
const [ORIGIN_X, ORIGIN_Y] = geo.origin as [number, number];

/** WGS84 → map units (Web Mercator, so raster tiles line up with the vector shapes). */
export function project(lat: number, lon: number): [number, number] {
  const x = ((lon + 180) / 360) * WORLD;
  const y = (0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI)) * WORLD;
  return [x - ORIGIN_X, y - ORIGIN_Y];
}

/** Label anchors (lat, lon) where the polygon centroid would collide or fall outside the shape. */
const LABEL_LATLON: Record<string, [number, number]> = {
  "tashkent-region": [41.9, 69.95],
  "tashkent-city": [41.29, 69.25],
  namangan: [41.28, 71.2],
  andijan: [40.72, 72.43],
  fergana: [40.3, 71.2],
  syrdarya: [40.62, 68.5],
  karakalpakstan: [43.4, 58.74],
  navoiy: [42.0, 64.2],
};

export const LABEL_OVERRIDES: Record<string, [number, number]> = Object.fromEntries(
  Object.entries(LABEL_LATLON).map(([id, [lat, lon]]) => [id, project(lat, lon)]),
);

export type TileSpec = { key: string; x: number; y: number; size: number; url: string };

const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** Raster tiles covering the viewBox, at a zoom matched to `unitsPerPx`. */
export function tilesFor(vb: [number, number, number, number], unitsPerPx: number): TileSpec[] {
  const z = Math.max(5, Math.min(18, Math.round(Math.log2(WORLD / (256 * unitsPerPx)))));
  const n = 2 ** z;
  const size = WORLD / n;
  const col0 = Math.floor((vb[0] + ORIGIN_X) / size);
  const col1 = Math.floor((vb[0] + vb[2] + ORIGIN_X) / size);
  const row0 = Math.floor((vb[1] + ORIGIN_Y) / size);
  const row1 = Math.floor((vb[1] + vb[3] + ORIGIN_Y) / size);
  const out: TileSpec[] = [];
  for (let c = Math.max(0, col0); c <= Math.min(n - 1, col1); c++) {
    for (let r = Math.max(0, row0); r <= Math.min(n - 1, row1); r++) {
      out.push({
        key: `${z}/${c}/${r}`,
        x: c * size - ORIGIN_X,
        y: r * size - ORIGIN_Y,
        size,
        url: TILE_URL.replace("{z}", String(z)).replace("{x}", String(c)).replace("{y}", String(r)),
      });
    }
  }
  return out.length > 60 ? [] : out;
}

export function regionName(r: GeoRegion, locale: string): string {
  return locale === "ru" ? r.ru : locale === "uz" ? r.uz : r.en;
}

const REGION_KEYS: [string, string[]][] = [
  ["tashkent-region", ["tashkent region", "ташкентская", "toshkent viloyati"]],
  ["tashkent-city", ["tashkent", "ташкент", "toshkent"]],
  ["samarkand", ["samarkand", "самарканд", "samarqand"]],
  ["fergana", ["fergana", "фергана", "farg"]],
  ["andijan", ["andijan", "андижан", "andijon"]],
  ["namangan", ["namangan", "наманган"]],
  ["bukhara", ["bukhara", "бухар", "buxoro"]],
  ["kashkadarya", ["kashkadarya", "кашкадар", "qashqadaryo"]],
  ["surkhandarya", ["surkhandarya", "сурхандар", "surxondaryo"]],
  ["navoiy", ["navoiy", "navoi", "навои"]],
  ["jizzakh", ["jizzakh", "jizzax", "джизак"]],
  ["syrdarya", ["syrdarya", "sirdarya", "sirdaryo", "сырдар"]],
  ["khorezm", ["khorezm", "xorazm", "horezm", "хорезм"]],
  ["karakalpakstan", ["karakalpak", "qoraqalpoq", "qoraqalpog", "каракалпак"]],
];

/** Maps a free-form project `location` string to a region id. */
export function regionIdFromLocation(location?: string | null): string | null {
  const s = (location ?? "").toLowerCase();
  if (!s) return null;
  for (const [id, keys] of REGION_KEYS) {
    if (keys.some((k) => s.includes(k))) return id;
  }
  return null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9а-яё]+/g, "")
    .replace(/(city|district|region|ский|ий|ой|г\.?)/g, "")
    .replace(/[aаo]/g, "a");

function findDistrict(region: GeoRegion, district?: string | null): GeoDistrict | null {
  const q = norm(district ?? "");
  if (q.length < 3) return null;
  return (
    region.districts.find((d) => {
      const n = norm(d.name);
      return n.length >= 3 && (n === q || n.startsWith(q.slice(0, 5)) || q.startsWith(n.slice(0, 5)));
    }) ?? null
  );
}

const COORD_PATTERNS: RegExp[] = [
  /!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/, // google embed: lon, lat
  /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // @lat,lon
  /[?&](?:q|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // q=lat,lon
];

function coordsFromMapUrl(url?: string | null): [number, number] | null {
  if (!url) return null;
  for (let i = 0; i < COORD_PATTERNS.length; i++) {
    const m = url.match(COORD_PATTERNS[i]);
    if (!m) continue;
    const [a, b] = [parseFloat(m[1]), parseFloat(m[2])];
    const [lat, lon] = i === 0 ? [b, a] : [a, b];
    if (lat > 36 && lat < 46 && lon > 55 && lon < 74) return [lat, lon];
  }
  return null;
}

export type ApiProjectLike = {
  id: number | string;
  name: string;
  location?: string | null;
  district?: string | null;
  imageUrl?: string | null;
  mapEmbedUrl?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  deliveryDate?: string | null;
  hasInstallment?: boolean;
  [k: string]: unknown;
};

export type MapProject = {
  id: string;
  name: string;
  regionId: string;
  district: string;
  imageUrl: string;
  deliveryDate: string;
  priceFrom: number | null;
  /** position in map units */
  pos: [number, number];
  /** true when the position is only approximate (district / region level) */
  approx: boolean;
};

/** Deterministic 0..1 value so approximate pins do not jump between renders. */
function hash01(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export function toMapProject(
  p: ApiProjectLike,
  priceFrom: number | null,
): MapProject | null {
  const regionId = regionIdFromLocation(p.location);
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return null;
  const id = String(p.id);

  const lat = Number(p.latitude);
  const lon = Number(p.longitude);
  const fromFields: [number, number] | null =
    p.latitude != null && p.longitude != null && lat > 36 && lat < 46 && lon > 55 && lon < 74 ? [lat, lon] : null;
  const exact = fromFields ?? coordsFromMapUrl(p.mapEmbedUrl);
  let pos: [number, number];
  let approx = false;
  if (exact) {
    pos = project(exact[0], exact[1]);
  } else {
    approx = true;
    const d = findDistrict(region, p.district);
    const base = d ? d.center : region.center;
    const rw = region.bbox[2] - region.bbox[0];
    const spread = d ? Math.min(8, rw / 12) : Math.min(30, rw / 6);
    const ang = hash01(id, 1) * Math.PI * 2;
    const rad = Math.sqrt(hash01(id, 2)) * spread;
    pos = [base[0] + Math.cos(ang) * rad, base[1] + Math.sin(ang) * rad];
  }

  return {
    id,
    name: p.name,
    regionId: region.id,
    district: p.district ?? "",
    imageUrl: p.imageUrl ?? "",
    deliveryDate: p.deliveryDate ?? "",
    priceFrom,
    pos,
    approx,
  };
}
