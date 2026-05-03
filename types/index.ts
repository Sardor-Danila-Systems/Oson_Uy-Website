export type Location = 'Tashkent' | 'Samarkand' | 'Bukhara';

export interface ProjectFloorAreaOption {
  id?: number;
  areaSqm: number;
  sortOrder?: number;
}

export interface ProjectFloorLayout {
  id?: number;
  imageUrl: string;
  title?: string | null;
  sortOrder?: number;
}

/** Per-floor listing from developer cabinet (matches API / Prisma). */
export interface ProjectFloor {
  id: number;
  projectId: number;
  floor: number;
  pricePerM2: number;
  title?: string | null;
  sortOrder?: number;
  areaOptions: ProjectFloorAreaOption[];
  layouts: ProjectFloorLayout[];
}

export interface ProjectDeveloper {
  name: string;
  verified: boolean;
  logo: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  legalAddress?: string | null;
  officeAddress?: string | null;
  description?: string | null;
}

/** Compact project row from API (sibling / nearby carousels). */
export interface CatalogProjectPreview {
  id: number;
  name: string;
  location: string;
  district: string | null;
  imageUrl: string;
  deliveryDate: string;
  hasInstallment: boolean;
  priceFrom: number | null;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  image: string;
  location: Location;
  developer: ProjectDeveloper;
  deliveryDate: string;
  tags: string[];
  images: string[];
  mainImage: string;
  /** Minimum price per m² (UZS) across published floors, for catalog cards. */
  priceFrom: number;
  /** Building height (storeys), not the `floors` relation from API. */
  floors: number;
  /** Populated from API `floors` (ProjectFloor[]). */
  projectFloors?: ProjectFloor[];
  district: string;
  advantages?: string[];
  mapEmbedUrl?: string;
  totalFloors?: number | null;
  totalUnits?: number | null;
  isPopular?: boolean;
  badgeVerified?: boolean;
  badgeTrusted?: boolean;
  topInCatalog?: boolean;
  topInHome?: boolean;
  avgRating?: number | null;
  reviewsCount?: number;
  plan?: "START" | "PRO" | "PREMIUM" | "ULTIMATE";
  hasInstallment?: boolean;
}

export interface FilterState {
  location: Location | 'All';
  rooms: number | 'All';
  priceRange: [number, number];
  areaRange: [number, number];
}
