import { useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCatalogStore } from '../../src/store/catalog.store';
import { Category, CategoryIconMap } from '../../src/services/catalog.service';
import {
  ScreenContainer,
  LoadingState,
  ErrorState,
  EmptyState,
  CategoryMarketingIcon,
} from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { groupCategoriesForCatalog } from '../../src/config/catalogGrouping';

/**
 * Ionicons fallback by slug — display only; catalog truth remains GET /categories.
 */
const ICON_BY_SLUG: Record<string, keyof typeof Ionicons.glyphMap> = {
  pulsa: 'call-outline',
  data: 'wifi-outline',
  'paket-data': 'wifi-outline',
  'voucher-internet': 'globe-outline',
  'sms-telepon': 'chatbox-outline',
  'masa-aktif': 'refresh-outline',
  'aktivasi-perdana': 'card-outline',
  esim: 'hardware-chip-outline',
  pln: 'flash-outline',
  'token-pln': 'flash-outline',
  'pln-pascabayar': 'flash-outline',
  pdam: 'water-outline',
  'bpjs-kesehatan': 'medkit-outline',
  'bpjs-tk': 'briefcase-outline',
  bpjs: 'medkit-outline',
  'internet-pascabayar': 'wifi-outline',
  'tv-pascabayar': 'tv-outline',
  gas: 'flame-outline',
  pbb: 'home-outline',
  samsat: 'car-outline',
  multifinance: 'card-outline',
  tagihan: 'receipt-outline',
  'topup-digital': 'wallet-outline',
  ewallet: 'wallet-outline',
  'e-money': 'wallet-outline',
  game: 'game-controller-outline',
  'voucher-digital': 'gift-outline',
  voucher: 'gift-outline',
  'langganan-digital': 'play-circle-outline',
  langganan: 'play-circle-outline',
  streaming: 'play-circle-outline',
  international: 'earth-outline',
  transfer: 'swap-horizontal-outline',
};

function iconForSlug(slug: string): keyof typeof Ionicons.glyphMap {
  return ICON_BY_SLUG[slug] ?? 'apps-outline';
}

function resolveMarketingIconPath(iconMap: CategoryIconMap, keys: string[]): string | null {
  for (const key of keys) {
    const path = iconMap[key];
    if (path) return path;
  }
  return null;
}

function CategoryTile({
  cat,
  iconPath,
  onPress,
}: {
  cat: Category;
  iconPath: string | null;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconWrap}>
        <CategoryMarketingIcon
          iconPath={iconPath}
          size={28}
          contentScale={1.15}
          fallback={<Ionicons name={iconForSlug(cat.slug)} size={24} color={colors.primary[600]} />}
        />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {cat.name}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Full catalog opened from Home "Lainnya" (hidden Transaksi tab).
 * Groups match Web hub IA — presentation only over GET /categories.
 */
export default function TransaksiScreen() {
  const router = useRouter();
  const {
    categories,
    categoriesLoading,
    categoriesError,
    fetchCategories,
    categoryIcons,
    fetchCategoryIcons,
  } = useCatalogStore();

  useEffect(() => {
    fetchCategories();
    fetchCategoryIcons();
  }, [fetchCategories, fetchCategoryIcons]);

  const sections = groupCategoriesForCatalog(categories);

  const openCategory = (cat: Category) => {
    router.push({ pathname: '/produk/[slug]', params: { slug: cat.slug, name: cat.name } });
  };

  const onRefresh = async () => {
    await Promise.all([fetchCategories(), fetchCategoryIcons()]);
  };

  return (
    <ScreenContainer onRefresh={onRefresh} refreshing={categoriesLoading}>
      <View style={styles.header}>
        <Text style={styles.title}>Semua Layanan</Text>
        <Text style={styles.subtitle}>Pilih kategori sesuai kebutuhan.</Text>
      </View>

      {categoriesLoading && categories.length === 0 ? (
        <LoadingState label="Memuat kategori..." />
      ) : categoriesError && categories.length === 0 ? (
        <ErrorState message={categoriesError} onRetry={onRefresh} />
      ) : categories.length === 0 ? (
        <EmptyState title="Belum Ada Kategori" message="Kategori produk belum tersedia saat ini." />
      ) : (
        <View style={styles.sections}>
          {sections.map((section) => (
            <View key={section.id} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionRule} />
              <View style={styles.grid}>
                {section.categories.map((cat) => (
                  <CategoryTile
                    key={cat.id}
                    cat={cat}
                    iconPath={resolveMarketingIconPath(categoryIcons, section.iconKeysForSlug(cat.slug))}
                    onPress={() => openCategory(cat)}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.black, color: colors.gray[900] },
  subtitle: { fontSize: typography.size.sm, color: colors.gray[500], marginTop: 2 },
  sections: { gap: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[800],
    letterSpacing: 0.2,
  },
  sectionRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray[200],
    marginBottom: spacing.xs,
  },
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
