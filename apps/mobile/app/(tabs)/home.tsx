import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWalletStore } from '../../src/store/wallet.store';
import { useAuthStore } from '../../src/store/auth.store';
import { useCatalogStore } from '../../src/store/catalog.store';
import { useBannerStore } from '../../src/store/banner.store';
import { useWebsiteStore } from '../../src/store/website.store';
import { Category, CategoryIconMap } from '../../src/services/catalog.service';
import {
  ScreenContainer,
  LoadingState,
  ErrorState,
  StatusBadge,
  CategoryMarketingIcon,
  PromoBannerCarousel,
  PlatformLogo,
} from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';
import { formatDateTime } from '../../src/utils/date';

/**
 * Home "Layanan" shortcuts (exactly 8 = 4×2). Slug candidates map to existing
 * backend catalog categories — never invent business categories. "Lainnya" opens
 * the full catalog screen (existing Transaksi tab), not a fake category.
 *
 * iconKeys mirror web Marketing keys (`hub:{id}` / `sub:{hubId}:{childKey}`) from
 * laravel/config/category_icon_keys.php — NOT product category slugs.
 */
type ServiceShortcut = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Candidate catalog slugs in preference order; empty = "Lainnya" full catalog. */
  slugCandidates: string[];
  /** Marketing category-icon keys in preference order (empty = keep Ionicons). */
  iconKeys: string[];
};

const SERVICE_SHORTCUTS: ServiceShortcut[] = [
  {
    key: 'pulsa',
    label: 'Pulsa',
    icon: 'call-outline',
    slugCandidates: ['pulsa'],
    iconKeys: ['sub:telco:pulsa'],
  },
  {
    key: 'paket-data',
    label: 'Paket Data',
    icon: 'wifi-outline',
    slugCandidates: ['data', 'paket-data'],
    iconKeys: ['sub:telco:data'],
  },
  {
    key: 'voucher-internet',
    label: 'Voucher Internet',
    icon: 'globe-outline',
    slugCandidates: ['voucher-internet'],
    iconKeys: ['sub:telco:voucher-internet'],
  },
  {
    key: 'pln',
    label: 'PLN',
    icon: 'flash-outline',
    slugCandidates: ['pln', 'token-pln'],
    iconKeys: ['sub:tagihan:pln'],
  },
  {
    key: 'e-money',
    label: 'E-Money',
    icon: 'wallet-outline',
    slugCandidates: ['topup-digital', 'ewallet', 'e-money'],
    iconKeys: ['hub:topup-digital'],
  },
  {
    key: 'game',
    label: 'Game',
    icon: 'game-controller-outline',
    slugCandidates: ['game'],
    iconKeys: ['hub:game'],
  },
  {
    key: 'streaming',
    label: 'Streaming',
    icon: 'play-circle-outline',
    slugCandidates: ['langganan-digital', 'langganan', 'streaming'],
    iconKeys: ['hub:langganan'],
  },
  {
    key: 'lainnya',
    label: 'Lainnya',
    icon: 'grid-outline',
    slugCandidates: [],
    iconKeys: [],
  },
];

function resolveCategory(categories: Category[], candidates: string[]): Category | null {
  for (const slug of candidates) {
    const hit = categories.find((c) => c.slug === slug);
    if (hit) return hit;
  }
  return null;
}

function resolveMarketingIconPath(iconMap: CategoryIconMap, keys: string[]): string | null {
  for (const key of keys) {
    const path = iconMap[key];
    if (path) return path;
  }
  return null;
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { overview, loading, error, fetchWallet } = useWalletStore();
  const { categories, fetchCategories, categoryIcons, fetchCategoryIcons } = useCatalogStore();
  const { banners, fetchBanners } = useBannerStore();
  const { logo: platformLogo, fetchSettings } = useWebsiteStore();
  const firstName = user?.name?.split(' ')[0] || 'Kasir';

  useEffect(() => {
    fetchWallet();
    fetchCategories();
    fetchCategoryIcons();
    fetchBanners();
    fetchSettings();
  }, [fetchWallet, fetchCategories, fetchCategoryIcons, fetchBanners, fetchSettings]);

  // Refresh balance every time Home regains focus (e.g. returning from a purchase) —
  // spec section 34: refresh wallet after anything that could have changed it.
  useFocusEffect(
    useCallback(() => {
      fetchWallet();
      fetchBanners();
    }, [fetchWallet, fetchBanners])
  );

  const openService = (shortcut: ServiceShortcut) => {
    if (shortcut.slugCandidates.length === 0) {
      router.push('/(tabs)/transaksi');
      return;
    }
    const matched = resolveCategory(categories, shortcut.slugCandidates);
    const slug = matched?.slug || shortcut.slugCandidates[0];
    const name = matched?.name || shortcut.label;
    // Same route for all shortcuts — inquiry categories are blocked inside
    // /produk/[slug] (preparation notice), not by removing Home tiles.
    router.push({ pathname: '/produk/[slug]', params: { slug, name } });
  };

  return (
    <ScreenContainer
      onRefresh={async () => {
        await Promise.all([fetchWallet(), fetchBanners()]);
      }}
      refreshing={loading}
    >
      {/* 1. HEADER — compact left brand group; padding from ScreenContainer only */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <PlatformLogo logo={platformLogo} height={36} contentScale={1.2} style={styles.headerLogo} />
          <View style={styles.headerText}>
            <Text style={styles.greeting} numberOfLines={1}>
              Halo, {firstName}
            </Text>
            <Text style={styles.greetingSub} numberOfLines={1}>
              Siap melayani transaksi hari ini
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buka akun"
          onPress={() => router.push('/(tabs)/akun')}
          style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons name="person-circle-outline" size={28} color={colors.gray[700]} />
        </Pressable>
      </View>

      {loading && !overview ? (
        <LoadingState label="Memuat saldo..." />
      ) : error && !overview ? (
        <ErrorState message={error} onRetry={fetchWallet} />
      ) : (
        <>
          {/* 2. WALLET CARD */}
          <View style={styles.walletCard}>
            <View style={styles.walletAccent} />
            <View style={styles.walletBody}>
              <View style={styles.walletTopRow}>
                <View style={styles.walletLabelBlock}>
                  <Text style={styles.walletLabel}>Saldo GurkyPay</Text>
                  <Text style={styles.walletAmount}>{formatIDR(overview?.wallet.balance)}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Top Up"
                  onPress={() => {}}
                  disabled
                  style={styles.topUpButton}
                >
                  <Ionicons name="add" size={16} color={colors.primary[700]} />
                  <Text style={styles.topUpLabel}>Top Up</Text>
                </Pressable>
              </View>
              <Text style={styles.walletNo}>
                {overview?.wallet.walletNo || overview?.wallet.wallet_number || '-'}
              </Text>
            </View>
          </View>

          {/* 3. FINANCIAL SUMMARY — compact strip */}
          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Pemasukan</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {formatIDR(overview?.summary.income_this_month)}
              </Text>
              <Text style={styles.summaryHint}>bulan ini</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Pengeluaran</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {formatIDR(overview?.summary.expense_this_month)}
              </Text>
              <Text style={styles.summaryHint}>bulan ini</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Mutasi</Text>
              <Text style={styles.summaryValue}>{overview?.summary.transaction_count ?? 0}</Text>
              <Text style={styles.summaryHint}>tercatat</Text>
            </View>
          </View>

          {/* 3b. BANNER PROMO — Marketing CMS (GET /public/banners), same source as web */}
          {banners.length > 0 ? <PromoBannerCarousel banners={banners} /> : null}

          {/* 4. LAYANAN — fixed 4×2 grid */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Layanan</Text>
            <View style={styles.categoryGrid}>
              {SERVICE_SHORTCUTS.map((cat) => {
                const marketingPath = resolveMarketingIconPath(categoryIcons, cat.iconKeys);
                const hasMarketingIcon = Boolean(marketingPath);
                return (
                  <Pressable
                    key={cat.key}
                    accessibilityRole="button"
                    accessibilityLabel={cat.label}
                    onPress={() => openService(cat)}
                    style={({ pressed }) => [styles.categoryItem, pressed && styles.pressed]}
                  >
                    <View
                      style={[
                        styles.categoryIconWrap,
                        hasMarketingIcon ? styles.categoryIconWrapClear : styles.categoryIconWrapFallback,
                      ]}
                    >
                      <CategoryMarketingIcon
                        iconPath={marketingPath}
                        size={40}
                        contentScale={1.24}
                        fallback={
                          <Ionicons name={cat.icon} size={26} color={colors.primary[600]} />
                        }
                      />
                    </View>
                    <Text style={styles.categoryLabel} numberOfLines={2}>
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 5. AKTIVITAS TERBARU */}
          <View style={[styles.section, styles.sectionLast]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleInline}>Aktivitas Terbaru</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Lihat semua aktivitas"
                onPress={() => router.push('/(tabs)/riwayat')}
                hitSlop={8}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Text style={styles.seeAll}>Lihat Semua</Text>
              </Pressable>
            </View>

            {!overview?.recent_transactions?.length ? (
              <View style={styles.emptyBox}>
                <Ionicons name="time-outline" size={22} color={colors.gray[400]} />
                <Text style={styles.emptyText}>Belum ada aktivitas.</Text>
              </View>
            ) : (
              <View style={styles.activityList}>
                {overview.recent_transactions.slice(0, 8).map((mutation, index, arr) => {
                  const isCredit = mutation.direction === 'credit';
                  const title =
                    mutation.service_name ||
                    mutation.description ||
                    (isCredit ? 'Kredit Saldo' : 'Debit Saldo');
                  const isLast = index === arr.length - 1;
                  return (
                    <View
                      key={mutation.id}
                      style={[styles.activityRow, !isLast && styles.activityRowBorder]}
                    >
                      <View
                        style={[
                          styles.activityIcon,
                          isCredit ? styles.activityIconCredit : styles.activityIconDebit,
                        ]}
                      >
                        <Ionicons
                          name={isCredit ? 'arrow-down' : 'arrow-up'}
                          size={14}
                          color={isCredit ? colors.primary[600] : colors.gray[600]}
                        />
                      </View>
                      <View style={styles.activityInfo}>
                        <Text style={styles.activityName} numberOfLines={1}>
                          {title}
                        </Text>
                        <Text style={styles.activityMeta} numberOfLines={1}>
                          {formatDateTime(mutation.created_at)}
                        </Text>
                      </View>
                      <View style={styles.activityRight}>
                        <Text
                          style={[
                            styles.activityAmount,
                            isCredit && styles.activityAmountCredit,
                          ]}
                        >
                          {isCredit ? '+' : '−'}
                          {formatIDR(mutation.amount)}
                        </Text>
                        {mutation.status ? <StatusBadge status={mutation.status} /> : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}

      {/* Clearance so last content is not covered by bottom tabs */}
      <View style={styles.tabClearance} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    // No extra horizontal padding — ScreenContainer already applies spacing.lg.
  },
  headerLeft: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  headerLogo: {
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 18,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    letterSpacing: -0.2,
  },
  greetingSub: {
    fontSize: 12,
    color: colors.gray[500],
    marginTop: 1,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
    flexShrink: 0,
  },

  walletCard: {
    backgroundColor: colors.primary[700],
    borderRadius: radius.xl,
    overflow: 'hidden',
    minHeight: 0,
  },
  walletAccent: {
    position: 'absolute',
    right: -24,
    top: -28,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary[500],
    opacity: 0.22,
  },
  walletBody: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  walletTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  walletLabelBlock: { flex: 1, minWidth: 0 },
  walletLabel: {
    color: colors.primary[100],
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    letterSpacing: 0.2,
  },
  walletAmount: {
    color: colors.white,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.black,
    marginTop: spacing.xs,
    letterSpacing: -0.5,
  },
  walletNo: {
    color: colors.primary[200],
    fontSize: typography.size.xs,
  },
  topUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    minHeight: 36,
    opacity: 0.95,
  },
  topUpLabel: {
    color: colors.primary[700],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },

  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray[200],
    marginVertical: 2,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.gray[500],
    fontWeight: typography.weight.medium,
  },
  summaryValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
  },
  summaryHint: {
    fontSize: 10,
    color: colors.gray[400],
  },

  section: { gap: spacing.md },
  sectionLast: { marginBottom: 0 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  sectionTitleInline: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    flex: 1,
  },
  seeAll: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[600],
  },

  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
  },
  categoryItem: {
    width: '25%',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 2,
    minHeight: 88,
  },
  categoryIconWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Marketing PNG floats on Home background — no white card. */
  categoryIconWrapClear: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  /** Ionicons fallback keeps a soft tinted disc for touch affordance. */
  categoryIconWrapFallback: {
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
  },
  categoryLabel: {
    fontSize: 11,
    color: colors.gray[700],
    textAlign: 'center',
    fontWeight: typography.weight.medium,
    lineHeight: 14,
  },

  activityList: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    minHeight: 64,
  },
  activityRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIconCredit: { backgroundColor: colors.primary[50] },
  activityIconDebit: { backgroundColor: colors.gray[100] },
  activityInfo: { flex: 1, minWidth: 0, gap: 2 },
  activityName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  activityMeta: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
  },
  activityRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    maxWidth: '42%',
  },
  activityAmount: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  activityAmountCredit: { color: colors.primary[600] },

  emptyBox: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderStyle: 'dashed',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.gray[500],
    fontSize: typography.size.sm,
    textAlign: 'center',
  },

  tabClearance: { height: spacing.md },
});
