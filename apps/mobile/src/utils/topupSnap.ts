import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

/**
 * Open Midtrans Snap — prefer in-app browser (expo-web-browser).
 * Fallback Linking if WebBrowser unavailable.
 * Closing the surface ≠ cancel/success; caller must sync-payment.
 * Never embeds server_key / never invents QRIS or VA.
 */
export function buildSnapRedirectUrl(snapToken: string, isProduction: boolean): string {
  const host = isProduction
    ? 'https://app.midtrans.com'
    : 'https://app.sandbox.midtrans.com';
  return `${host}/snap/v4/redirection/${encodeURIComponent(snapToken)}`;
}

export async function openSnapCheckout(opts: {
  redirectUrl?: string | null;
  snapToken?: string | null;
  isProduction?: boolean;
}): Promise<{ opened: boolean; reason?: string; dismissed?: boolean }> {
  const fromApi = opts.redirectUrl?.trim() || '';
  const fromToken = opts.snapToken?.trim()
    ? buildSnapRedirectUrl(opts.snapToken.trim(), !!opts.isProduction)
    : '';
  const url = fromApi || fromToken;
  if (!url) {
    return { opened: false, reason: 'Token pembayaran tidak tersedia.' };
  }

  try {
    // In-app browser sheet — user stays in GurkyPay experience (not Chrome app switch).
    const result = await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      controlsColor: '#0F6A4D',
      toolbarColor: '#FFFFFF',
      showTitle: true,
      enableBarCollapsing: false,
      ...(Platform.OS === 'android'
        ? { createTask: false }
        : {}),
    });
    return {
      opened: true,
      dismissed:
        result.type === 'cancel' ||
        result.type === 'dismiss',
    };
  } catch {
    try {
      await Linking.openURL(url);
      return { opened: true };
    } catch {
      return { opened: false, reason: 'Tidak dapat membuka halaman pembayaran Midtrans.' };
    }
  }
}

/** Customer-facing status — backend status only. */
export function topUpStatusLabel(status: string | null | undefined): string {
  const s = String(status || '').toLowerCase();
  if (s === 'success') return 'Top Up Berhasil';
  if (s === 'expired') return 'Expired';
  if (s === 'failed') return 'Gagal';
  if (s === 'cancelled' || s === 'canceled') return 'Dibatalkan';
  if (s === 'processing' || s === 'pending') return 'Belum Dibayar';
  return status ? String(status) : 'Belum Dibayar';
}

export function isTopUpTerminal(status: string | null | undefined): boolean {
  const s = String(status || '').toLowerCase();
  return ['success', 'failed', 'expired', 'cancelled', 'canceled', 'refunded'].includes(s);
}

export function isTopUpSuccess(status: string | null | undefined): boolean {
  return String(status || '').toLowerCase() === 'success';
}
