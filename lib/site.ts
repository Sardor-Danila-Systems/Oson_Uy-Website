/**
 * Canonical site origin for SEO (metadataBase, sitemap, canonical, JSON-LD).
 * Set NEXT_PUBLIC_SITE_URL in production, e.g. https://osonuy.uz
 */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "";
  if (raw) {
    return raw.startsWith("http") ? raw.replace(/\/$/, "") : `https://${raw.replace(/\/$/, "")}`;
  }
  return "https://osonuy.uz";
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
