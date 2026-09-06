import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../src/components/ui';
import { EwalletBrandList } from '../../src/components/catalog/EwalletBrandList';
import { useTransferStore } from '../../src/store/transfer.store';
import { useEwalletTransferStore } from '../../src/store/ewalletTransfer.store';
import { EwalletBrandGroup } from '../../src/utils/ewalletBrand';
import { colors, radius, spacing, typography } from '../../src/theme';

/**
 * Transfer hub — Sesama GurkyPay + E-Wallet brands (deduped).
 * No product counts. E-Wallet brands → PPOB inquiry flow (not /wallet/transfer).
 */
export default function TransferIndexScreen() {
  const router = useRouter();
  const beginSession = useTransferStore((s) => s.beginSession);
  const beginBrand = useEwalletTransferStore((s) => s.beginBrand);

  const openGurkyPay = () => {
    beginSession('gurkypay');
    router.push('/transfer/gurkypay');
  };

  const openBrand = (brand: EwalletBrandGroup) => {
    beginBrand({
      key: brand.key,
      name: brand.name,
      logo: brand.logo,
      providerIds: brand.providerIds,
    });
    router.push('/transfer/ewallet');
  };

  return (
    <ScreenContainer belowHeader scroll>
      <Stack.Screen options={{ headerShown: true, title: 'Transfer', headerBackTitle: 'Kembali' }} />

      <Text style={styles.lead}>Kirim saldo dengan mudah dan aman</Text>

      <Text style={styles.sectionLabel}>Tujuan</Text>
      <View style={styles.list}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sesama GurkyPay"
          onPress={openGurkyPay}
          style={({ pressed }) => [styles.row, styles.rowActive, pressed && styles.pressed]}
        >
          <View style={[styles.iconWrap, styles.iconActive]}>
            <Ionicons name="swap-horizontal-outline" size={22} color={colors.primary[600]} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Sesama GurkyPay</Text>
            <Text style={styles.rowSub}>Kirim saldo ke pengguna GurkyNet</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.gray[400]} />
        </Pressable>

        <EwalletBrandList
          subtitleFor={(name) => `Transfer ke ${name}`}
          onSelect={openBrand}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
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
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: {
    backgroundColor: colors.primary[50],
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
