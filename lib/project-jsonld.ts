import { getSiteUrl } from "@/lib/site";

export async function fetchProjectJsonLd(id: string): Promise<object | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
  const siteUrl = getSiteUrl();
  try {
    const res = await fetch(`${apiUrl}/projects/${id}/full`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const p = await res.json();
    const image =
      (p.imageUrl && String(p.imageUrl).trim()) ||
      p.media?.[0]?.imageUrl ||
      undefined;
    const address: Record<string, string> = {
      "@type": "PostalAddress",
      addressCountry: "UZ",
    };
    if (p.location) address.addressLocality = p.location;
    if (p.district) address.streetAddress = p.district;

    return {
      "@context": "https://schema.org",
      "@type": "ApartmentComplex",
      name: p.name,
      description: p.description || undefined,
      url: `${siteUrl}/catalog/${id}`,
      image: image
        ? image.startsWith("http")
          ? image
          : new URL(image, siteUrl).toString()
        : undefined,
      address,
    };
  } catch {
    return null;
  }
}
