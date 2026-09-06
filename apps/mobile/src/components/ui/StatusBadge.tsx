import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { TransactionStatus } from '../../api/types';
import { historyStatusLabel } from '../../utils/transactionStatus';

/**
 * Backend is the sole authority on status (spec section 11).
 * Optional Top Up context → "Belum Dibayar" instead of generic Tertunda.
 */
export function StatusBadge({
  status,
  serviceName,
  paymentMethod,
  transactionCode,
}: {
  status: TransactionStatus | string;
  serviceName?: string | null;
  paymentMethod?: string | null;
  transactionCode?: string | null;
}) {
  const label = historyStatusLabel(status, {
    serviceName,
    paymentMethod,
    transactionCode,
  });
  const key = String(status).toLowerCase();
  const palette =
    STATUS_COLORS[key] ??
    (label === 'Belum Dibayar'
      ? STATUS_COLORS.pending
      : { color: colors.gray[600], bg: colors.gray[100] });

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  success: { color: colors.status.success, bg: colors.status.successBg },
  pending: { color: colors.status.pending, bg: colors.status.pendingBg },
  processing: { color: colors.status.pending, bg: colors.status.pendingBg },
  failed: { color: colors.status.failed, bg: colors.status.failedBg },
  expired: { color: colors.gray[600], bg: colors.gray[100] },
  cancelled: { color: colors.gray[600], bg: colors.gray[100] },
  canceled: { color: colors.gray[600], bg: colors.gray[100] },
  refunded: { color: colors.primary[600], bg: colors.primary[50] },
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
  },
});
