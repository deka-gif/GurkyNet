import { Media } from './media';

export interface WebsiteSetting {
  id: number;
  websiteName: string;
  tagline?: string;
  logo?: string;
  logoDark?: string;
  favicon?: string;
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
  createdAt?: string;
  lastUpdated?: string;
}

export type HomepageSectionComponentType =
  | 'hero'
  | 'banner'
  | 'promo'
  | 'categories'
  | 'product_grid'
  | 'announcement'
  | 'news'
  | 'faq'
  | 'footer';

export interface HomepageSection {
  id: number;
  title: string;
  slug: string;
  componentType: HomepageSectionComponentType;
  displayOrder: number;
  visible: boolean;
  status?: string;
  description?: string;
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

