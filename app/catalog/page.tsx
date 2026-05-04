import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { FilterDrawer } from "@/components/custom/FilterDrawer";
import { ProjectGrid } from "@/components/custom/ProjectGrid";
import { Project } from "@/types";
import { minPricePerM2FromApiProject } from "@/lib/project-price";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

type CatalogPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Seo");
  const siteUrl = getSiteUrl();
  const title = t("catalogTitle");
  const description = t("catalogDescription");
  const keywords = t("defaultKeywords")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ogImage = absoluteUrl("/osonuy-logo-removebg-preview.png");
  const locale = await getLocale();
  const canonical = `${siteUrl}/catalog`;

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: t("siteName"),
      locale,
      type: "website",
      images: [{ url: ogImage, width: 800, height: 800, alt: t("ogImageAlt") }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
      site: t("twitterSite") || undefined,
    },
  };
}

const toNumber = (value?: string | string[]) => {
  if (!value || Array.isArray(value)) return undefined;
  const parsed = Number(value.toString().replace(/\s/g, ""));
  return Number.isNaN(parsed) ? undefined : parsed;
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const t = await getTranslations("Catalog");
  const params = await searchParams;

  const location =
    typeof params.location === "string" ? params.location : undefined;
  const district =
    typeof params.district === "string" ? params.district : undefined;

  const priceMin = toNumber(params.priceMin) || toNumber(params.pricePerM2Min);
  const priceMax = toNumber(params.priceMax) || toNumber(params.pricePerM2Max);
  const areaMin = toNumber(params.areaMin);
  const areaMax = toNumber(params.areaMax);

  const isVerifiedFilter = params.verified === "true";
  const isPopularFilter = params.popular === "true";

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

  let projectsData = [];
  try {
    const res = await fetch(`${apiUrl}/projects`, { cache: "no-store" });
    if (res.ok) {
      projectsData = await res.json();
    }
  } catch (e) {
    console.error("Fetch error:", e);
  }

  const filteredProjects = projectsData
    .filter((project: any) => {
      if (isVerifiedFilter && !project.badgeVerified) return false;
      if (isPopularFilter && !project.isPopular) return false;

      if (location) {
        const pLoc = project.location?.toLowerCase() || "";
        const sLoc = location.toLowerCase().replace(" region", "").trim();
        if (!pLoc.includes(sLoc)) return false;
      }

      if (district) {
        const pDist = project.district?.toLowerCase() || "";
        const sDist = district.toLowerCase().trim();
        if (!pDist.includes(sDist)) return false;
      }

      if (priceMin || priceMax || areaMin || areaMax) {
        const hasFloors = (project.floors?.length ?? 0) > 0;
        if (!hasFloors) return false;

        return project.floors.some((fl: any) => {
          const perM2 = fl.pricePerM2 || 0;
          if (priceMin && perM2 < priceMin) return false;
          if (priceMax && perM2 > priceMax) return false;

          const areas: number[] = (fl.areaOptions?.length
            ? fl.areaOptions
            : []
          ).map((o: any) => Number(o.areaSqm) || 0);

          if (areaMin || areaMax) {
            const areaMatch = areas.some((area: number) => {
              if (!area) return false;
              if (areaMin && area < areaMin) return false;
              if (areaMax && area > areaMax) return false;
              return true;
            });
            if (!areaMatch) return false;
          }

          return true;
        });
      }

      return true;
    })
    .sort(
      (a: any, b: any) => (b.topInCatalog ? 1 : 0) - (a.topInCatalog ? 1 : 0),
    )
    .map((project: any) => {
      const minPerM2 = minPricePerM2FromApiProject(project);

      const mappedProject: Project = {
        id: String(project.id),
        name: project.name,
        description: project.description || "",
        image: project.imageUrl || "",
        mainImage: project.imageUrl || "",
        location: project.location,
        district: project.district || "",
        developer: {
          name: project.developer?.name ?? "Developer",
          verified: project.badgeVerified ?? false,
          logo: project.developer?.logoUrl ?? "",
          phone: project.developer?.phone,
          email: project.developer?.email,
          website: project.developer?.website,
          legalAddress: project.developer?.legalAddress,
          officeAddress: project.developer?.officeAddress,
          description: project.developer?.description,
        },
        deliveryDate: project.deliveryDate,
        tags: [],
        images: project.media?.length
          ? project.media.map((item: any) => item.imageUrl)
          : project.imageUrl
            ? [project.imageUrl]
            : [],
        priceFrom: minPerM2,
        projectFloors: (project.floors ?? []).map((f: any) => ({
          ...f,
          areaOptions: f.areaOptions ?? [],
          layouts: f.layouts ?? [],
        })),
        isPopular: Boolean(project.topInCatalog || project.topInHome || project.isPopular),
        badgeVerified: project.badgeVerified ?? false,
        badgeTrusted: project.badgeTrusted ?? false,
        avgRating: project.avgRating ?? null,
        reviewsCount: project.reviewsCount ?? 0,
        plan: project.plan,
        floors: project.totalFloors || 0,
        hasInstallment: Boolean(project.hasInstallment),
      };

      return mappedProject;
    });

  const translations = {
    filters: t("filters"),
    title: t("drawer.title"),
    description: t("drawer.description"),
    apply: t("drawer.apply"),
    reset: t("drawer.reset"),
    from: t("drawer.from"),
    to: t("drawer.to"),
    verified: t("drawer.verified"),
    popular: t("popular"),
    area_from: t("drawer.area_from"),
    area_to: t("drawer.area_to"),
    pricePerM2Label: t("drawer.pricePerM2Label"),
    areaLabel: t("drawer.areaLabel"),
    additionalLabel: t("drawer.additionalLabel"),
  };

  return (
    <div className="lg:pt-5 md:pt-20 pb-16 px-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <h1 className="text-4xl font-black text-primary tracking-tight">
          {t("title")}
        </h1>
        <FilterDrawer translations={translations} />
      </div>

      {filteredProjects.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-3xl text-slate-400">
          {t("noResults")}
        </div>
      ) : (
        <ProjectGrid projects={filteredProjects} />
      )}
    </div>
  );
}
