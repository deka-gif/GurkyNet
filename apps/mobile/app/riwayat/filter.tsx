import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HISTORY_STATUS_OPTIONS,
  HistoryFilterState,
  HistoryStatusFilter,
  HistoryTimeMode,
  buildProductOptionsFromTransactions,
  defaultHistoryFilters,
  useHistoryStore,
} from '../../src/store/history.store';
import { colors, radius, spacing, typography } from '../../src/theme';

/**
 * Filter Transaksi — Produk + Waktu + Status (purchase history only).
 * No Uang Masuk / Uang Keluar (wallet ledger concept).
 */
export default function RiwayatFilterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useHistoryStore((s) => s.items);
  const applied = useHistoryStore((s) => s.filters);
  const applyFilters = useHistoryStore((s) => s.applyFilters);

  const [draft, setDraft] = useState<HistoryFilterState>(() => ({ ...applied }));
  const [productOpen, setProductOpen] = useState(false);

  const productOptions = useMemo(() => buildProductOptionsFromTransactions(items), [items]);

  const productLabel =
    productOptions.find((o) => o.key === draft.product)?.label || 'Semua Produk';

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2];
  }, []);

  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        new Date(2000, i, 1).toLocaleDateString('id-ID', { month: 'long' })
      ),
    []
  );

  const selectedYear = Number(draft.monthKey.slice(0, 4)) || new Date().getFullYear();
  const selectedMonth = Number(draft.monthKey.slice(5, 7)) || new Date().getMonth() + 1;

  const setTimeMode = (mode: HistoryTimeMode) => {
    setDraft((d) => ({ ...d, timeMode: mode }));
  };

  const onReset = () => {
    setDraft(defaultHistoryFilters());
  };

  const onApply = () => {
    applyFilters(draft);
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable onPress={onReset} hitSlop={8}>
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
          <Text style={styles.topTitle}>Filter Transaksi</Text>
          <Pressable
            onPress={() => router.back()}
            style={styles.closeBtn}
            accessibilityLabel="Tutup filter"
            hitSlop={8}
          >
            <Ionicons name="close" size={22} color={colors.gray[800]} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>Produk</Text>
          <Pressable style={styles.select} onPress={() => setProductOpen(true)}>
            <Text style={styles.selectText} numberOfLines={1}>
              {productLabel}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.gray[500]} />
          </Pressable>

          <Text style={styles.sectionLabel}>Waktu</Text>
          <View style={styles.chipRow}>
            {(
              [
                { key: 'all' as const, label: 'Semua' },
                { key: 'month' as const, label: 'Bulan' },
                { key: 'date' as const, label: 'Tanggal' },
              ] as const
            ).map((t) => {
              const active = draft.timeMode === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTimeMode(t.key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {draft.timeMode === 'month' ? (
            <View style={styles.subBlock}>
              <Text style={styles.hint}>Tahun</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
                <View style={styles.chipRow}>
                  {years.map((y) => {
                    const active = selectedYear === y;
                    return (
                      <Pressable
                        key={y}
                        onPress={() =>
                          setDraft((d) => ({
                            ...d,
                            monthKey: `${y}-${String(selectedMonth).padStart(2, '0')}`,
                          }))
                        }
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{y}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              <Text style={[styles.hint, { marginTop: spacing.sm }]}>Bulan</Text>
              <View style={styles.monthGrid}>
                {monthNames.map((name, i) => {
                  const mo = i + 1;
                  const active = selectedMonth === mo;
                  return (
                    <Pressable
                      key={name}
                      onPress={() =>
                        setDraft((d) => ({
                          ...d,
                          monthKey: `${selectedYear}-${String(mo).padStart(2, '0')}`,
                        }))
                      }
                      style={[styles.monthCell, active && styles.chipActive]}
                    >
                      <Text
                        style={[styles.chipText, active && styles.chipTextActive]}
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {draft.timeMode === 'date' ? (
            <View style={styles.subBlock}>
              <Text style={styles.hint}>Dari (YYYY-MM-DD)</Text>
              <TextInput
                value={draft.dateStart}
                onChangeText={(v) => setDraft((d) => ({ ...d, dateStart: v.trim() }))}
                placeholder="2026-09-01"
                placeholderTextColor={colors.gray[400]}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.hint}>Sampai (YYYY-MM-DD)</Text>
              <TextInput
                value={draft.dateEnd}
                onChangeText={(v) => setDraft((d) => ({ ...d, dateEnd: v.trim() }))}
                placeholder="2026-09-30"
                placeholderTextColor={colors.gray[400]}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>Status</Text>
          <View style={styles.chipRowWrap}>
            {HISTORY_STATUS_OPTIONS.map((opt) => {
              const active = draft.status === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() =>
                    setDraft((d) => ({ ...d, status: opt.key as HistoryStatusFilter }))
                  }
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Pressable style={styles.applyBtn} onPress={onApply}>
            <Text style={styles.applyText}>Terapkan</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={productOpen} transparent animationType="fade" onRequestClose={() => setProductOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setProductOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Produk</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {productOptions.map((opt) => (
                <Pressable
                  key={String(opt.key)}
                  style={styles.modalRow}
                  onPress={() => {
                    setDraft((d) => ({ ...d, product: opt.key }));
                    setProductOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalRowText,
                      draft.product === opt.key && styles.modalRowTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {draft.product === opt.key ? (
                    <Ionicons name="checkmark" size={18} color={colors.primary[600]} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray[50] },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  resetText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[600],
    width: 56,
  },
  topTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  closeBtn: { width: 56, alignItems: 'flex-end' },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  sectionLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    marginTop: spacing.sm,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  selectText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.gray[800],
    fontWeight: typography.weight.medium,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  chipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  chipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[600],
  },
  chipTextActive: { color: colors.primary[700] },
  subBlock: { gap: spacing.sm },
  hint: { fontSize: 11, color: colors.gray[500], fontWeight: typography.weight.medium },
  hScroll: { flexGrow: 0 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  monthCell: {
    width: '30%',
    flexGrow: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
    alignItems: 'center',
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.sm,
    color: colors.gray[900],
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[200],
  },
  applyBtn: {
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  applyText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  modalTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.sm,
    color: colors.gray[900],
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[100],
  },
  modalRowText: { fontSize: typography.size.sm, color: colors.gray[700] },
  modalRowTextActive: { color: colors.primary[700], fontWeight: typography.weight.bold },
});
