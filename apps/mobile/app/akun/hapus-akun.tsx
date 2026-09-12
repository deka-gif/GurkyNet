import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  ScreenContainer,
  LoadingState,
  PinConfirmModal,
  Button,
} from '../../src/components/ui';
import { useAuthStore } from '../../src/store/auth.store';
import { profileService } from '../../src/services/profile.service';
import { parseApiError } from '../../src/api/client';
import { clearTransactionPinVault } from '../../src/utils/transactionPinVault';
import { colors, radius, spacing, typography } from '../../src/theme';

const REASON_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'too_expensive', label: 'Biaya / harga kurang sesuai' },
  { code: 'switching_app', label: 'Pindah ke aplikasi lain' },
  { code: 'privacy', label: 'Privasi / data pribadi' },
  { code: 'unused', label: 'Tidak lagi memakai akun' },
  { code: 'other', label: 'Lainnya' },
];

function formatSchedule(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Hapus akun — 30 hari pending_deletion (Owner-approved).
 * PIN 2× untuk ajukan; PIN 1× untuk batalkan. Mobile fase 1 only.
 */
export default function HapusAkunScreen() {
  const router = useRouter();
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const user = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);

  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [pinStep, setPinStep] = useState<'idle' | 'first' | 'confirm' | 'cancel'>('idle');
  const [pinError, setPinError] = useState<string | null>(null);
  const firstPinRef = useRef('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchUser();
      const res = await profileService.getAccountDeletion();
      if (res.success && res.data) {
        setStatus(res.data.status);
        setScheduledFor(res.data.scheduled_for);
      } else {
        setStatus(user?.deletionStatus ?? null);
        setScheduledFor(user?.deletionScheduledFor ?? null);
      }
    } catch (err: unknown) {
      setError(parseApiError(err).message || 'Gagal memuat status.');
    } finally {
      setLoading(false);
    }
  }, [fetchUser, user?.deletionStatus, user?.deletionScheduledFor]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = status === 'pending_deletion';

  const startRequest = () => {
    setError(null);
    if (!reasonCode) {
      setError('Pilih alasan penghapusan.');
      return;
    }
    if (reasonCode === 'other' && reasonText.trim().length < 5) {
      setError('Jelaskan alasan lainnya (minimal 5 karakter).');
      return;
    }
    const balance = Number(user?.wallet?.balance ?? 0);
    if (balance > 0) {
      Alert.alert(
        'Saldo masih ada',
        'Saldo wallet harus Rp0 sebelum mengajukan hapus akun. Habiskan atau tarik saldo terlebih dahulu.'
      );
      return;
    }
    firstPinRef.current = '';
    setPinError(null);
    setPinStep('first');
  };

  const submitRequest = async (pin: string, pinConfirmation: string) => {
    setBusy(true);
    setPinError(null);
    try {
      const res = await profileService.requestAccountDeletion({
        reason_code: reasonCode!,
        reason_text: reasonCode === 'other' ? reasonText.trim() : undefined,
        pin,
        pin_confirmation: pinConfirmation,
      });
      if (!res.success) {
        setPinError(res.message || 'Gagal mengajukan hapus akun.');
        return;
      }
      await clearTransactionPinVault();
      await fetchUser();
      setPinStep('idle');
      setStatus(res.data?.status ?? 'pending_deletion');
      setScheduledFor(res.data?.scheduled_for ?? null);
      Alert.alert(
        'Penghapusan dijadwalkan',
        `Akun akan dihapus permanen pada ${formatSchedule(res.data?.scheduled_for)}. Kamu masih bisa membatalkan sebelum tanggal tersebut.`
      );
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      setPinError(parsed.message || 'Gagal mengajukan hapus akun.');
    } finally {
      setBusy(false);
    }
  };

  const onPinSubmit = async (pin: string) => {
    if (pinStep === 'first') {
      firstPinRef.current = pin;
      setPinStep('confirm');
      setPinError(null);
      return;
    }
    if (pinStep === 'confirm') {
      if (pin !== firstPinRef.current) {
        setPinError('PIN konfirmasi tidak cocok. Masukkan ulang.');
        firstPinRef.current = '';
        setPinStep('first');
        return;
      }
      await submitRequest(firstPinRef.current, pin);
      return;
    }
    if (pinStep === 'cancel') {
      setBusy(true);
      setPinError(null);
      try {
        const res = await profileService.cancelAccountDeletion({ pin });
        if (!res.success) {
          setPinError(res.message || 'Gagal membatalkan.');
          return;
        }
        await fetchUser();
        setPinStep('idle');
        setStatus(null);
        setScheduledFor(null);
        Alert.alert('Dibatalkan', 'Penghapusan akun dibatalkan. Akun kembali aktif.');
      } catch (err: unknown) {
        setPinError(parseApiError(err).message || 'Gagal membatalkan.');
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <ScreenContainer belowHeader scroll>
      <Stack.Screen
        options={{ headerShown: true, title: 'Hapus Akun', headerBackTitle: 'Kembali' }}
      />

      {loading ? (
        <LoadingState label="Memuat..." />
      ) : pending ? (
        <View style={styles.block}>
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>Akun terjadwal dihapus</Text>
            <Text style={styles.warnBody}>
              Penghapusan permanen dijadwalkan pada{' '}
              <Text style={styles.warnEm}>{formatSchedule(scheduledFor)}</Text>. Selama masa
              tunggu, transaksi baru (beli, transfer, top up, withdraw) diblokir. Kamu masih bisa
              login untuk membatalkan.
            </Text>
          </View>
          <Button
            label="Batalkan Penghapusan"
            onPress={() => {
              setPinError(null);
              setPinStep('cancel');
            }}
            disabled={busy}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={styles.lead}>
            Menghapus akun akan menjadwalkan penghapusan permanen setelah 30 hari. Saldo harus
            Rp0 dan tidak boleh ada transaksi yang masih diproses.
          </Text>

          <Text style={styles.sectionLabel}>Alasan penghapusan</Text>
          <View style={styles.card}>
            {REASON_OPTIONS.map((opt, idx) => {
              const selected = reasonCode === opt.code;
              return (
                <Pressable
                  key={opt.code}
                  onPress={() => setReasonCode(opt.code)}
                  style={[
                    styles.reasonRow,
                    idx > 0 && styles.reasonBorder,
                    selected && styles.reasonSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.reasonLabel, selected && styles.reasonLabelOn]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {reasonCode === 'other' ? (
            <TextInput
              style={styles.textArea}
              placeholder="Jelaskan alasanmu..."
              placeholderTextColor={colors.gray[400]}
              value={reasonText}
              onChangeText={setReasonText}
              multiline
              maxLength={500}
            />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label="Lanjut hapus akun"
            variant="danger"
            onPress={startRequest}
            disabled={busy}
          />
        </View>
      )}

      <PinConfirmModal
        visible={pinStep !== 'idle'}
        title={
          pinStep === 'cancel'
            ? 'Batalkan penghapusan'
            : pinStep === 'confirm'
              ? 'Ulangi PIN'
              : 'Masukkan PIN'
        }
        subtitle={
          pinStep === 'cancel'
            ? 'Masukkan PIN untuk membatalkan penghapusan akun'
            : pinStep === 'confirm'
              ? 'Masukkan ulang PIN yang sama untuk konfirmasi'
              : 'Masukkan 6 digit PIN transaksi'
        }
        loading={busy}
        error={pinError}
        hideForgotPin
        enableTransactionBiometric={false}
        onClose={() => {
          if (busy) return;
          setPinStep('idle');
          setPinError(null);
          firstPinRef.current = '';
        }}
        onEditing={() => setPinError(null)}
        onSubmit={(pin) => void onPinSubmit(pin)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md, paddingBottom: spacing.xl },
  lead: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    overflow: 'hidden',
  },
  reasonRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  reasonBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[100],
  },
  reasonSelected: {
    backgroundColor: colors.primary[50],
  },
  reasonLabel: {
    fontSize: typography.size.base,
    color: colors.gray[800],
  },
  reasonLabelOn: {
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
  },
  textArea: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.size.sm,
    color: colors.gray[900],
    textAlignVertical: 'top',
    backgroundColor: colors.white,
  },
  warnCard: {
    backgroundColor: colors.status.pendingBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.status.pending,
  },
  warnTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  warnBody: {
    fontSize: typography.size.sm,
    color: colors.gray[700],
    lineHeight: 20,
  },
  warnEm: { fontWeight: typography.weight.bold },
  error: {
    fontSize: typography.size.sm,
    color: colors.status.failed,
    backgroundColor: colors.status.failedBg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
