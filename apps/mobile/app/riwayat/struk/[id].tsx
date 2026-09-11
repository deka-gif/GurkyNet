import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { transactionService, ReceiptData } from '../../../src/services/transaction.service';
import {
  ScreenContainer,
  Button,
  LoadingState,
  ErrorState,
} from '../../../src/components/ui';
import { ThermalReceiptPaper } from '../../../src/components/receipt/ThermalReceiptPaper';
import { useAuthStore } from '../../../src/store/auth.store';
import { composeLiveReceiptDocument } from '../../../src/utils/shareReceiptFlow';
import { runPrintReceiptFlow } from '../../../src/utils/printReceiptFlow';
import type { ReceiptLine } from '../../../src/utils/receiptPrint';
import {
  receiptSettingsService,
  type PaperWidthMm,
} from '../../../src/services/receiptSettings.service';
import { colors, radius, spacing, typography } from '../../../src/theme';

/**
 * Dedicated Struk page — live Profil Toko + Template + receipt API + paper width.
 * Opening this screen never talks to the printer; PRINT does.
 */
export default function StrukScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const userName = useAuthStore((s) => s.user?.name);

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [paperWidthMm, setPaperWidthMm] = useState<PaperWidthMm>(58);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printMsg, setPrintMsg] = useState<string | null>(null);

  const applyDocument = useCallback(
    async (data: ReceiptData) => {
      const doc = await composeLiveReceiptDocument(data, userName);
      setLines(doc.lines);
      setPaperWidthMm(doc.paperWidthMm);
    },
    [userName]
  );

  const load = useCallback(async () => {
    if (!id) {
      setError('Transaksi tidak ditemukan.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await transactionService.getReceipt(id);
      if (!res.success || !res.data) {
        setReceipt(null);
        setLines([]);
        setError(res.message || 'Struk tidak tersedia.');
        return;
      }
      setReceipt(res.data);
      await applyDocument(res.data);
    } catch (err: any) {
      setReceipt(null);
      setLines([]);
      setError(err?.message || 'Gagal memuat struk.');
    } finally {
      setLoading(false);
    }
  }, [id, applyDocument]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onPaperWidth = async (next: PaperWidthMm) => {
    if (!receipt || next === paperWidthMm) return;
    try {
      await receiptSettingsService.setPaperWidth(next);
      await applyDocument(receipt);
    } catch (err: any) {
      setPrintMsg(err?.message || 'Gagal mengubah lebar kertas.');
    }
  };

  const onPrint = async () => {
    if (!receipt || printing) return;
    setPrinting(true);
    setPrintMsg(null);
    try {
      await applyDocument(receipt);
      await runPrintReceiptFlow({
        receipt,
        userName,
        router,
        onMessage: setPrintMsg,
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <ScreenContainer belowHeader scroll>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Struk',
          headerBackTitle: 'Kembali',
        }}
      />

      {loading && !receipt ? (
        <LoadingState label="Memuat struk..." />
      ) : error && !receipt ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !receipt || lines.length === 0 ? (
        <ErrorState message="Struk tidak tersedia." onRetry={() => void load()} />
      ) : (
        <>
          <Text style={styles.hint}>
            Profil Toko & Template aktif. Ubah lebar kertas di sini atau di Akun → Printer.
          </Text>

          <View style={styles.widthRow}>
            {([58, 80] as PaperWidthMm[]).map((w) => {
              const active = paperWidthMm === w;
              return (
                <Pressable
                  key={w}
                  onPress={() => void onPaperWidth(w)}
                  style={[styles.widthChip, active && styles.widthChipActive]}
                >
                  <Text style={[styles.widthChipText, active && styles.widthChipTextActive]}>
                    {w} mm
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ThermalReceiptPaper lines={lines} paperWidthMm={paperWidthMm} />

          <View style={styles.footer}>
            <Button
              label={printing ? 'Mencetak…' : 'PRINT'}
              onPress={() => void onPrint()}
              loading={printing}
              disabled={printing}
              icon={
                printing ? undefined : (
                  <Ionicons name="print-outline" size={22} color={colors.white} />
                )
              }
            />
            {printMsg ? <Text style={styles.printMsg}>{printMsg}</Text> : null}
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
    lineHeight: 16,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  widthRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  widthChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: colors.white,
  },
  widthChipActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  widthChipText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
  widthChipTextActive: { color: colors.primary[700] },
  footer: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  printMsg: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    textAlign: 'center',
    lineHeight: 20,
  },
});
