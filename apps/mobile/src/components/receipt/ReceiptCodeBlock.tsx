import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button, Card } from '../ui';
import { colors, radius, spacing, typography } from '../../theme';
import type { ReceiptDeliverableItem } from '../../utils/receiptDeliverable';

type Props = {
  items: ReceiptDeliverableItem[];
  /** Optional footer line under all codes (e.g. "Kode tersimpan di Riwayat"). */
  footerHint?: string | null;
};

/**
 * Prominent redeem-code block for checkout result + riwayat detail.
 * Codes are bold / larger than normal receipt rows; copy uses exact copyValue.
 */
export function ReceiptCodeBlock({ items, footerHint }: Props) {
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  if (!items.length) return null;

  const copy = async (item: ReceiptDeliverableItem) => {
    try {
      await Clipboard.setStringAsync(item.copyValue);
      setCopyMsg(`${item.label} disalin.`);
    } catch {
      setCopyMsg('Gagal menyalin kode.');
    }
  };

  return (
    <Card style={styles.card}>
      {items.map((item, index) => (
        <View
          key={item.key}
          style={[styles.block, index > 0 ? styles.blockDivider : null]}
        >
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.code} selectable>
            {item.value}
          </Text>
          <Button label="Salin Kode" onPress={() => void copy(item)} />
          {item.hint ? <Text style={styles.hint}>{item.hint}</Text> : null}
        </View>
      ))}
      {copyMsg ? <Text style={styles.copyMsg}>{copyMsg}</Text> : null}
      {footerHint ? <Text style={styles.footer}>{footerHint}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, alignItems: 'stretch' },
  block: { gap: spacing.sm },
  blockDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[200],
    paddingTop: spacing.md,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  /** Intentionally larger + blacker than receiptValue / detailValue elsewhere. */
  code: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
    letterSpacing: 1.2,
    lineHeight: 32,
  },
  hint: {
    fontSize: typography.size.xs,
    color: '#92400E',
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    lineHeight: 18,
    overflow: 'hidden',
  },
  copyMsg: {
    fontSize: typography.size.xs,
    color: colors.status.success,
    fontWeight: typography.weight.medium,
  },
  footer: { fontSize: typography.size.xs, color: colors.gray[500] },
});
