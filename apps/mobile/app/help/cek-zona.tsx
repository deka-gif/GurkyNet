import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import {
  findCekWilayahFaq,
  helpService,
  parseCekWilayahAnswer,
  type HelpFaqItem,
} from '../../src/services/help.service';

/**
 * Help — Cek Wilayah Kartu.
 * Content from FAQ (GET /help), editable by CS via Knowledge Base.
 * Stack-push from Voucher Internet; Back restores purchase state.
 */

type ProviderId = 'telkomsel' | 'indosat' | 'tri' | 'axis' | 'xl' | 'smartfren';

const PROVIDERS: Array<{ id: ProviderId; label: string }> = [
  { id: 'telkomsel', label: 'Telkomsel' },
  { id: 'indosat', label: 'Indosat' },
  { id: 'tri', label: 'Tri' },
  { id: 'axis', label: 'Axis' },
  { id: 'xl', label: 'XL' },
  { id: 'smartfren', label: 'Smartfren' },
];

function normalizeProviderParam(raw: string | string[] | undefined): ProviderId | null {
  const v = String(Array.isArray(raw) ? raw[0] : raw || '')
    .trim()
    .toLowerCase();
  if (PROVIDERS.some((p) => p.id === v)) return v as ProviderId;
  return null;
}

export default function HelpCekZonaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ provider?: string }>();
  const fromParam = normalizeProviderParam(params.provider);
  const [active, setActive] = useState<ProviderId>(fromParam ?? 'telkomsel');
  const [faqs, setFaqs] = useState<HelpFaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fromParam) setActive(fromParam);
  }, [fromParam]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await helpService.getHelpCenter();
      setFaqs(Array.isArray(data.faq) ? data.faq : []);
    } catch (err: any) {
      setFaqs([]);
      setError(err?.message || 'Gagal memuat konten. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const brand = useMemo(
    () => PROVIDERS.find((p) => p.id === active)?.label ?? 'Provider',
    [active]
  );

  const article = useMemo(() => findCekWilayahFaq(faqs, active), [faqs, active]);
  const parsed = useMemo(
    () => (article ? parseCekWilayahAnswer(article.answer) : { steps: [], note: null }),
    [article]
  );

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
            Cek wilayah kartu
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={[styles.infoCard, styles.infoGreen]}>
            <Text style={styles.infoTitle}>Kuota Nasional</Text>
            <Text style={styles.infoBody}>
              Kuota Nasional bisa dipakai di seluruh Indonesia tanpa syarat wilayah — cocok kalau
              kamu tidak yakin dengan zona kartumu.
            </Text>
          </View>

          <View style={[styles.infoCard, styles.infoNeutral]}>
            <Text style={styles.infoTitle}>Kuota Lokal / Zona</Text>
            <Text style={styles.infoBody}>
              Kuota Lokal/Zona hanya aktif di kota tempat kartu pertama kali diaktifkan. Salah pilih
              zona, paket tidak akan aktif.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Pilih provider</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
          >
            {PROVIDERS.map((p) => {
              const on = p.id === active;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setActive(p.id)}
                  style={[styles.tab, on && styles.tabOn]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={p.label}
                >
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={colors.primary[600]} />
              <Text style={styles.muted}>Memuat panduan {brand}…</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Button label="Coba lagi" variant="secondary" onPress={() => void load()} />
            </View>
          ) : !article ? (
            <View style={styles.fallbackBox}>
              <Text style={styles.fallbackTitle}>Konten belum tersedia</Text>
              <Text style={styles.fallbackBody}>
                Panduan cek wilayah untuk {brand} belum tersedia. Hubungi Customer Service untuk
                bantuan, atau coba lagi nanti.
              </Text>
            </View>
          ) : parsed.steps.length === 0 ? (
            <View style={styles.stepsCard}>
              <Text style={styles.stepsHeading}>Cara cek di {brand}</Text>
              <Text style={styles.stepText}>{article.answer.trim() || parsed.note || ''}</Text>
            </View>
          ) : (
            <>
              <View style={styles.stepsCard}>
                <Text style={styles.stepsHeading}>Cara cek di {brand}</Text>
                {parsed.steps.map((step, i) => (
                  <View key={`step-${i}`} style={styles.stepRow}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
              {parsed.note ? <Text style={styles.dialNote}>{parsed.note}</Text> : null}
            </>
          )}

          <Button label="Kembali" onPress={() => router.back()} />
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  infoCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  infoGreen: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  infoNeutral: {
    backgroundColor: colors.gray[50],
    borderColor: colors.gray[200],
  },
  infoTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  infoBody: {
    fontSize: typography.size.sm,
    color: colors.gray[700],
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  tabsRow: { gap: spacing.sm, paddingRight: spacing.md },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.gray[100],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
  },
  tabOn: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  tabText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
  tabTextOn: { color: colors.white },
  stepsCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    padding: spacing.md,
    gap: spacing.md,
  },
  stepsHeading: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  stepRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  stepText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.gray[800],
    lineHeight: 20,
  },
  dialNote: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
    lineHeight: 18,
  },
  centerBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  muted: { fontSize: typography.size.sm, color: colors.gray[500] },
  errorText: {
    fontSize: typography.size.sm,
    color: colors.status.failed,
    textAlign: 'center',
  },
  fallbackBox: {
    backgroundColor: colors.gray[50],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    padding: spacing.md,
    gap: spacing.sm,
  },
  fallbackTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  fallbackBody: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    lineHeight: 20,
  },
});
