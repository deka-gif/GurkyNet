import { useMemo } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';
import { Card } from '../ui';
import type { Product } from '../../services/catalog.service';
import { sortProductsByPriceAsc } from '../../utils/sortProductsByPrice';
import { formatIDR } from '../../utils/currency';
import { colors, spacing, typography } from '../../theme';

type Props = {
  products: Product[];
  /** Default 2. Game products → 3 (falls back to 2 on narrow screens). Legacy 5 kept for callers. */
  columns?: 2 | 3 | 5;
  onPress: (product: Product) => void;
  /** When true, tile is not pressable. */
  isDisabled?: (product: Product) => boolean;
  /** Optional selected highlight (e.g. PLN). */
  selectedCode?: string | null;
  /** Extra line under name (quota, zona, status). */
  renderMeta?: (product: Product) => ReactNode;
  /** Presentation-only label; defaults to product.name. Does not mutate product. */
  getDisplayName?: (product: Product) => string;
  style?: ViewStyle;
  getKey?: (product: Product) => string;
};

function resolveColumns(requested: 2 | 3 | 5): 2 | 3 | 5 {
  if (requested !== 3) return requested;
  const width = Dimensions.get('window').width;
  // Narrow phones: 3 cols become unreadable — fall back to 2.
  return width < 360 ? 2 : 3;
}

/**
 * Shared product nominal grid — price-asc.
 * Uses flex-start + gap (NOT space-between) so 2 items fill col1+col2, never col1+col3.
 * 3-col (Game): square corners, equal tiles, content centered.
 */
export function ProductCatalogGrid({
  products,
  columns = 2,
  onPress,
  isDisabled,
  selectedCode,
  renderMeta,
  getDisplayName,
  style,
  getKey,
}: Props) {
  const sorted = useMemo(() => sortProductsByPriceAsc(products), [products]);
  const cols = resolveColumns(columns);
  const tileStyle =
    cols === 5 ? styles.tile5 : cols === 3 ? styles.tile3 : styles.tile2;
  // Keep square+centered Game look even when narrow screen falls back to 2 cols.
  const isGameGrid = columns === 3;

  return (
    <View style={[styles.grid, style]}>
      {sorted.map((product) => {
        const disabled = isDisabled?.(product) ?? false;
        const active = selectedCode != null && selectedCode === product.code;
        const label = getDisplayName?.(product) ?? product.name;
        return (
          <TouchableOpacity
            key={getKey?.(product) ?? String(product.id)}
            style={tileStyle}
            activeOpacity={0.7}
            disabled={disabled}
            onPress={() => onPress(product)}
          >
            <Card
              style={[
                styles.card,
                isGameGrid && styles.cardGame,
                cols === 5 && styles.cardCompact,
                active && styles.cardActive,
                disabled && styles.cardDisabled,
              ]}
            >
              <Text
                style={[
                  styles.name,
                  isGameGrid && styles.nameGame,
                  cols === 5 && styles.nameCompact,
                ]}
                numberOfLines={2}
              >
                {label}
              </Text>
              {renderMeta?.(product)}
              <Text
                style={[
                  styles.price,
                  isGameGrid && styles.priceGame,
                  cols === 5 && styles.priceCompact,
                ]}
              >
                {formatIDR(product.price)}
              </Text>
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
    justifyContent: 'flex-start',
    alignContent: 'flex-start',
    gap: spacing.sm,
  },
  // Fixed column widths leave room for gap so items pack L→R (not space-between).
  tile2: {
    width: '48%',
  },
  tile3: {
    width: '31.5%',
  },
  tile5: {
    width: '18%',
  },
  card: {
    padding: spacing.md,
    minHeight: 72,
    justifyContent: 'flex-start',
    gap: 2,
  },
  /** Game voucher tiles: square corners, centered, uniform height. */
  cardGame: {
    borderRadius: 0,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    minHeight: 76,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    shadowOpacity: 0,
    elevation: 0,
    borderColor: colors.gray[200],
  },
  cardCompact: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 70,
    gap: 2,
  },
  cardActive: {
    borderWidth: 1.5,
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  cardDisabled: {
    opacity: 0.55,
  },
  name: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    lineHeight: 15,
  },
  nameGame: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    width: '100%',
  },
  nameCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  price: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
    marginTop: 2,
  },
  priceGame: {
    fontSize: 11,
    marginTop: 0,
    textAlign: 'center',
    width: '100%',
  },
  priceCompact: {
    fontSize: 11,
    marginTop: 2,
  },
});
