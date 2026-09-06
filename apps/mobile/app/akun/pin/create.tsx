import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ScreenContainer, Button, PinKeypadPanel } from '../../../src/components/ui';
import { useAuthStore } from '../../../src/store/auth.store';
import { profileService } from '../../../src/services/profile.service';
import { parseApiError } from '../../../src/api/client';
import { colors, spacing, typography } from '../../../src/theme';

type Step = 'enter' | 'confirm';

/**
 * Buat PIN transaksi — POST /pin/create { pin, pin_confirmation }.
 * PIN only in local state. Refresh hasPin via fetchUser.
 */
export default function CreatePinScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  const [step, setStep] = useState<Step>('enter');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lockRef = useRef(false);
  const firstPinRef = useRef('');

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (user?.hasPin) {
      router.replace('/akun/pin/change');
    }
  }, [user?.hasPin, router]);

  const submit = async (pinValue: string, confirmValue: string) => {
    if (lockRef.current || busy) return;
    if (pinValue !== confirmValue) {
      setError('Konfirmasi PIN tidak cocok.');
      setConfirm('');
      setStep('confirm');
      return;
    }
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await profileService.createPin(pinValue, confirmValue);
      if (res.success) {
        firstPinRef.current = '';
        setPin('');
        setConfirm('');
        await fetchUser();
        router.replace('/akun/security');
        return;
      }
      setError(res.message || 'Gagal membuat PIN.');
      setStep('enter');
      setPin('');
      setConfirm('');
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      setError(parsed.message || 'Gagal membuat PIN.');
      setStep('enter');
      setPin('');
      setConfirm('');
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  return (
    <ScreenContainer belowHeader scroll={false}>
      <Stack.Screen
        options={{ headerShown: true, title: 'Buat PIN', headerBackTitle: 'Kembali' }}
      />

      <Text style={styles.lead}>PIN 6 digit untuk otorisasi transaksi.</Text>

      {step === 'enter' ? (
        <PinKeypadPanel
          title="Masukkan PIN"
          subtitle="Masukkan 6 digit PIN kamu"
          value={pin}
          onChange={(v) => {
            setPin(v);
            setError(null);
          }}
          disabled={busy}
          error={error}
          onComplete={(entered) => {
            firstPinRef.current = entered;
            setPin('');
            setConfirm('');
            setStep('confirm');
            setError(null);
          }}
        />
      ) : (
        <View style={styles.flex}>
          <PinKeypadPanel
            title="Konfirmasi PIN"
            subtitle="Ulangi 6 digit PIN yang sama"
            value={confirm}
            onChange={(v) => {
              setConfirm(v);
              setError(null);
            }}
            disabled={busy}
            error={error}
            onComplete={(entered) => {
              void submit(firstPinRef.current, entered);
            }}
          />
          <Button
            label="Kembali"
            variant="ghost"
            disabled={busy}
            onPress={() => {
              firstPinRef.current = '';
              setPin('');
              setConfirm('');
              setStep('enter');
              setError(null);
            }}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  flex: { flex: 1 },
});
