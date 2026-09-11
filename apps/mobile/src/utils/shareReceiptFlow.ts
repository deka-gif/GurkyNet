import { Share, Platform } from 'react-native';
import type { ReceiptData } from '../services/transaction.service';
import {
  receiptSettingsService,
  type PaperWidthMm,
} from '../services/receiptSettings.service';
import {
  buildReceiptLines,
  receiptLinesToPreviewText,
  type ReceiptLine,
} from './receiptPrint';

export type LiveReceiptDocument = {
  lines: ReceiptLine[];
  paperWidthMm: PaperWidthMm;
  text: string;
};

/**
 * Compose printable receipt using LIVE store profile + template for the
 * active user. Never snapshots profile onto the transaction.
 */
export async function composeLiveReceiptDocument(
  receipt: ReceiptData,
  userName?: string | null
): Promise<LiveReceiptDocument> {
  const [store, template, prefs] = await Promise.all([
    receiptSettingsService.getStoreProfile(),
    receiptSettingsService.getReceiptTemplate(),
    receiptSettingsService.getPrinterPreferences(),
  ]);
  const lines = buildReceiptLines({
    receipt,
    store,
    template,
    userName,
    paperWidthMm: prefs.paperWidthMm,
    sample: false,
  });
  return {
    lines,
    paperWidthMm: prefs.paperWidthMm,
    text: receiptLinesToPreviewText(lines),
  };
}

export async function composeLiveReceiptText(
  receipt: ReceiptData,
  userName?: string | null
): Promise<string> {
  const doc = await composeLiveReceiptDocument(receipt, userName);
  return doc.text;
}

export type ShareReceiptResult = 'shared' | 'dismissed' | 'unavailable' | 'failed';

/**
 * Native share sheet — independent of Bluetooth printer.
 * Does not claim success when the user dismisses the sheet (iOS).
 */
export async function shareReceiptMessage(message: string): Promise<ShareReceiptResult> {
  const text = message.trim();
  if (!text) return 'unavailable';
  try {
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { message: text }
        : { message: text, title: 'Struk Transaksi' }
    );
    if (result.action === Share.sharedAction) return 'shared';
    if (result.action === Share.dismissedAction) return 'dismissed';
    return 'dismissed';
  } catch {
    return 'failed';
  }
}
