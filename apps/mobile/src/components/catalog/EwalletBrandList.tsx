import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandLogo, EmptyState, ErrorState, LoadingState } from '../ui';
import { catalogService } from '../../services/catalog.service';
import {
  EwalletBrandGroup,
  groupEwalletProviders,
} from '../../utils/ewalletBrand';
import { parseApiError } from '../../api/client';
import { colors, radius, spacing, typography } from '../../theme';

const CATEGORY = 'topup-digital';

type Props = {
  /** Row subtitle, e.g. (name) => `Transfer ke ${name}` or `Top up ${name}` */
  subtitleFor?: (brandName: string) => string;
  onSelect: (brand: EwalletBrandGroup) => void;
};

/**
 * Deduped E-Wallet brand list from GET /products/providers.
 * No product counts / SKUs — brands only (Transfer + Layanan shared).
 */
export function EwalletBrandList({
  subtitleFor = (name) => `Transfer ke ${name}`,
  onSelect,
}: Props) {
  const [brands, setBrands] = useState<EwalletBrandGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBrands = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogService.getCategoryProviders(CATEGORY);
      if (res.success && Array.isArray(res.data)) {
        setBrands(groupEwalletProviders(res.data));
      } else {
        setBrands([]);
        setError(res.message || 'Gagal memuat daftar E-Wallet.');
      }
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      setBrands([]);
      setError(parsed.message || 'Gagal memuat daftar E-Wallet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBrands();
  }, [loadBrands]);

  if (loading && brands.length === 0) {
    return <LoadingState label="Memuat E-Wallet..." />;
  }
  if (error && brands.length === 0) {
    return <ErrorState message={error} onRetry={loadBrands} />;
  }
  if (brands.length === 0) {
    return (
      <EmptyState
        title="Belum Ada E-Wallet"
        message="Brand E-Wallet belum tersedia di katalog."
      />
    );
  }

  return (
    <View style={styles.list}>
      {brands.map((brand) => (
        <Pressable
          key={brand.key}
          accessibilityRole="button"
          accessibilityLabel={subtitleFor(brand.name)}
          onPress={() => onSelect(brand)}
          style={({ pressed }) => [styles.row, styles.rowActive, pressed && styles.pressed]}
        >
          <BrandLogo name={brand.name} logo={brand.logo} size={44} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{brand.name}</Text>
            <Text style={styles.rowSub}>{subtitleFor(brand.name)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.gray[400]} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  rowActive: {
    borderColor: colors.primary[100],
  },
  pressed: {
    opacity: 0.92,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  rowSub: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
  },
});
