import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { TransactionStatus } from '../../api/types';

/**
 * Backend is the sole authority on status (spec section 11) — this component only ever
 * renders whatever status string the API actually returned normalized to lowercase, it
 * never infers SUCCESS from "the HTTP request succeeded."
 */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  success: { label: 'Berhasil', color: colors.status.success, bg: colors.status.successBg },
  pending: { label: 'Tertunda', color: colors.status.pending, bg: colors.status.pendingBg },
  processing: { label: 'Diproses', color: colors.status.pending, bg: colors.status.pendingBg },
  failed: { label: 'Gagal', color: colors.status.failed, bg: colors.status.failedBg },
  expired: { label: 'Kedaluwarsa', color: colors.gray[600], bg: colors.gray[100] },
  cancelled: { label: 'Dibatalkan', color: colors.gray[600], bg: colors.gray[100] },
  refunded: { label: 'Dana Kembali', color: colors.primary[600], bg: colors.primary[50] },
};

export function StatusBadge({ status }: { status: TransactionStatus | string }) {
  const config = STATUS_CONFIG[String(status).toLowerCase()] ?? {
    label: String(status),
    color: colors.gray[600],
    bg: colors.gray[100],
  };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

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
