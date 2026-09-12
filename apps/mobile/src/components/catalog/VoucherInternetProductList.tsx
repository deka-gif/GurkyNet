import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Button } from '../ui';
import type { Product } from '../../services/catalog.service';
import { sortProductsByPriceAsc } from '../../utils/sortProductsByPrice';
import { isProductPurchasable } from '../../utils/catalogAvailability';
import { isTelkomselSelectableZoneLabel } from '../../utils/telkomselVoucherZone';
import { formatIDR } from '../../utils/currency';
import { colors, radius, spacing, typography } from '../../theme';

type Props = {
  products: Product[];
  onSelect: (product: Product) => void;
  isDisabled?: (product: Product) => boolean;
  selectedCode?: string | null;
  /** Fallback line when description empty (e.g. "Nasional"). */
  getMetaLabel?: (product: Product) => string | null;
};

/**
 * Voucher Internet only — vertical product cards + Digiflazz detail popup (BLU-inspired).
 * Does not change ProductCatalogGrid used by Game / Pulsa / etc.
 */
export function VoucherInternetProductList({
  products,
  onSelect,
  isDisabled,
  selectedCode,
  getMetaLabel,
}: Props) {
  const router = useRouter();
  const sorted = useMemo(() => sortProductsByPriceAsc(products), [products]);
  const [detail, setDetail] = useState<Product | null>(null);

  const openCekZona = () => {
    setDetail(null);
    router.push({ pathname: '/help/cek-zona', params: { provider: 'telkomsel' } });
  };

  const previewText = (p: Product): string => {
    const desc = typeof p.description === 'string' ? p.description.trim() : '';
    if (desc) return desc;
    const bits = [p.quota, p.validity, getMetaLabel?.(p)].filter(Boolean);
    return bits.length > 0 ? bits.join(' · ') : 'Ketuk Lihat Detail untuk informasi produk.';
  };

  const showZoneNote = (p: Product) => isTelkomselSelectableZoneLabel(p.zoneLabel);

  return (
    <View style={styles.list}>
      {sorted.map((product) => {
        const disabled = isDisabled?.(product) ?? false;
        const active = selectedCode != null && selectedCode === product.code;
        return (
          <Card
            key={product.code || String(product.id)}
            style={[
              styles.card,
              active && styles.cardActive,
              disabled && styles.cardDisabled,
            ]}
          >
            <Pressable
              disabled={disabled}
              onPress={() => onSelect(product)}
              style={styles.cardPress}
            >
              <View style={styles.headerRow}>
                <Text style={styles.name} numberOfLines={2}>
                  {product.name}
                </Text>
                <Text style={styles.price}>{formatIDR(product.price)}</Text>
              </View>
              <View style={styles.divider} />
              <Text style={styles.preview} numberOfLines={2}>
                {previewText(product)}
              </Text>
              {!isProductPurchasable(product) ? (
                <Text style={styles.unavailable}>Tidak tersedia</Text>
              ) : null}
            </Pressable>
            <Pressable
              hitSlop={8}
              disabled={disabled}
              onPress={() => setDetail(product)}
              style={styles.detailLinkWrap}
            >
              <Text style={styles.detailLink}>Lihat Detail</Text>
            </Pressable>
          </Card>
        );
      })}

      <Modal
        visible={!!detail}
        transparent
        animationType="fade"
        onRequestClose={() => setDetail(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setDetail(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.sheetTitle}>Detail Produk</Text>
            {detail ? (
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetBody}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.detailName}>{detail.name}</Text>
                {detail.description?.trim() ? (
                  <Text style={styles.detailDesc}>{detail.description.trim()}</Text>
                ) : (
                  <Text style={styles.detailDescMuted}>Deskripsi produk tidak tersedia.</Text>
                )}
                {detail.quota ? (
                  <Text style={styles.detailMeta}>Kuota: {detail.quota}</Text>
                ) : null}
                {detail.validity ? (
                  <Text style={styles.detailMeta}>Masa aktif: {detail.validity}</Text>
                ) : null}
                {detail.zoneLabel ? (
                  <Text style={styles.detailMeta}>Zona: {detail.zoneLabel}</Text>
                ) : getMetaLabel?.(detail) ? (
                  <Text style={styles.detailMeta}>{getMetaLabel(detail)}</Text>
                ) : null}
                <Text style={styles.detailPrice}>{formatIDR(detail.price)}</Text>

                {showZoneNote(detail) ? (
                  <View style={styles.zoneNote}>
                    <Text style={styles.zoneNoteText}>
                      Bijak Dalam Memilih Zona karena, salah pilih Zona, voucher tidak aktif
                    </Text>
                    <Pressable onPress={openCekZona} hitSlop={8}>
                      <Text style={styles.zoneLink}>cara cek wilayah kartu saya</Text>
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            ) : null}
            <View style={styles.sheetActions}>
              <Button
                label="Pilih"
                disabled={
                  !detail || (isDisabled?.(detail) ?? false) || !isProductPurchasable(detail)
                }
                onPress={() => {
                  if (!detail) return;
                  const picked = detail;
                  setDetail(null);
                  onSelect(picked);
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardPress: {
    gap: spacing.sm,
  },
  cardActive: {
    borderWidth: 1.5,
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  cardDisabled: {
    opacity: 0.55,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    lineHeight: 20,
  },
  price: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    flexShrink: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray[200],
  },
  preview: {
    fontSize: typography.size.xs,
    color: colors.gray[600],
    lineHeight: 18,
  },
  unavailable: {
    fontSize: typography.size.xs,
    color: colors.status.failed,
    fontWeight: typography.weight.medium,
  },
  detailLinkWrap: {
    alignSelf: 'flex-start',
  },
  detailLink: {
    fontSize: typography.size.xs,
    color: colors.primary[600],
    fontWeight: typography.weight.medium,
    textDecorationLine: 'underline',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '78%',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  sheetTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetBody: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  detailName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    lineHeight: 22,
  },
  detailDesc: {
    fontSize: typography.size.sm,
    color: colors.gray[700],
    lineHeight: 20,
  },
  detailDescMuted: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
    lineHeight: 20,
    fontStyle: 'italic',
  },
  detailMeta: {
    fontSize: typography.size.xs,
    color: colors.gray[600],
    lineHeight: 18,
  },
  detailPrice: {
    marginTop: spacing.xs,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  zoneNote: {
    marginTop: spacing.sm,
    backgroundColor: colors.status.pendingBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent[400],
    padding: spacing.md,
    gap: spacing.sm,
  },
  zoneNoteText: {
    fontSize: typography.size.xs,
    color: colors.gray[800],
    lineHeight: 18,
    fontWeight: typography.weight.medium,
  },
  zoneLink: {
    fontSize: typography.size.xs,
    color: colors.primary[600],
    fontWeight: typography.weight.medium,
    textDecorationLine: 'underline',
  },
  sheetActions: {
    paddingTop: spacing.xs,
  },
});
