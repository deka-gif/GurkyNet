import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { Button } from './Button';

/**
 * Every screen must have loading/empty/error states (spec section 33) — "Jangan ada
 * halaman putih kosong ketika API gagal." These three cover that contract everywhere.
 */
export function LoadingState({ label = 'Memuat...' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary[600]} />
      <Text style={styles.mutedText}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>Terjadi Kesalahan</Text>
      <Text style={styles.mutedText}>{message}</Text>
      {onRetry && (
        <View style={styles.retryButton}>
          <Button label="Coba Lagi" onPress={onRetry} variant="secondary" fullWidth={false} />
        </View>
      )}
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>{title}</Text>
      {message && <Text style={styles.mutedText}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  mutedText: {
    fontSize: typography.size.base,
    color: colors.gray[500],
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[800],
    textAlign: 'center',
  },
  retryButton: { marginTop: spacing.sm },
});
