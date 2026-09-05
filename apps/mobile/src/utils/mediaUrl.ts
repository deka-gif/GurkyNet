import { API_BASE_URL } from '../api/client';

/**
 * Origin for public media delivery — mirrors web `src/services/api.ts` getApiOrigin.
 * EXPO_PUBLIC_API_BASE_URL is typically `https://host/api/v1`; media lives at
 * `{origin}/api/v1/public/media/{path}`.
 */
export function getApiOrigin(): string {
  const base = API_BASE_URL.trim();
  if (!base) return '';

  try {
    const apiUrl = new URL(base);
    const apiRootPath = apiUrl.pathname.replace(/\/api(?:\/.*)?$/, '');
    return apiUrl.origin + apiRootPath;
  } catch {
    // Non-URL base (unlikely) — strip trailing /api/v1 manually.
    return base.replace(/\/api(?:\/v1)?\/?$/, '');
  }
}

/**
 * Resolve a Marketing/media path to an absolute URL for React Native Image.
 * Mirrors web `src/utils/mediaUrl.ts` (without browser-only `window` branches).
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';

  const trimmed = url.trim();
  if (!trimmed) return '';

  if (/^(data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  const origin = getApiOrigin();
  if (!origin) return '';

  const storageMatch = trimmed.match(/^(?:https?:\/\/[^/]+)?\/storage\/(.+)$/i);
  if (storageMatch) {
    return `${origin}/api/v1/public/media/${storageMatch[1]}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/api/v1/public/media/')) {
    return `${origin}${trimmed}`;
  }

  if (trimmed.startsWith('storage/')) {
    return `${origin}/api/v1/public/media/${trimmed.slice('storage/'.length)}`;
  }

  // Disk-relative path (logos/uuid.png, category-icons/uuid.png)
  if (!trimmed.startsWith('/')) {
    return `${origin}/api/v1/public/media/${trimmed}`;
  }

  return `${origin}${trimmed}`;
}

/**
 * Reject sync placeholders like "telkomsel.png" (filename only, no folder).
 * Mirrors web `providerLogoFromProduct` in BrandAvatar.tsx.
 */
export function marketingLogoPath(logo?: string | null): string | null {
  if (!logo) return null;
  if (logo.endsWith('.png') && !logo.includes('/')) {
    return null;
  }
  return logo;
}

export function providerLogoFromProduct(product?: {
  providerDetails?: { logo?: string | null } | null;
} | null): string | null {
  return marketingLogoPath(product?.providerDetails?.logo);
}
