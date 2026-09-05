import { useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCatalogStore } from '../../src/store/catalog.store';
import { ScreenContainer, LoadingState, ErrorState, EmptyState } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

/**
 * The API only returns a category `icon` as a string name (not guaranteed to match an
 * Ionicons glyph), so this is a display fallback keyed by slug — not a source of catalog
 * truth. An unmapped category still renders (generic icon), it's never hidden.
 */
const ICON_BY_SLUG: Record<string, keyof typeof Ionicons.glyphMap> = {
  pulsa: 'call',
  data: 'wifi',
  'voucher-internet': 'globe',
  'sms-telepon': 'chatbox',
  'masa-aktif': 'refresh',
  'aktivasi-perdana': 'card',
  esim: 'hardware-chip',
  pln: 'flash',
  'pln-pascabayar': 'flash',
  pdam: 'water',
  'bpjs-kesehatan': 'medkit',
  'bpjs-tk': 'briefcase',
  'internet-pascabayar': 'wifi',
  'tv-pascabayar': 'tv',
  gas: 'flame',
  pbb: 'home',
  samsat: 'car',
  multifinance: 'card',
  tagihan: 'receipt',
  'topup-digital': 'wallet',
  ewallet: 'wallet',
  game: 'game-controller',
  'voucher-digital': 'gift',
  voucher: 'gift',
  'langganan-digital': 'tv',
  international: 'earth',
  transfer: 'swap-horizontal',
};

function iconForSlug(slug: string): keyof typeof Ionicons.glyphMap {
  return ICON_BY_SLUG[slug] ?? 'apps';
}

export default function TransaksiScreen() {
  const router = useRouter();
  const { categories, categoriesLoading, categoriesError, fetchCategories } = useCatalogStore();

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return (
    <ScreenContainer onRefresh={fetchCategories} refreshing={categoriesLoading}>
      <View>
        <Text style={styles.title}>Katalog Produk</Text>
        <Text style={styles.subtitle}>Pilih kategori untuk melihat daftar produk.</Text>
      </View>

      {categoriesLoading && categories.length === 0 ? (
        <LoadingState label="Memuat kategori..." />
      ) : categoriesError && categories.length === 0 ? (
        <ErrorState message={categoriesError} onRetry={fetchCategories} />
      ) : categories.length === 0 ? (
        <EmptyState title="Belum Ada Kategori" message="Kategori produk belum tersedia saat ini." />
      ) : (
        <View style={styles.grid}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={styles.item}
              onPress={() =>
                router.push({ pathname: '/produk/[slug]', params: { slug: cat.slug, name: cat.name } })
              }
            >
              <View style={styles.iconWrap}>
                <Ionicons name={iconForSlug(cat.slug)} size={24} color={colors.primary[600]} />
              </View>
              <Text style={styles.label} numberOfLines={2}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.black, color: colors.gray[900] },
  subtitle: { fontSize: typography.size.sm, color: colors.gray[500], marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  item: { width: '30%', alignItems: 'center', gap: spacing.xs },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.size.xs,
    color: colors.gray[700],
    textAlign: 'center',
    fontWeight: typography.weight.medium,
  },
});
