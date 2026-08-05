import { API_ORIGIN } from '../services/api';

/**
 * Resolve a media URL for <img src>.
 *
 * Backend MediaResource should already return an absolute API/CDN URL.
 * This helper is a safety net for:
 * - legacy relative "/storage/..." values
 * - disk-relative "folder/file.png" values
 * so the browser never resolves media against the SPA origin by mistake.
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url) {
    return '';
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }

  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `${window.location.protocol}${trimmed}`;
  }

  if (trimmed.startsWith('/storage/')) {
    return `${API_ORIGIN}${trimmed}`;
  }

  if (trimmed.startsWith('storage/')) {
    return `${API_ORIGIN}/${trimmed}`;
  }

  // Disk-relative path (general/uuid.png)
  if (!trimmed.startsWith('/')) {
    return `${API_ORIGIN}/storage/${trimmed}`;
  }

  return `${API_ORIGIN}${trimmed}`;
}
