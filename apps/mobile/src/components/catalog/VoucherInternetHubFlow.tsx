import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui';
import { colors, radius, spacing, typography } from '../../theme';
import { VoucherInternetTembakFlow } from './VoucherInternetTembakFlow';
import { VoucherInternetElektronikFlow } from './VoucherInternetElektronikFlow';
import { VoucherInternetFisikFlow } from './VoucherInternetFisikFlow';

/**
 * Voucher Internet hub — Web mode model (tembak | elektronik | fisik).
 * Mode is local UI state only (hardcoded — not backend-driven).
 * Fisik uses physical-batches API, not POST /transactions.
 * Child flows own hardware-back step navigation; hub does not intercept beforeRemove
 * while a mode is active (avoids fighting Tembak/Elektronik/Fisik step back).
 *
 * Elektronik temporarily disabled for all providers (Owner 2026-09-14).
 * Flow component kept; card shows "Sedang Dikerjakan" and cannot open.
 */

type HubMode = 'tembak' | 'elektronik' | 'fisik';

/** Flip false after per-provider verification to restore Elektronik entry. */
const ELEKTRONIK_TEMPORARILY_DISABLED = true;

type Props = {
  purchaseBanner?: string | null;
};

export function VoucherInternetHubFlow({ purchaseBanner }: Props) {
  const [mode, setMode] = useState<HubMode | null>(null);

  const backToHub = () => setMode(null);

  if (mode === 'tembak') {
    return <VoucherInternetTembakFlow purchaseBanner={purchaseBanner} onBack={backToHub} />;
  }
  // Kept reachable for re-enable; currently blocked from hub card.
  if (mode === 'elektronik' && !ELEKTRONIK_TEMPORARILY_DISABLED) {
    return <VoucherInternetElektronikFlow purchaseBanner={purchaseBanner} onBack={backToHub} />;
  }
  if (mode === 'fisik') {
    return <VoucherInternetFisikFlow purchaseBanner={purchaseBanner} onBack={backToHub} />;
  }

  return (
    <View style={styles.wrap}>
      {purchaseBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{purchaseBanner}</Text>
        </View>
      ) : null}

      <Text style={styles.lead}>Pilih cara pembelian voucher internet.</Text>

      <TouchableOpacity activeOpacity={0.7} onPress={() => setMode('tembak')}>
        <Card style={styles.modeCard}>
          <View style={styles.modeIcon}>
            <Ionicons name="flash-outline" size={22} color={colors.primary[600]} />
          </View>
          <View style={styles.modeBody}>
            <Text style={styles.modeTitle}>Tembak Langsung</Text>
            <Text style={styles.modeDesc}>Beli kode voucher via nomor HP</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.gray[400]} />
        </Card>
      </TouchableOpacity>

      <View style={[styles.modeCardWrap, styles.modeCardDisabled]}>
        <Card style={[styles.modeCard, styles.modeCardMuted]}>
          <View style={[styles.modeIcon, styles.modeIconMuted]}>
            <Ionicons name="ticket-outline" size={22} color={colors.gray[400]} />
          </View>
          <View style={styles.modeBody}>
            <View style={styles.titleRow}>
              <Text style={[styles.modeTitle, styles.modeTitleMuted]}>Voucher Elektronik</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Sedang Dikerjakan</Text>
              </View>
            </View>
            <Text style={styles.modeDesc}>
              Sementara tidak tersedia. Gunakan Tembak Langsung atau Voucher Fisik.
            </Text>
          </View>
        </Card>
      </View>

      <TouchableOpacity activeOpacity={0.7} onPress={() => setMode('fisik')}>
        <Card style={styles.modeCard}>
          <View style={styles.modeIcon}>
            <Ionicons name="storefront-outline" size={22} color={colors.primary[600]} />
          </View>
          <View style={styles.modeBody}>
            <Text style={styles.modeTitle}>Voucher Fisik</Text>
            <Text style={styles.modeDesc}>Aktivasi serial number kartu fisik</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.gray[400]} />
        </Card>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  banner: {
    backgroundColor: colors.status.pendingBg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bannerText: {
    fontSize: typography.size.xs,
    color: colors.gray[700],
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
  lead: { fontSize: typography.size.sm, color: colors.gray[600] },
  modeCardWrap: { borderRadius: radius.lg },
  modeCardDisabled: { opacity: 0.85 },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  modeCardMuted: {
    backgroundColor: colors.gray[50],
  },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIconMuted: {
    backgroundColor: colors.gray[100],
  },
  modeBody: { flex: 1, gap: 2 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modeTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  modeTitleMuted: { color: colors.gray[600] },
  modeDesc: { fontSize: typography.size.xs, color: colors.gray[500] },
  badge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: '#92400E',
    textTransform: 'uppercase',
  },
});
