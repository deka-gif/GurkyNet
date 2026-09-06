import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

/**
 * Help — Cek Zona (Mobile only).
 * Opened via stack push from Voucher Internet Telkomsel zone steps so Back restores
 * purchase flow state. Provider comes from route params (not global mutable Help search).
 * No invented dial codes / city–zone tables (PDF referensi belum tersedia di repo).
 */

function normalizeProviderParam(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return String(v || '')
    .trim()
    .toLowerCase();
}

function providerDisplayName(provider: string): string {
  if (provider === 'telkomsel') return 'Telkomsel';
  if (!provider) return 'Provider';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export default function HelpCekZonaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ provider?: string }>();
  const provider = normalizeProviderParam(params.provider);
  const brand = providerDisplayName(provider);

  const title = useMemo(() => `Cek Zona — ${brand}`, [brand]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Kembali"
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={24} color={colors.gray[900]} />
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>Cek Zona Voucher</Text>
          <Text style={styles.lead}>
            Informasi singkat untuk memastikan voucher berzona cocok dengan wilayah kartu kamu.
            {provider === 'telkomsel' ? ' Konteks: Telkomsel.' : provider ? ` Konteks: ${brand}.` : ''}
          </Text>

          <View style={styles.card}>
            <Text style={styles.h2}>1. Kuota / voucher nasional</Text>
            <Text style={styles.p}>
              Produk nasional (tanpa zona wilayah) umumnya dapat dipakai di seluruh Indonesia sesuai
              ketentuan produk. Tidak perlu memilih zona geografis.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.h2}>2. Kuota / voucher berzona</Text>
            <Text style={styles.p}>
              Produk berzona hanya aktif di wilayah tertentu. Jika zona tidak sesuai dengan lokasi
              pemakaian kartu, aktivasi dapat gagal dan tidak selalu dapat dikembalikan otomatis.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.h2}>3. Cara mengecek zona</Text>
            <Text style={styles.p}>
              Ikuti petunjuk resmi dari operator di aplikasi/USSD/customer service mereka. Daftar
              dial atau peta kota detail belum tersedia di aplikasi ini sampai dokumentasi resmi
              terverifikasi.
            </Text>
          </View>

          <View style={styles.warn}>
            <Ionicons name="warning-outline" size={18} color={colors.status.pending} />
            <Text style={styles.warnText}>
              Pastikan wilayah yang kamu pilih di aplikasi sama dengan wilayah kartu. Salah pilih zona
              dapat membuat voucher tidak aktif.
            </Text>
          </View>

          <Button label="Kembali ke pembelian" onPress={() => router.back()} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  h1: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  lead: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.gray[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[100],
  },
  h2: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  p: {
    fontSize: typography.size.xs,
    color: colors.gray[700],
    lineHeight: 18,
  },
  warn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.status.pendingBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.status.pending,
  },
  warnText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.gray[800],
    lineHeight: 18,
    fontWeight: typography.weight.medium,
  },
});
