import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../src/components/ui';
import { useTransferStore } from '../../src/store/transfer.store';
import { colors, radius, spacing, typography } from '../../src/theme';

type DestinationRow = {
  key: 'gurkypay' | 'ovo' | 'gopay' | 'shopeepay';
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  enabled: boolean;
};

const DESTINATIONS: DestinationRow[] = [
  {
    key: 'gurkypay',
    title: 'Sesama GurkyPay',
    subtitle: 'Kirim saldo ke pengguna GurkyNet',
    icon: 'swap-horizontal-outline',
    enabled: true,
  },
  {
    key: 'ovo',
    title: 'OVO',
    subtitle: 'Segera hadir',
    icon: 'wallet-outline',
    enabled: false,
  },
  {
    key: 'gopay',
    title: 'GoPay',
    subtitle: 'Segera hadir',
    icon: 'phone-portrait-outline',
    enabled: false,
  },
  {
    key: 'shopeepay',
    title: 'ShopeePay',
    subtitle: 'Segera hadir',
    icon: 'bag-handle-outline',
    enabled: false,
  },
];

/**
 * Transfer hub — only Sesama GurkyPay is actionable (audit: READY).
 * E-wallet rows are disabled placeholders (no disbursement backend yet).
 */
export default function TransferIndexScreen() {
  const router = useRouter();
  const beginSession = useTransferStore((s) => s.beginSession);

  const openGurkyPay = () => {
    beginSession('gurkypay');
    router.push('/transfer/gurkypay');
  };

  return (
    <ScreenContainer belowHeader>
      <Stack.Screen options={{ headerShown: true, title: 'Transfer', headerBackTitle: 'Kembali' }} />

      <Text style={styles.lead}>Kirim saldo dengan mudah dan aman</Text>

      <Text style={styles.sectionLabel}>Tujuan</Text>
      <View style={styles.list}>
        {DESTINATIONS.filter((d) => d.enabled).map((d) => (
          <Pressable
            key={d.key}
            accessibilityRole="button"
            accessibilityLabel={d.title}
            onPress={openGurkyPay}
            style={({ pressed }) => [styles.row, styles.rowActive, pressed && styles.pressed]}
          >
            <View style={[styles.iconWrap, styles.iconActive]}>
              <Ionicons name={d.icon} size={22} color={colors.primary[600]} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{d.title}</Text>
              <Text style={styles.rowSub}>{d.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.gray[400]} />
          </Pressable>
        ))}
      </View>

      <Text style={[styles.sectionLabel, styles.sectionSoon]}>E-Wallet</Text>
      <View style={styles.list}>
        {DESTINATIONS.filter((d) => !d.enabled).map((d) => (
          <View
            key={d.key}
            accessibilityState={{ disabled: true }}
            style={[styles.row, styles.rowDisabled]}
          >
            <View style={[styles.iconWrap, styles.iconDisabled]}>
              <Ionicons name={d.icon} size={22} color={colors.gray[400]} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, styles.textMuted]}>{d.title}</Text>
              <Text style={[styles.rowSub, styles.textMuted]}>{d.subtitle}</Text>
            </View>
          </View>
        ))}
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
  sectionSoon: {
    marginTop: spacing.xl,
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
  rowDisabled: {
    opacity: 0.72,
    backgroundColor: colors.gray[50],
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
  iconDisabled: {
    backgroundColor: colors.gray[100],
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
  textMuted: {
    color: colors.gray[400],
  },
});
