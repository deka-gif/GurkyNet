import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, Button, PinKeypadPanel } from '../../../src/components/ui';
import { useAuthStore } from '../../../src/store/auth.store';
import { profileService } from '../../../src/services/profile.service';
import { parseApiError } from '../../../src/api/client';
import { colors, radius, spacing, typography } from '../../../src/theme';

type Step = 'old' | 'enter' | 'confirm' | 'success';

/**
 * Ubah PIN Mobile — old-PIN-only (tanpa OTP email).
 * PUT /pin/change { old_pin, pin, pin_confirmation }
 * Web tetap boleh memakai /account-security/pin/change/* (OTP).
 *
 * UX: 6 bulatan + keypad GurkyPay, auto-submit digit ke-6.
 * PIN hanya di local state/ref — tidak di Zustand/SecureStore/log.
 * Tidak menyentuh PinConfirmModal checkout/transfer.
 */
export default function ChangePinScreen() {
  const router = useRouter();
  const fetchUser = useAuthStore((s) => s.fetchUser);

  const [step, setStep] = useState<Step>('old');
  const [oldPin, setOldPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lockRef = useRef(false);
  const oldPinRef = useRef('');
  const newPinRef = useRef('');

  const clearSensitive = () => {
    oldPinRef.current = '';
    newPinRef.current = '';
    setOldPin('');
    setPin('');
    setConfirm('');
  };

  const goHome = () => {
    clearSensitive();
    setError(null);
    router.replace('/(tabs)/home');
  };

  const onHeaderBack = () => {
    if (busy) return;
    setError(null);
    if (step === 'old') {
      clearSensitive();
      router.back();
      return;
    }
    if (step === 'enter') {
      newPinRef.current = '';
      setPin('');
      setConfirm('');
      setOldPin('');
      setStep('old');
      return;
    }
    if (step === 'confirm') {
      setConfirm('');
      setPin('');
      setStep('enter');
      return;
    }
    if (step === 'success') {
      goHome();
    }
  };

  /** Step 1 — hold old PIN in memory, advance to create new PIN. */
  const acceptOldPin = (entered: string) => {
    oldPinRef.current = entered;
    setOldPin('');
    setPin('');
    setConfirm('');
    setError(null);
    setStep('enter');
  };

  /** Step 3 — match confirm, then PUT /pin/change (authoritative old-PIN check). */
  const submitChange = async (confirmValue: string) => {
    if (lockRef.current || busy) return;

    const next = newPinRef.current;
    if (next !== confirmValue) {
      setError('PIN baru tidak sama. Silakan coba lagi.');
      setConfirm('');
      return;
    }
    if (oldPinRef.current && next === oldPinRef.current) {
      setError('PIN baru harus berbeda dari PIN lama.');
      setConfirm('');
      setPin('');
      newPinRef.current = '';
      setStep('enter');
      return;
    }

    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await profileService.changePin(
        oldPinRef.current,
        next,
        confirmValue
      );
      if (res.success) {
        clearSensitive();
        await fetchUser();
        setStep('success');
        return;
      }
      handleChangeFailure(res.message || 'Gagal mengubah PIN.', res);
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      handleChangeFailure(parsed.message || 'Gagal mengubah PIN.', parsed);
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  const handleChangeFailure = (
    message: string,
    payload?: { errors?: Record<string, string[]> | null }
  ) => {
    const oldPinErr = payload?.errors?.old_pin?.[0];
    const isOldPinFail =
      !!oldPinErr ||
      /pin lama|old_pin|tidak sesuai|salah/i.test(message);

    clearSensitive();
    setConfirm('');
    setPin('');
    setOldPin('');

    if (isOldPinFail) {
      setError('PIN lama salah.');
      setStep('old');
      return;
    }

    setError(message);
    setStep('enter');
  };

  return (
    <ScreenContainer belowHeader scroll={false}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Ubah PIN',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={onHeaderBack}
              disabled={busy && step !== 'success'}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Kembali"
              style={styles.headerBack}
            >
              <Ionicons name="chevron-back" size={24} color={colors.gray[900]} />
            </Pressable>
          ),
        }}
      />

      <View style={styles.body}>
        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color={colors.primary[600]} size="small" />
            <Text style={styles.busyText}>Memproses…</Text>
          </View>
        ) : null}

        {step === 'old' ? (
          <PinKeypadPanel
            title="Masukkan PIN lama"
            subtitle="Masukkan 6 digit PIN lama kamu"
            value={oldPin}
            onChange={(v) => {
              setOldPin(v);
              setError(null);
            }}
            disabled={busy}
            error={error}
            onComplete={(entered) => acceptOldPin(entered)}
          />
        ) : null}

        {step === 'enter' ? (
          <PinKeypadPanel
            title="Buat PIN baru"
            subtitle="Buat 6 digit PIN baru kamu"
            value={pin}
            onChange={(v) => {
              setPin(v);
              setError(null);
            }}
            disabled={busy}
            error={error}
            onComplete={(entered) => {
              newPinRef.current = entered;
              setPin('');
              setConfirm('');
              setError(null);
              setStep('confirm');
            }}
          />
        ) : null}

        {step === 'confirm' ? (
          <PinKeypadPanel
            title="Konfirmasi PIN baru"
            subtitle="Masukkan kembali PIN baru kamu"
            value={confirm}
            onChange={(v) => {
              setConfirm(v);
              setError(null);
            }}
            disabled={busy}
            error={error}
            onComplete={(entered) => {
              void submitChange(entered);
            }}
          />
        ) : null}
      </View>

      <Modal visible={step === 'success'} transparent animationType="fade">
        <View style={styles.successBackdrop}>
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color={colors.primary[600]} />
            </View>
            <Text style={styles.successTitle}>PIN Berhasil Diubah</Text>
            <Text style={styles.successMessage}>
              PIN transaksi kamu sudah berhasil diperbarui.
            </Text>
            <Button label="Selesai" onPress={goHome} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, minHeight: 0 },
  headerBack: {
    paddingHorizontal: spacing.sm,
    marginLeft: spacing.xs,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  busyText: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
  },
  successBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  successCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  successIcon: { marginBottom: spacing.xs },
  successTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
  },
  successMessage: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
});
