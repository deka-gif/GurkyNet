import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMonthPeriodLine } from '../../src/store/history.store';
import { monthsWithLedgerActivity, walletService } from '../../src/services/wallet.service';
import { fetchAllWalletHistoryPages } from '../../src/utils/fetchAllWalletHistoryPages';
import { parseApiError } from '../../src/api/client';
import {
  ScreenContainer,
  LoadingState,
  EmptyState,
} from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

/**
 * Laporan Keuangan — monthly picker + PDF download (CustomerStatementService).
 * Ledger months from GET /wallet/history (all pages → last_page); PDF from statements/{period}/pdf.
 */
export default function LaporanKeuanganScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ledgerItems, setLedgerItems] = useState<Array<{ created_at?: string }>>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        // Same helper as Wallet Financial Tracker monthLedger — paginate to last_page, fail-stop.
        const { items } = await fetchAllWalletHistoryPages(
          (filters) => walletService.getHistory(filters),
          { per_page: 100 }
        );
        if (!cancelled) {
          setLedgerItems(items);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          // Do not show partial month list as success.
          setLedgerItems([]);
          const parsed = parseApiError(err);
          setLoadError(parsed.message || 'Gagal memuat daftar periode laporan. Coba lagi.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const retryLoad = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { items } = await fetchAllWalletHistoryPages(
        (filters) => walletService.getHistory(filters),
        { per_page: 100 }
      );
      setLedgerItems(items);
      setLoadError(null);
    } catch (err) {
      setLedgerItems([]);
      const parsed = parseApiError(err);
      setLoadError(parsed.message || 'Gagal memuat daftar periode laporan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const months = useMemo(() => monthsWithLedgerActivity(ledgerItems), [ledgerItems]);

  const years = useMemo(() => {
    if (loadError) return [];
    const set = new Set(months.map((m) => m.year));
    const list = Array.from(set).sort((a, b) => b - a);
    if (list.length === 0 && !loading && ledgerItems.length === 0 && !loadError) {
      // Empty ledger success — still show current year chip for empty state context.
      list.push(new Date().getFullYear());
    }
    return list;
  }, [months, loadError, loading, ledgerItems.length]);

  useEffect(() => {
    if (selectedYear == null && years.length > 0) {
      setSelectedYear(years[0]);
    }
  }, [years, selectedYear]);

  const monthsForYear = useMemo(
    () => months.filter((m) => m.year === selectedYear),
    [months, selectedYear]
  );

  const onDownloadPress = async (monthKey: string, label: string) => {
    if (downloadingKey) return;
    setDownloadingKey(monthKey);
    showToast('Mempersiapkan laporan...');
    try {
      const { uri, filename } = await walletService.downloadStatementPdf(monthKey);
      showToast(`Berhasil mengunduh laporan ${label}`);
      await walletService.shareStatementPdf(uri, filename);
    } catch (err) {
      const parsed = parseApiError(err);
      showToast(parsed.message || 'Laporan gagal diunduh. Coba lagi.');
    } finally {
      setDownloadingKey(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Kembali ke Riwayat"
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={24} color={colors.gray[900]} />
          </Pressable>
          <Text style={styles.topTitle}>Laporan Keuangan</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScreenContainer belowHeader>
          <Text style={styles.lead}>
            Pilih periode untuk mengunduh laporan keuangan bulanan GurkyPay (PDF).
          </Text>

          {!loadError ? (
            <>
              <Text style={styles.sectionLabel}>Tahun</Text>
              <View style={styles.yearRow}>
                {years.map((y) => {
                  const active = selectedYear === y;
                  return (
                    <Pressable
                      key={y}
                      onPress={() => setSelectedYear(y)}
                      style={[styles.yearChip, active && styles.yearChipActive]}
                    >
                      <Text style={[styles.yearText, active && styles.yearTextActive]}>{y}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {loading ? (
            <LoadingState label="Memuat periode…" />
          ) : loadError ? (
            <EmptyState
              title="Gagal Memuat Periode"
              message={loadError}
            />
          ) : monthsForYear.length === 0 ? (
            <EmptyState
              title="Belum Ada Data"
              message="Tidak ada mutasi saldo pada tahun ini untuk disusun laporan."
            />
          ) : (
            <View style={styles.list}>
              {monthsForYear.map((m) => {
                const busy = downloadingKey === m.monthKey;
                return (
                  <View key={m.monthKey} style={styles.monthCard}>
                    <View style={styles.monthBody}>
                      <Text style={styles.monthTitle}>{m.label}</Text>
                      <Text style={styles.monthPeriod}>
                        {formatMonthPeriodLine(m.year, m.monthIndex0)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => onDownloadPress(m.monthKey, m.label)}
                      disabled={!!downloadingKey}
                      style={[styles.downloadBtn, busy && styles.downloadBtnBusy]}
                      accessibilityLabel={`Unduh laporan ${m.label}`}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={colors.primary[600]} />
                      ) : (
                        <Ionicons name="download-outline" size={22} color={colors.primary[600]} />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {loadError && !loading ? (
            <Pressable onPress={retryLoad} style={styles.retryBtn} accessibilityLabel="Coba lagi">
              <Text style={styles.retryText}>Coba lagi</Text>
            </Pressable>
          ) : null}

          {toast ? (
            <View style={styles.toast}>
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          ) : null}
        </ScreenContainer>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray[50] },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  lead: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  yearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  yearChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  yearChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  yearText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[600],
  },
  yearTextActive: { color: colors.primary[700] },
  list: { gap: spacing.sm },
  monthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  monthBody: { flex: 1, gap: 2, minWidth: 0 },
  monthTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textTransform: 'capitalize',
  },
  monthPeriod: { fontSize: 11, color: colors.gray[500] },
  downloadBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtnBusy: {
    backgroundColor: colors.gray[100],
  },
  retryBtn: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
  },
  retryText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  toast: {
    backgroundColor: colors.gray[800],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  toastText: {
    color: colors.white,
    fontSize: typography.size.xs,
    textAlign: 'center',
  },
});
