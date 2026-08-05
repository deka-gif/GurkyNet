import { API_ORIGIN } from '../services/api';

/**
 * Resolve a media URL for <img src>.
 *
 * Backend MediaResource should already return an absolute API/CDN URL under
 * /api/v1/public/media/... (SPA hosts often serve index.html for /storage/*).
 *
 * This helper is a safety net for:
 * - legacy "/storage/..." values (absolute or relative)
 * - disk-relative "folder/file.png" values
 * - relative "/api/v1/public/media/..." values
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url) {
    return '';
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }

  if (/^(data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `${window.location.protocol}${trimmed}`;
  }

  // Rewrite classic /storage/ URLs to the API media stream (SPA catch-all safe).
  const storageMatch = trimmed.match(/^(?:https?:\/\/[^/]+)?\/storage\/(.+)$/i);
  if (storageMatch) {
    return `${API_ORIGIN}/api/v1/public/media/${storageMatch[1]}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/api/v1/public/media/')) {
    return `${API_ORIGIN}${trimmed}`;
  }

  if (trimmed.startsWith('storage/')) {
    return `${API_ORIGIN}/api/v1/public/media/${trimmed.slice('storage/'.length)}`;
  }

  // Disk-relative path (general/uuid.png)
  if (!trimmed.startsWith('/')) {
    return `${API_ORIGIN}/api/v1/public/media/${trimmed}`;
  }

  return `${API_ORIGIN}${trimmed}`;
}

/** Accept string URL or Media-like object from API resources. */
export function resolveMediaSrc(value?: string | { url?: string | null } | null): string {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return resolveMediaUrl(value);
  }
  return resolveMediaUrl(value.url);
}
