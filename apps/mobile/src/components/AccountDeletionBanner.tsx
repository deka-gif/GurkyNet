import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/auth.store';
import { colors, radius, spacing, typography } from '../theme';

function formatSchedule(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Banner when account is pending_deletion — tap to manage / cancel. */
export function AccountDeletionBanner() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  if (user?.deletionStatus !== 'pending_deletion') return null;

  const when = formatSchedule(user.deletionScheduledFor);

  return (
    <Pressable
      onPress={() => router.push('/akun/hapus-akun')}
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Akun terjadwal dihapus"
    >
      <Ionicons name="warning-outline" size={20} color={colors.status.pending} />
      <View style={styles.textWrap}>
        <Text style={styles.title}>Akun terjadwal dihapus{when ? ` ${when}` : ''}</Text>
        <Text style={styles.sub}>Transaksi baru diblokir. Ketuk untuk batalkan.</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.gray[500]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.pendingBg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.status.pending,
    marginBottom: spacing.md,
  },
  pressed: { opacity: 0.9 },
  textWrap: { flex: 1, minWidth: 0, gap: 2 },
  title: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  sub: {
    fontSize: typography.size.xs,
    color: colors.gray[600],
  },
});
