import { useCallback, type ReactNode } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuthStore } from '../../src/store/auth.store';
import { ScreenContainer } from '../../src/components/ui';
import { AccountDeletionBanner } from '../../src/components/AccountDeletionBanner';
import { colors, radius, spacing, typography } from '../../src/theme';
import { resolveMediaUrl } from '../../src/utils/mediaUrl';

type MenuRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  isLast?: boolean;
};

function MenuRow({
  icon,
  label,
  subtitle,
  onPress,
  showChevron = true,
  isLast = false,
}: MenuRowProps) {
  const content = (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.gray[600]} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {showChevron && onPress ? (
        <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {content}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/**
 * Akun IA final:
 * PROFILE → AKUN → KEAMANAN → FITUR → BANTUAN → TENTANG GURKYPAY → Keluar → Version
 * No GurkyPay ID / role / KYC menu / Referral / Loyalty / placeholders.
 */
export default function AkunScreen() {
  const router = useRouter();
  const { user, fetchUser, logout, loading } = useAuthStore();

  useFocusEffect(
    useCallback(() => {
      void fetchUser();
    }, [fetchUser])
  );

  const avatarUri = resolveMediaUrl(user?.avatar || null);
  const appVersion =
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    '1.0.0';
  const contactLine = user?.email || user?.phone || '—';

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScreenContainer scroll style={styles.screen}>
      <Text style={styles.pageTitle}>Akun</Text>

      <AccountDeletionBanner />

      <Section title="Profile">
        <Pressable
          onPress={() => router.push('/akun/profile')}
          style={({ pressed }) => [styles.profileRow, pressed && styles.rowPressed]}
          accessibilityRole="button"
          accessibilityLabel="Ubah Profil"
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {(user?.name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {user?.name || '—'}
            </Text>
            <Text style={styles.profileContact} numberOfLines={1}>
              {contactLine}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
        </Pressable>
      </Section>

      <Section title="Akun">
        <MenuRow
          icon="document-text-outline"
          label="Verifikasi Identitas"
          subtitle="Verifikasi data diri untuk keamanan akun"
          onPress={() => router.push('/akun/identity')}
          isLast
        />
      </Section>

      <Section title="Keamanan">
        <MenuRow
          icon="shield-checkmark-outline"
          label="Keamanan & PIN"
          subtitle="Kelola PIN transaksi dan keamanan akun"
          onPress={() => router.push('/akun/security')}
        />
        <MenuRow
          icon="trash-outline"
          label="Hapus Akun"
          subtitle="Jadwalkan penghapusan akun (masa tunggu 30 hari)"
          onPress={() => router.push('/akun/hapus-akun')}
          isLast
        />
      </Section>

      <Section title="Fitur">
        <MenuRow
          icon="notifications-outline"
          label="Notifikasi"
          subtitle="Preferensi transaksi, informasi, dan promo"
          onPress={() => router.push('/akun/notifikasi')}
        />
        <MenuRow
          icon="storefront-outline"
          label="Profil Toko"
          subtitle="Nama toko, alamat, dan WhatsApp untuk header struk"
          onPress={() => router.push('/akun/profil-toko')}
        />
        <MenuRow
          icon="list-outline"
          label="Template Struk"
          subtitle="Atur field, urutan, dan catatan yang dicetak"
          onPress={() => router.push('/akun/template-struk')}
        />
        <MenuRow
          icon="print-outline"
          label="Bluetooth & Printer"
          subtitle="Hubungkan printer mini Bluetooth untuk mencetak struk"
          onPress={() => router.push('/akun/printer')}
          isLast
        />
      </Section>

      <Section title="Bantuan">
        <MenuRow
          icon="help-circle-outline"
          label="Pusat Bantuan"
          subtitle="FAQ & Chat dengan CS"
          onPress={() => router.push('/(tabs)/help')}
          isLast
        />
      </Section>

      <Section title="Tentang GurkyPay">
        <MenuRow
          icon="document-text-outline"
          label="Syarat & Ketentuan"
          onPress={() =>
            router.push({ pathname: '/akun/legal/[kind]', params: { kind: 'terms' } })
          }
        />
        <MenuRow
          icon="lock-closed-outline"
          label="Kebijakan Privasi"
          onPress={() =>
            router.push({ pathname: '/akun/legal/[kind]', params: { kind: 'privacy' } })
          }
        />
        <MenuRow
          icon="information-circle-outline"
          label="Tentang GurkyNet"
          onPress={() =>
            router.push({ pathname: '/akun/legal/[kind]', params: { kind: 'about' } })
          }
          isLast
        />
      </Section>

      <Pressable
        onPress={() => void handleLogout()}
        disabled={loading}
        style={({ pressed }) => [
          styles.logoutBtn,
          pressed && !loading && styles.logoutPressed,
          loading && styles.logoutDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Keluar Akun"
      >
        <Text style={styles.logoutText}>{loading ? 'Keluar…' : 'Keluar Akun'}</Text>
      </Pressable>

      <Text style={styles.version}>Version {appVersion}</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.gray[50] },
  pageTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    marginBottom: spacing.sm,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  sectionBody: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 64,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.gray[200],
  },
  avatarInitial: {
    color: colors.white,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  profileInfo: { flex: 1, minWidth: 0, gap: 2 },
  profileName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  profileContact: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    minHeight: 52,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[100],
  },
  rowPressed: {
    backgroundColor: colors.gray[50],
  },
  rowIcon: {
    width: 24,
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowLabel: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
  },
  rowSub: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
  },
  logoutBtn: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.status.failed,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutPressed: { backgroundColor: colors.status.failedBg },
  logoutDisabled: { opacity: 0.5 },
  logoutText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.status.failed,
  },
  version: {
    textAlign: 'center',
    fontSize: typography.size.xs,
    color: colors.gray[400],
    marginBottom: spacing.lg,
  },
});
