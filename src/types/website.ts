import { Media } from './media';

export interface HomepageProduct {
  id: string;
  code: string;
  name: string;
  price: number;
  category: string;
  operatorName: string;
  status: string;
  isActive?: boolean;
}

export interface WebsiteSetting {
  id: number;
  websiteName: string;
  tagline?: string;
  logo?: string | Media;
  logoDark?: string | Media;
  favicon?: string | Media;
  logoMediaId?: number;
  logoDarkMediaId?: number;
  faviconMediaId?: number;
  logoMedia?: Media;
  logoDarkMedia?: Media;
  faviconMedia?: Media;
  supportEmail?: string;
  supportPhone?: string;
  whatsapp?: string;
  officeAddress?: string;
  /** FR-MKT01 — jam operasional (footer / kontak / help). */
  operatingHours?: string;
  googleMapsUrl?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  twitter?: string;
  copyright?: string;
  maintenanceMode: boolean;
  timezone?: string;
  currency?: string;
  language?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  createdAt?: string;
  lastUpdated?: string;
}

export type HomepageSectionComponentType =
  | 'hero'
  | 'banner'
  | 'promo'
  | 'features'
  | 'categories'
  | 'product_grid'
  | 'statistics'
  | 'why_us'
  | 'partners'
  | 'testimonials'
  | 'how_it_works'
  | 'announcement'
  | 'news'
  | 'faq'
  | 'cta'
  | 'footer'
  | 'seo';

export type HomepageSectionAnimation = 'fade' | 'slide_up' | 'scale' | 'none';

export interface HomepageSectionContentItem {
  title?: string;
  subtitle?: string;
  description?: string;
  value?: string;
  icon?: string;
  image?: string;
  url?: string;
}

export interface HomepageSection {
  id: number;
  title: string;
  subtitle?: string;
  slug: string;
  componentType: HomepageSectionComponentType;
  displayOrder: number;
  visible: boolean;
  status?: string;
  description?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  animation?: HomepageSectionAnimation;
  contentItems?: HomepageSectionContentItem[];
  heroBackgroundMediaId?: number;
  heroIllustrationMediaId?: number;
  heroMobileImageMediaId?: number;
  heroBackgroundMedia?: Media;
  heroIllustrationMedia?: Media;
  heroMobileImageMedia?: Media;
  heroBackground?: string;
  heroIllustration?: string;
  heroMobileImage?: string;
  createdAt?: string;
  lastUpdated?: string;
}

export interface WebsiteMenu {
  id: number;
  title: string;
  slug?: string;
  url: string;
  icon?: string;
  parentId?: number;
  parent?: WebsiteMenu;
  children?: WebsiteMenu[];
  displayOrder: number;
  visible: boolean;
  openInNewTab: boolean;
  createdAt?: string;
  lastUpdated?: string;
}

export interface StaticPage {
  id: number;
  title: string;
  slug: string;
  content: string;
  seoTitle?: string;
  seoDescription?: string;
  status: 'draft' | 'published';
  publishedAt?: string;
  createdAt?: string;
  lastUpdated?: string;
}

export interface PublicBanner {
  id: number;
  type: string;
  title: string;
  image: string | Media;
  mobileImage?: Media | null;
  imageMediaId?: number;
  mobileImageMediaId?: number;
  redirectUrl?: string;
  isActive: boolean;
  createdAt?: string;
  lastUpdated?: string;
}

export interface HomepageCatalogBucket {
  key: string;
  label: string;
  slug: string;
  icon?: string;
  productCount: number;
  category?: {
    id: number;
    name: string;
    slug: string;
    icon?: string;
  } | null;
  products: HomepageProduct[];
  previewProduct?: HomepageProduct | null;
}

export interface HomepageFeaturedProduct {
  id: number;
  display_order: number;
  is_active: boolean;
  product_id: number;
  product: HomepageProduct | null;
}

export interface HomepagePayload {
  settings: WebsiteSetting | null;
  sections: HomepageSection[];
  banners: PublicBanner[];
  hero: HomepageSection | null;
  homepageCategories: HomepageCatalogBucket[];
  featuredProducts: HomepageProduct[];
  faqs: Array<{
    id: number;
    question: string;
    answer: string;
    order: number;
  }>;
  menus?: WebsiteMenu[];
  pages?: StaticPage[];
  seo?: {
    title?: string | null;
    description?: string | null;
    keywords?: string | null;
  };
  cachedForSeconds?: number;
}

