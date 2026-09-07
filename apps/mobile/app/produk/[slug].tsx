import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCatalogStore } from '../../src/store/catalog.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../src/store/features.store';
import {
  ScreenContainer,
  LoadingState,
  ErrorState,
  EmptyState,
  PurchaseFlowNotice,
} from '../../src/components/ui';
import { PulsaCatalogFlow } from '../../src/components/catalog/PulsaCatalogFlow';
import { PaketDataCatalogFlow } from '../../src/components/catalog/PaketDataCatalogFlow';
import { PlnTokenCatalogFlow } from '../../src/components/catalog/PlnTokenCatalogFlow';
import { VoucherInternetHubFlow } from '../../src/components/catalog/VoucherInternetHubFlow';
import { ProviderCatalogBrowseFlow } from '../../src/components/catalog/ProviderCatalogBrowseFlow';
import { GameCatalogFlow } from '../../src/components/catalog/GameCatalogFlow';
import { LanggananCatalogFlow } from '../../src/components/catalog/LanggananCatalogFlow';
import { ProductCatalogGrid } from '../../src/components/catalog/ProductCatalogGrid';
import { EwalletBrandList } from '../../src/components/catalog/EwalletBrandList';
import { useEwalletTransferStore } from '../../src/store/ewalletTransfer.store';
import { EwalletBrandGroup } from '../../src/utils/ewalletBrand';
import { colors, radius, spacing, typography } from '../../src/theme';
import {
  INQUIRY_FLOW_NOTICE,
  isGameCategory,
  isInquiryRequiredCategory,
  isLanggananCategory,
  isPlnPrepaidCategory,
  isProviderBrowseCategory,
  isVoucherInternetCategory,
  normalizeCategorySlug,
  resolveProviderBrowseCategory,
} from '../../src/utils/purchaseCategory';
import { sortProductsByPriceAsc } from '../../src/utils/sortProductsByPrice';

/**
 * Category product entry — dedicated flows for pulsa/data/pln/game/langganan;
 * E-Wallet brand list; generic list otherwise.
 * Inquiry gate is purchase-only (detail/checkout) for categories without a dedicated flow.
 *
 * Category name is shown only in Stack header (← [Nama]) — not duplicated in content.
 */

function browseSearchPlaceholder(canonical: string): string {
  if (canonical === 'game') return 'Ketik nama game yang ingin Anda top up...';
  if (canonical === 'langganan-digital') return 'Ketik nama aplikasi streaming atau produktivitas...';
  if (canonical === 'topup-digital') return 'Cari e-wallet...';
  return 'Cari provider...';
}

export default function ProductListScreen() {
  const params = useLocalSearchParams<{ slug: string; name?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const categoryName = typeof params.name === 'string' ? params.name : 'Produk';
  const router = useRouter();
  const { products, productsLoading, productsError, fetchProducts } = useCatalogStore();
  const flags = useFeaturesStore((s) => s.flags);
  const flagsLoading = useFeaturesStore((s) => s.loading);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);
  const fetchFeatures = useFeaturesStore((s) => s.fetchFeatures);
  const [keyword, setKeyword] = useState('');

  const normalized = normalizeCategorySlug(slug);
  const isPulsaFlow = normalized === 'pulsa';
  const isPaketDataFlow = normalized === 'data' || normalized === 'paket-data';
  const isPlnFlow = isPlnPrepaidCategory(slug);
  const isVoucherInternetFlow = isVoucherInternetCategory(slug);
  const providerBrowseCategory = resolveProviderBrowseCategory(slug);
  const isEwalletFlow = providerBrowseCategory === 'topup-digital';
  const isGameFlow = providerBrowseCategory === 'game' || isGameCategory(slug);
  const isLanggananFlow =
    providerBrowseCategory === 'langganan-digital' || isLanggananCategory(slug);
  const isProviderBrowse =
    isProviderBrowseCategory(slug) && !isEwalletFlow && !isGameFlow && !isLanggananFlow;
  // Tagihan / other inquiry cats without provider-browse: still show honest notice (no fake catalog).
  const inquiryBrowseBlocked =
    isInquiryRequiredCategory(slug) &&
    !isProviderBrowse &&
    !isEwalletFlow &&
    !isGameFlow &&
    !isLanggananFlow &&
    !isPlnFlow;

  const beginBrand = useEwalletTransferStore((s) => s.beginBrand);

  const sortedProducts = useMemo(() => sortProductsByPriceAsc(products), [products]);

  const openEwalletBrand = (brand: EwalletBrandGroup) => {
    beginBrand({
      key: brand.key,
      name: brand.name,
      logo: brand.logo,
      providerIds: brand.providerIds,
    });
    router.push('/produk/ewallet');
  };

  const load = useCallback(() => {
    if (
      slug &&
      !isPulsaFlow &&
      !isPaketDataFlow &&
      !isPlnFlow &&
      !isVoucherInternetFlow &&
      !isProviderBrowse &&
      !isEwalletFlow &&
      !isGameFlow &&
      !isLanggananFlow &&
      !inquiryBrowseBlocked
    ) {
      fetchProducts(slug, keyword.trim() || undefined);
    }
  }, [
    slug,
    keyword,
    fetchProducts,
    isPulsaFlow,
    isPaketDataFlow,
    isPlnFlow,
    isVoucherInternetFlow,
    isProviderBrowse,
    isEwalletFlow,
    isGameFlow,
    isLanggananFlow,
    inquiryBrowseBlocked,
  ]);

  useEffect(() => {
    void fetchFeatures();
  }, [fetchFeatures]);

  useEffect(() => {
    if (
      slug &&
      !isPulsaFlow &&
      !isPaketDataFlow &&
      !isPlnFlow &&
      !isVoucherInternetFlow &&
      !isProviderBrowse &&
      !isEwalletFlow &&
      !isGameFlow &&
      !isLanggananFlow &&
      !inquiryBrowseBlocked
    ) {
      fetchProducts(slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    slug,
    isPulsaFlow,
    isPaketDataFlow,
    isPlnFlow,
    isVoucherInternetFlow,
    isProviderBrowse,
    isEwalletFlow,
    isGameFlow,
    isLanggananFlow,
    inquiryBrowseBlocked,
  ]);

  const purchaseBanner =
    !purchaseEnabled && !flagsLoading ? `Pembelian belum aktif — ${flags.messages.purchase}` : null;

  const onRefresh = () => {
    if (
      isPulsaFlow ||
      isPaketDataFlow ||
      isPlnFlow ||
      isVoucherInternetFlow ||
      isProviderBrowse ||
      isEwalletFlow ||
      isGameFlow ||
      isLanggananFlow ||
      inquiryBrowseBlocked
    ) {
      return fetchFeatures();
    }
    return load();
  };

  return (
    <ScreenContainer
      belowHeader
      scroll={!isPlnFlow}
      onRefresh={isPlnFlow ? undefined : onRefresh}
      refreshing={isPlnFlow ? false : productsLoading || flagsLoading}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: categoryName,
          headerBackTitle: 'Kembali',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />

      {inquiryBrowseBlocked ? (
        <PurchaseFlowNotice
          icon="shield-checkmark-outline"
          title={`${categoryName} — Validasi Diperlukan`}
          message={INQUIRY_FLOW_NOTICE}
        />
      ) : isPulsaFlow ? (
        <PulsaCatalogFlow purchaseBanner={purchaseBanner} />
      ) : isPaketDataFlow ? (
        <PaketDataCatalogFlow purchaseBanner={purchaseBanner} />
      ) : isPlnFlow ? (
        <PlnTokenCatalogFlow purchaseBanner={purchaseBanner} />
      ) : isVoucherInternetFlow ? (
        <VoucherInternetHubFlow purchaseBanner={purchaseBanner} />
      ) : isEwalletFlow ? (
        <View style={styles.ewalletBlock}>
          {purchaseBanner ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{purchaseBanner}</Text>
            </View>
          ) : null}
          <Text style={styles.ewalletLead}>Pilih E-Wallet</Text>
          <EwalletBrandList
            subtitleFor={(name) => `Top up ${name}`}
            onSelect={openEwalletBrand}
          />
        </View>
      ) : isGameFlow ? (
        <GameCatalogFlow purchaseBanner={purchaseBanner} />
      ) : isLanggananFlow ? (
        <LanggananCatalogFlow purchaseBanner={purchaseBanner} />
      ) : isProviderBrowse && providerBrowseCategory ? (
        <ProviderCatalogBrowseFlow
          category={providerBrowseCategory}
          purchaseBanner={purchaseBanner}
          providerSearchPlaceholder={browseSearchPlaceholder(providerBrowseCategory)}
        />
      ) : (
        <>
          <TextInput
            placeholder="Cari produk..."
            placeholderTextColor={colors.gray[400]}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={load}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {purchaseBanner ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{purchaseBanner}</Text>
            </View>
          ) : null}

          {productsLoading && products.length === 0 ? (
            <LoadingState label="Memuat produk..." />
          ) : productsError ? (
            <ErrorState message={productsError} onRetry={load} />
          ) : products.length === 0 ? (
            <EmptyState
              title="Belum Ada Produk"
              message="Produk untuk kategori ini belum tersedia saat ini."
            />
          ) : (
            <ProductCatalogGrid
              products={sortedProducts}
              columns={normalized === 'game' ? 5 : 2}
              onPress={(product) =>
                router.push({ pathname: '/produk/detail/[sku]', params: { sku: product.code } })
              }
              isDisabled={(p) => p.status !== 'tersedia'}
              renderMeta={(p) =>
                p.status !== 'tersedia' ? (
                  <Text style={styles.productMeta}>
                    {p.status === 'maintenance' ? 'Maintenance' : 'Gangguan'}
                  </Text>
                ) : (p.quota || p.validity) ? (
                  <Text style={styles.productMeta} numberOfLines={1}>
                    {[p.quota, p.validity].filter(Boolean).join(' · ')}
                  </Text>
                ) : null
              }
            />
          )}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  ewalletBlock: { gap: spacing.md },
  ewalletLead: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
  banner: {
    backgroundColor: colors.status.pendingBg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  bannerText: {
    fontSize: typography.size.xs,
    color: colors.gray[700],
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.base,
    backgroundColor: colors.white,
    color: colors.gray[900],
  },
  productMeta: { fontSize: typography.size.xs, color: colors.gray[500] },
});
