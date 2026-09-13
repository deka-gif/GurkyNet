import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../../theme';

type Props = {
  visible: boolean;
  loading?: boolean;
  onPress: () => void;
  style?: ViewStyle;
};

/**
 * Same visual pattern as Wallet ledger / Riwayat "Muat lebih banyak"
 * (apps/mobile/app/(tabs)/wallet.tsx & riwayat.tsx).
 */
export function CatalogLoadMoreButton({ visible, loading, onPress, style }: Props) {
  if (!visible && !loading) return null;
  if (loading) {
    return (
      <ActivityIndicator
        color={colors.primary[600]}
        style={[{ marginVertical: spacing.md }, style]}
      />
    );
  }
  return (
    <Pressable onPress={onPress} style={[styles.loadMoreBtn, style]}>
      <Text style={styles.loadMoreText}>Muat lebih banyak</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loadMoreBtn: { alignItems: 'center', paddingVertical: spacing.md },
  loadMoreText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[600],
  },
});
