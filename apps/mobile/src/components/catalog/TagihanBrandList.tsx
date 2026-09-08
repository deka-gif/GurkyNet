import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '../ui';
import { colors, radius, spacing, typography } from '../../theme';
import type { TagihanBrandGroup } from '../../utils/tagihanBrandGrouping';

type Props = {
  brands: TagihanBrandGroup[];
  onPress: (brand: TagihanBrandGroup) => void;
  disabled?: boolean;
};

/**
 * Tagihan-only brand tiles — logo/name, NEVER catalog price.
 * Slice 1: TV Pascabayar uses initials (Provider logo is umbrella — NOT_SAFE).
 */
export function TagihanBrandList({ brands, onPress, disabled }: Props) {
  return (
    <View style={styles.grid}>
      {brands.map((brand) => {
        const initial = brand.label.trim().charAt(0).toUpperCase() || '?';
        return (
          <TouchableOpacity
            key={brand.key}
            style={styles.tile}
            activeOpacity={0.7}
            disabled={disabled}
            onPress={() => onPress(brand)}
          >
            <Card style={[styles.card, disabled && styles.cardDisabled]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <Text style={styles.name} numberOfLines={3}>
                {brand.label}
              </Text>
              {/* Intentionally no formatIDR / product.price / sell_price */}
            </Card>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '47.5%',
    flexGrow: 1,
  },
  card: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  cardDisabled: { opacity: 0.5 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.primary[700],
  },
  name: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
    lineHeight: 18,
  },
});
