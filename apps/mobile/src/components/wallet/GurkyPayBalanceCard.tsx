import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';

const ACTION_WIDTH = 112;
const ACTION_HEIGHT = 32;
const ACTION_GAP = 8;

type Props = {
  balance: number | string | null | undefined;
  accountNumber: string;
  onPressBalance?: () => void;
  onPressTopUp: () => void;
  onPressTransfer: () => void;
  /** Wallet-only: copy control next to identifier. */
  onPressCopy?: () => void;
  copyFeedback?: boolean;
  /** Decorative blob — Home card only. */
  showAccent?: boolean;
};

/**
 * Compact GurkyPay saldo card — left info hierarchy + right action column.
 * Top Up / Transfer share one vertically centered action column (not text baselines).
 */
export function GurkyPayBalanceCard({
  balance,
  accountNumber,
  onPressBalance,
  onPressTopUp,
  onPressTransfer,
  onPressCopy,
  copyFeedback,
  showAccent,
}: Props) {
  const left = (
    <View style={styles.leftCol}>
      <Text style={styles.label}>Saldo GurkyPay</Text>
      <Text style={styles.amount}>{formatIDR(balance)}</Text>
      <View style={styles.idBlock}>
        <Text style={styles.idLabel} numberOfLines={1}>
          ID / No. Rekening GurkyPay
        </Text>
        <View style={styles.idRow}>
          <Text style={styles.idValue} numberOfLines={1}>
            {accountNumber || '-'}
          </Text>
          {onPressCopy ? (
            <Pressable
              onPress={onPressCopy}
              style={styles.copyBtn}
              accessibilityRole="button"
              accessibilityLabel="Salin ID GurkyPay"
              hitSlop={6}
            >
              <Ionicons name="copy-outline" size={14} color={colors.primary[100]} />
            </Pressable>
          ) : null}
          {copyFeedback ? <Text style={styles.copyFeedback}>Disalin</Text> : null}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.card}>
      {showAccent ? <View style={styles.accent} pointerEvents="none" /> : null}
      <View style={styles.body}>
        {onPressBalance ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka Wallet"
            onPress={onPressBalance}
            style={({ pressed }) => [styles.leftPressable, pressed && styles.pressed]}
          >
            {left}
          </Pressable>
        ) : (
          left
        )}

        <View style={styles.actionCol}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Top Up"
            onPress={onPressTopUp}
            style={styles.actionChip}
            hitSlop={4}
          >
            <Ionicons name="add" size={16} color={colors.primary[700]} />
            <Text style={styles.actionLabel}>Top Up</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Transfer"
            onPress={onPressTransfer}
            style={styles.actionChip}
            hitSlop={4}
          >
            <Ionicons name="swap-horizontal" size={16} color={colors.primary[700]} />
            <Text style={styles.actionLabel}>Transfer</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary[700],
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    right: -24,
    top: -28,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary[500],
    opacity: 0.22,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  leftPressable: {
    flex: 1,
    minWidth: 0,
  },
  leftCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    color: colors.primary[100],
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    letterSpacing: 0.2,
  },
  amount: {
    color: colors.white,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.black,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  idBlock: {
    marginTop: spacing.sm,
    gap: 2,
  },
  idLabel: {
    color: colors.primary[200],
    fontSize: 11,
    fontWeight: typography.weight.medium,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  idValue: {
    flexShrink: 1,
    color: colors.primary[50],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.3,
  },
  copyBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  copyFeedback: {
    fontSize: 11,
    color: colors.primary[100],
    fontWeight: typography.weight.medium,
  },
  /** Right action column — vertically centered as a group. */
  actionCol: {
    width: ACTION_WIDTH,
    gap: ACTION_GAP,
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionChip: {
    width: ACTION_WIDTH,
    height: ACTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.full,
  },
  actionLabel: {
    color: colors.primary[700],
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  pressed: { opacity: 0.92 },
});
