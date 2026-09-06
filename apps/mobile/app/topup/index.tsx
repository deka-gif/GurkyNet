import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletStore } from '../../src/store/wallet.store';
import { useTopUpStore } from '../../src/store/topup.store';
import {
  enabledTopUpMethods,
  fallbackMinAmount,
} from '../../src/services/topup.service';
import { ScreenContainer, LoadingState, ErrorState, Button } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';

function formatDigitsToRupiahDisplay(digits: string): string {
  if (!digits) return '';
  const n = Number(digits);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('id-ID');
}

/**
 * Top Up GurkyPay — FR-USR03. Same APIs as Web.
 * Amount UI is formatted Rupiah; API receives integer digits only.
 */
export default function TopUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const overview = useWalletStore((s) => s.overview);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);

  const config = useTopUpStore((s) => s.config);
  const configLoading = useTopUpStore((s) => s.configLoading);
  const configError = useTopUpStore((s) => s.configError);
  const submitting = useTopUpStore((s) => s.submitting);
  const submitError = useTopUpStore((s) => s.submitError);
  const loadConfig = useTopUpStore((s) => s.loadConfig);
  const beginNewAttempt = useTopUpStore((s) => s.beginNewAttempt);
  const createAndOpenSnap = useTopUpStore((s) => s.createAndOpenSnap);

  const [amountDigits, setAmountDigits] = useState('');
  const [methodId, setMethodId] = useState<string | null>(null);
  const [channel, setChannel] = useState<string | null>(null);
  const [touchedAmount, setTouchedAmount] = useState(false);
  const submittingLock = useRef(false);

  useEffect(() => {
    void fetchWallet();
    void loadConfig();
    beginNewAttempt();
  }, [fetchWallet, loadConfig, beginNewAttempt]);

  const minAmount = fallbackMinAmount(config);
  const methods = useMemo(() => enabledTopUpMethods(config), [config]);

  useEffect(() => {
    if (!methodId && methods.length > 0) {
      setMethodId(methods[0].id);
    }
  }, [methods, methodId]);

  const selectedMethod = methods.find((m) => m.id === methodId) || null;
  const banks = (selectedMethod?.banks || []).filter((b) => b.enabled);
  const outlets = (selectedMethod?.outlets || []).filter((o) => o.enabled);

  useEffect(() => {
    if (methodId === 'va' && banks.length && !banks.some((b) => b.code === channel)) {
      setChannel(banks[0].code);
    } else if (methodId === 'retail' && outlets.length && !outlets.some((o) => o.code === channel)) {
      setChannel(outlets[0].code);
    } else if (methodId === 'qris') {
      setChannel(null);
    }
  }, [methodId, banks, outlets, channel]);

  const amount = amountDigits ? Number(amountDigits) : 0;
  const amountValid =
    Number.isFinite(amount) && Number.isInteger(amount) && amount >= minAmount;
  const amountError =
    touchedAmount && amountDigits.length > 0 && !amountValid
      ? `Minimal ${formatIDR(minAmount)}`
      : touchedAmount && !amountDigits
        ? 'Masukkan nominal Top Up'
        : null;

  const channelOk =
    methodId === 'qris' ||
    (methodId === 'va' && !!channel) ||
    (methodId === 'retail' && !!channel);

  const canSubmit =
    amountValid &&
    !!methodId &&
    channelOk &&
    !submitting &&
    !!config?.configured;

  const onChangeAmount = (text: string) => {
    const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    setAmountDigits(digits.slice(0, 12));
    setTouchedAmount(true);
  };

  const onSubmit = useCallback(async () => {
    setTouchedAmount(true);
    if (!canSubmit || !methodId || submittingLock.current) return;
    submittingLock.current = true;
    try {
      const txId = await createAndOpenSnap({
        amount,
        paymentMethod: methodId,
        channel: methodId === 'qris' ? null : channel,
      });
      if (txId) {
        router.push(`/topup/${txId}`);
      }
    } finally {
      submittingLock.current = false;
    }
  }, [canSubmit, methodId, amount, channel, createAndOpenSnap, router]);

  const methodHint = (id: string) => {
    if (id === 'qris') return 'Bayar dengan QRIS';
    if (id === 'va') return 'Transfer melalui Virtual Account';
    if (id === 'retail') return 'Bayar di gerai retail';
    return 'Bayar via Midtrans Snap';
  };

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
          <Text style={styles.topTitle}>Top Up GurkyPay</Text>
          <View style={{ width: 40 }} />
        </View>

        {configLoading && !config ? (
          <LoadingState label="Memuat metode pembayaran…" />
        ) : configError && !config ? (
          <ErrorState message={configError} onRetry={() => void loadConfig()} />
        ) : (
          <ScreenContainer belowHeader>
            <View style={styles.balanceCompact}>
              <Text style={styles.balanceLabel}>Saldo tersedia</Text>
              <Text style={styles.balanceValue}>{formatIDR(overview?.wallet.balance)}</Text>
            </View>

            <Text style={styles.sectionLabel}>Nominal</Text>
            <View style={[styles.amountBox, amountError ? styles.amountBoxError : null]}>
              <Text style={styles.amountPrefix}>Rp</Text>
              <TextInput
                value={formatDigitsToRupiahDisplay(amountDigits)}
                onChangeText={onChangeAmount}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.gray[400]}
                style={styles.amountInput}
                accessibilityLabel="Nominal top up"
                onBlur={() => setTouchedAmount(true)}
              />
            </View>
            <Text style={styles.hint}>Minimal {formatIDR(minAmount)}</Text>
            {amountError ? <Text style={styles.fieldError}>{amountError}</Text> : null}

            <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Metode pembayaran</Text>
            {!config?.configured ? (
              <Text style={styles.warn}>
                Pembayaran otomatis belum dikonfigurasi. Hubungi admin.
              </Text>
            ) : (
              <View style={styles.methodList}>
                {methods.map((m) => {
                  const active = methodId === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setMethodId(m.id)}
                      style={[styles.methodRow, active && styles.methodRowActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <View style={[styles.methodIcon, active && styles.methodIconActive]}>
                        <Ionicons
                          name={
                            m.id === 'qris'
                              ? 'qr-code-outline'
                              : m.id === 'va'
                                ? 'card-outline'
                                : 'storefront-outline'
                          }
                          size={20}
                          color={active ? colors.primary[700] : colors.primary[600]}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.methodTitle}>{m.label}</Text>
                        <Text style={styles.methodSub}>{methodHint(m.id)}</Text>
                      </View>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={22} color={colors.primary[600]} />
                      ) : (
                        <View style={styles.checkPlaceholder} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {methodId === 'va' && banks.length > 0 ? (
              <View style={styles.channelWrap}>
                <Text style={styles.channelLabel}>Pilih bank</Text>
                <View style={styles.channelRow}>
                  {banks.map((b) => {
                    const active = channel === b.code;
                    return (
                      <Pressable
                        key={b.code}
                        onPress={() => setChannel(b.code)}
                        style={[styles.channelChip, active && styles.channelChipActive]}
                      >
                        <Text style={[styles.channelText, active && styles.channelTextActive]}>
                          {b.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {methodId === 'retail' && outlets.length > 0 ? (
              <View style={styles.channelWrap}>
                <Text style={styles.channelLabel}>Pilih gerai</Text>
                <View style={styles.channelRow}>
                  {outlets.map((o) => {
                    const active = channel === o.code;
                    return (
                      <Pressable
                        key={o.code}
                        onPress={() => setChannel(o.code)}
                        style={[styles.channelChip, active && styles.channelChipActive]}
                      >
                        <Text style={[styles.channelText, active && styles.channelTextActive]}>
                          {o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

            <View style={styles.submitWrap}>
              <Button
                label={submitting ? 'Memproses…' : 'Lanjut Bayar'}
                onPress={() => void onSubmit()}
                disabled={!canSubmit}
                fullWidth
              />
              {submitting ? (
                <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing.sm }} />
              ) : null}
              <Text style={styles.footerHint}>
                Pembayaran dibuka di Midtrans Snap di dalam aplikasi. Menutup halaman pembayaran tidak
                membatalkan transaksi — status mengikuti backend.
              </Text>
            </View>
          </ScreenContainer>
        )}
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
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  balanceCompact: {
    gap: 2,
    paddingBottom: spacing.xs,
  },
  balanceLabel: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
    fontWeight: typography.weight.medium,
  },
  balanceValue: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  sectionLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  amountBoxError: { borderColor: colors.status.failed },
  amountPrefix: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[500],
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
    paddingVertical: spacing.sm,
  },
  hint: { fontSize: 12, color: colors.gray[500] },
  fieldError: { fontSize: 12, color: colors.status.failed, fontWeight: typography.weight.medium },
  methodList: { gap: spacing.sm },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  methodRowActive: {
    borderColor: colors.primary[400],
    backgroundColor: colors.primary[50],
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.gray[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconActive: { backgroundColor: colors.white },
  methodTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  methodSub: { fontSize: 12, color: colors.gray[500], marginTop: 2 },
  checkPlaceholder: { width: 22, height: 22 },
  channelWrap: { gap: spacing.sm },
  channelLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  channelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  channelChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    minHeight: 40,
    justifyContent: 'center',
  },
  channelChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  channelText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
  channelTextActive: { color: colors.primary[700] },
  warn: { fontSize: typography.size.sm, color: colors.status.pending },
  errorText: {
    fontSize: typography.size.sm,
    color: colors.status.failed,
    backgroundColor: colors.status.failedBg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  submitWrap: { gap: spacing.sm, marginBottom: spacing['2xl'], marginTop: spacing.md },
  footerHint: {
    fontSize: 11,
    color: colors.gray[500],
    lineHeight: 16,
  },
});
