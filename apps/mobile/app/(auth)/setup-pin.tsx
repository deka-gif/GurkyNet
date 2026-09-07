import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PinKeypadPanel, AuthSuccessView, Button } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/auth.store';
import { profileService } from '../../src/services/profile.service';
import { parseApiError } from '../../src/api/client';
import { colors } from '../../src/theme';

type Step = 'enter' | 'confirm' | 'success';

/**
 * Setup PIN — checkout master PIN UI. POST /pin/create.
 */
export default function SetupPinScreen() {
  const router = useRouter();
  const fetchUser = useAuthStore((s) => s.fetchUser);

  const [step, setStep] = useState<Step>('enter');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstPinRef = useRef('');
  const lockRef = useRef(false);

  const goHome = useCallback(async () => {
    router.replace('/(tabs)/home');
  }, [router]);

  const submit = async (pinValue: string, confirmValue: string) => {
    if (lockRef.current || busy) return;
    if (pinValue !== confirmValue) {
      setError('PIN tidak sama.');
      setStep('confirm');
      return;
    }

    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await profileService.createPin(pinValue, confirmValue);
      firstPinRef.current = '';
      if (res.success) {
        await fetchUser();
        setStep('success');
        return;
      }
      setError(res.message || 'Gagal membuat PIN.');
      setStep('enter');
    } catch (err: unknown) {
      firstPinRef.current = '';
      const parsed = parseApiError(err);
      setError(parsed.message || 'Gagal membuat PIN.');
      setStep('enter');
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  if (step === 'success') {
    return (
      <AuthSuccessView
        title="PIN Berhasil Dibuat"
        message="PIN transaksi kamu sudah aktif. Gunakan untuk otorisasi pembelian dan transfer."
        buttonLabel="Lanjut ke Beranda"
        onContinue={() => void goHome()}
      />
    );
  }

  return (
    <View style={styles.fill}>
      {step === 'enter' ? (
        <PinKeypadPanel
          key="enter"
          title="Buat PIN"
          subtitle="Gunakan 6 digit PIN untuk mengamankan akun kamu."
          disabled={busy}
          error={error}
          onChange={() => setError(null)}
          onClose={() => {
            if (busy) return;
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/home');
          }}
          onComplete={(entered) => {
            firstPinRef.current = entered;
            setStep('confirm');
            setError(null);
          }}
        />
      ) : (
        <PinKeypadPanel
          key="confirm"
          title="Konfirmasi PIN"
          subtitle="Masukkan kembali PIN kamu."
          disabled={busy}
          error={error}
          onChange={() => setError(null)}
          onClose={() => {
            if (busy) return;
            firstPinRef.current = '';
            setStep('enter');
            setError(null);
          }}
          onComplete={(entered) => {
            void submit(firstPinRef.current, entered);
          }}
          footer={
            <Button
              label="Kembali"
              variant="ghost"
              disabled={busy}
              onPress={() => {
                firstPinRef.current = '';
                setStep('enter');
                setError(null);
              }}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.gray[50] },
});
