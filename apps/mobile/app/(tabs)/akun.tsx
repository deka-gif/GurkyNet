import { useEffect } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { ScreenContainer, Card, Button } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

const MENU_ITEMS = [
  { key: 'security', icon: 'shield-checkmark' as const, label: 'Keamanan & PIN', phase: 'Fase 8', href: null as string | null },
  { key: 'kyc', icon: 'document-text' as const, label: 'Verifikasi KYC', phase: 'Fase 8', href: null },
  { key: 'referral', icon: 'people' as const, label: 'Referral', phase: 'Fase 8', href: null },
  { key: 'loyalty', icon: 'star' as const, label: 'Poin & Loyalitas', phase: 'Fase 8', href: null },
  { key: 'help', icon: 'help-circle' as const, label: 'Bantuan', phase: null, href: '/(tabs)/help' },
];

export default function AkunScreen() {
  const router = useRouter();
  const { user, fetchUser, logout, loading } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScreenContainer>
      <View style={styles.profileHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>{(user?.name || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || '-'}</Text>
          <Text style={styles.profileContact}>{user?.email || user?.phone || '-'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{user?.role || 'User'}</Text>
          </View>
        </View>
      </View>

      <Card style={styles.menuCard}>
        {MENU_ITEMS.map((item, index) => (
          <Pressable
            key={item.key}
            onPress={() => {
              if (item.href) router.push(item.href as any);
            }}
            disabled={!item.href}
            style={[styles.menuRow, index < MENU_ITEMS.length - 1 && styles.menuRowBorder]}
          >
            <View style={styles.menuLeft}>
              <Ionicons name={item.icon} size={20} color={colors.gray[500]} />
              <Text style={styles.menuLabel}>{item.label}</Text>
            </View>
            {item.phase ? (
              <Text style={styles.menuPhase}>{item.phase}</Text>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.gray[400]} />
            )}
          </Pressable>
        ))}
      </Card>

      <Button label="Keluar Akun" onPress={handleLogout} variant="danger" loading={loading} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: colors.white, fontSize: typography.size.xl, fontWeight: typography.weight.black },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.gray[900] },
  profileContact: { fontSize: typography.size.sm, color: colors.gray[500] },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: 2,
  },
  roleBadgeText: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.primary[700] },
  menuCard: { padding: 0, overflow: 'hidden' },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuLabel: { fontSize: typography.size.base, color: colors.gray[800], fontWeight: typography.weight.medium },
  menuPhase: { fontSize: typography.size.xs, color: colors.gray[400] },
});
