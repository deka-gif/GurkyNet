import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ScreenContainer, Button } from '../../src/components/ui';
import {
  TRANSFER_MIN_AMOUNT,
  useTransferStore,
} from '../../src/store/transfer.store';
import { useWalletStore } from '../../src/store/wallet.store';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function formatDigitsToRupiahDisplay(digits: string): string {
  if (!digits) return '';
  const n = Number(digits);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('id-ID');
}

/**
 * Sesama GurkyPay form.
 * "Selanjutnya" → read-only recipient lookup (never POST transfer).
 */
export default function TransferGurkyPayScreen() {
  const router = useRouter();
  const beginSession = useTransferStore((s) => s.beginSession);
  const destination = useTransferStore((s) => s.destination);
  const setAmount = useTransferStore((s) => s.setAmount);
  const lookupRecipient = useTransferStore((s) => s.lookupRecipient);
  const clearRecipient = useTransferStore((s) => s.clearRecipient);
  const lookupLoading = useTransferStore((s) => s.lookupLoading);
  const lookupError = useTransferStore((s) => s.lookupError);
  const ensureIdempotencyKey = useTransferStore((s) => s.ensureIdempotencyKey);
  const storedAmount = useTransferStore((s) => s.amount);

  const ownOverview = useWalletStore((s) => s.overview?.wallet);
  const ownWallet =
    ownOverview?.gurkyPayId ||
    ownOverview?.gurky_pay_id ||
    ownOverview?.wallet_number ||
    ownOverview?.walletNo ||
    '';

  useEffect(() => {
    if (destination !== 'gurkypay') {
      beginSession('gurkypay');
    }
  }, [destination, beginSession]);

  const [recipientInput, setRecipientInput] = useState('');
  const [amountDigits, setAmountDigits] = useState(
    storedAmount > 0 ? String(storedAmount) : ''
  );
  const [touchedRecipient, setTouchedRecipient] = useState(false);
  const [touchedAmount, setTouchedAmount] = useState(false);
  const [selfWarn, setSelfWarn] = useState<string | null>(null);
  const lockRef = useRef(false);

  const amount = amountDigits ? Number(amountDigits) : 0;
  const recipientOk =
    recipientInput.trim().length >= 3 && /^[0-9]+$/.test(recipientInput.trim());
  const amountOk =
    Number.isFinite(amount) && Number.isInteger(amount) && amount >= TRANSFER_MIN_AMOUNT;

  const recipientError = useMemo(() => {
    if (lookupError) return lookupError;
    if (!touchedRecipient) return null;
    if (!recipientInput.trim()) return 'Masukkan ID / No. Rekening GurkyPay';
    if (!recipientOk) return 'Format ID GurkyPay tidak valid';
    return null;
  }, [touchedRecipient, recipientInput, recipientOk, lookupError]);

  const amountError = useMemo(() => {
    if (!touchedAmount) return null;
    if (!amountDigits) return 'Masukkan nominal transfer';
    if (!amountOk) return `Minimal ${formatIDR(TRANSFER_MIN_AMOUNT)}`;
    return null;
  }, [touchedAmount, amountDigits, amountOk]);

  const canContinue = recipientOk && amountOk && !lookupLoading;

  const onContinue = async () => {
    setTouchedRecipient(true);
    setTouchedAmount(true);
    setSelfWarn(null);
    if (!canContinue || lockRef.current) return;

    if (ownWallet && recipientInput.trim() === String(ownWallet).trim()) {
      setSelfWarn('Anda tidak dapat melakukan transfer ke rekening GurkyPay sendiri.');
    }

    lockRef.current = true;
    clearRecipient();
    setAmount(amount);

    try {
      const result = await lookupRecipient(recipientInput.trim());
      if (!result.ok) return;
      // Idempotency key for the upcoming transfer attempt — after lookup succeeds.
      ensureIdempotencyKey();
      router.push('/transfer/confirm');
    } finally {
      lockRef.current = false;
    }
  };

  return (
    <ScreenContainer belowHeader scroll>
      <Stack.Screen
        options={{ headerShown: true, title: 'Sesama GurkyPay', headerBackTitle: 'Kembali' }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Text style={styles.lead}>Transfer ke Sesama GurkyPay</Text>

        <View style={styles.field}>
          <Text style={styles.label}>ID / No. Rekening GurkyPay</Text>
          <TextInput
            value={recipientInput}
            onChangeText={(t) => {
              setRecipientInput(digitsOnly(t));
              if (lookupError) clearRecipient();
              if (selfWarn) setSelfWarn(null);
            }}
            onBlur={() => setTouchedRecipient(true)}
            placeholder="Masukkan ID GurkyPay"
            placeholderTextColor={colors.gray[400]}
            keyboardType="number-pad"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!lookupLoading}
            style={[styles.input, recipientError ? styles.inputError : null]}
            accessibilityLabel="ID atau nomor rekening GurkyPay"
          />
          {recipientError ? <Text style={styles.error}>{recipientError}</Text> : null}
          {selfWarn && !recipientError ? <Text style={styles.warn}>{selfWarn}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Nominal</Text>
          <View style={[styles.amountRow, amountError ? styles.inputError : null]}>
            <Text style={styles.rpPrefix}>Rp</Text>
            <TextInput
              value={formatDigitsToRupiahDisplay(amountDigits)}
              onChangeText={(t) => setAmountDigits(digitsOnly(t))}
              onBlur={() => setTouchedAmount(true)}
              placeholder="0"
              placeholderTextColor={colors.gray[400]}
              keyboardType="number-pad"
              editable={!lookupLoading}
              style={styles.amountInput}
              accessibilityLabel="Nominal transfer"
            />
          </View>
          {amountError ? <Text style={styles.error}>{amountError}</Text> : null}
          <Text style={styles.hint}>Minimal {formatIDR(TRANSFER_MIN_AMOUNT)}</Text>
        </View>

        <View style={styles.cta}>
          <Button
            label="Selanjutnya"
            onPress={() => void onContinue()}
            disabled={!canContinue}
            loading={lookupLoading}
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lead: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    marginBottom: spacing.lg,
  },
  field: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    color: colors.gray[900],
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
  },
  rpPrefix: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
    marginRight: spacing.xs,
  },
  amountInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    color: colors.gray[900],
  },
  inputError: {
    borderColor: colors.status.failed,
  },
  error: {
    fontSize: typography.size.xs,
    color: colors.status.failed,
  },
  warn: {
    fontSize: typography.size.xs,
    color: colors.status.pending,
  },
  hint: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
  },
  cta: {
    marginTop: spacing.md,
  },
});
