import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, Button } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

/**
 * Verifikasi Identitas — Coming Soon placeholder only.
 * No fake KYC upload. PURCHASE_KYC_REQUIRED untouched. Backend KYC preserved.
 */
export default function IdentityComingSoonScreen() {
  const router = useRouter();

  return (
    <ScreenContainer belowHeader>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Verifikasi Identitas',
          headerBackTitle: 'Kembali',
        }}
      />

      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={36} color={colors.primary[600]} />
        </View>
        <Text style={styles.title}>Verifikasi Identitas</Text>
        <Text style={styles.body}>Fitur verifikasi identitas sedang kami siapkan.</Text>
        <Text style={styles.bodyMuted}>
          Verifikasi identitas akan tersedia pada tahap berikutnya.
        </Text>
        <Button label="Mengerti" onPress={() => router.back()} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
  },
  body: {
    fontSize: typography.size.sm,
    color: colors.gray[700],
    textAlign: 'center',
    lineHeight: 20,
  },
  bodyMuted: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
});
