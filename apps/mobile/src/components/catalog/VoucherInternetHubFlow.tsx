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
 * Mode is local UI state only. Fisik uses physical-batches API, not POST /transactions.
 * Child flows own hardware-back step navigation; hub does not intercept beforeRemove
 * while a mode is active (avoids fighting Tembak/Elektronik/Fisik step back).
 */

type HubMode = 'tembak' | 'elektronik' | 'fisik';

type Props = {
  purchaseBanner?: string | null;
};

export function VoucherInternetHubFlow({ purchaseBanner }: Props) {
  const [mode, setMode] = useState<HubMode | null>(null);

  const backToHub = () => setMode(null);

  if (mode === 'tembak') {
    return <VoucherInternetTembakFlow purchaseBanner={purchaseBanner} onBack={backToHub} />;
  }
  if (mode === 'elektronik') {
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
            <Text style={styles.modeDesc}>Isi voucher langsung ke nomor HP</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.gray[400]} />
        </Card>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.7} onPress={() => setMode('elektronik')}>
        <Card style={styles.modeCard}>
          <View style={styles.modeIcon}>
            <Ionicons name="ticket-outline" size={22} color={colors.primary[600]} />
          </View>
          <View style={styles.modeBody}>
            <Text style={styles.modeTitle}>Voucher Elektronik</Text>
            <Text style={styles.modeDesc}>Dapatkan kode voucher</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.gray[400]} />
        </Card>
      </TouchableOpacity>

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
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBody: { flex: 1, gap: 2 },
  modeTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  modeDesc: { fontSize: typography.size.xs, color: colors.gray[500] },
});
