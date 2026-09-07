import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PinKeypadPanel, Button } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/auth.store';
import { colors } from '../../src/theme';

type Step = 'enter' | 'confirm';

/**
 * Buat PIN onboarding — checkout master PIN UI via PinKeypadPanel → PinConfirmModal.
 * PIN only in local refs. Success → register-success.
 */
export default function RegisterPinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ onboarding_id?: string }>();
  const onboardingId = Number(params.onboarding_id);

  const finalizeRegistration = useAuthStore((s) => s.finalizeRegistration);
  const loading = useAuthStore((s) => s.loading);
  const storeError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [step, setStep] = useState<Step>('enter');
  const [error, setError] = useState<string | null>(null);
  const firstPinRef = useRef('');
  const lockRef = useRef(false);

  useEffect(() => {
    if (!onboardingId) {
      router.replace('/(auth)/register');
    }
  }, [onboardingId, router]);

  const submit = async (pinValue: string, confirmValue: string) => {
    if (lockRef.current || loading) return;
    if (pinValue !== confirmValue) {
      setError('PIN tidak sama.');
      setStep('confirm');
      return;
    }
    if (!onboardingId) {
      setError('Sesi registrasi tidak valid. Silakan daftar ulang.');
      return;
    }

    lockRef.current = true;
    clearError();
    setError(null);
    try {
      const ok = await finalizeRegistration({
        onboarding_id: onboardingId,
        pin: pinValue,
        pin_confirmation: confirmValue,
      });
      firstPinRef.current = '';
      if (ok) {
        router.replace('/(auth)/register-success');
        return;
      }
      setError(useAuthStore.getState().error || 'Gagal menyelesaikan registrasi.');
      setStep('enter');
    } finally {
      lockRef.current = false;
    }
  };

  const displayError = error || storeError;

  return (
    <View style={styles.fill}>
      {step === 'enter' ? (
        <PinKeypadPanel
          key="enter"
          title="Buat PIN"
          subtitle="Gunakan 6 digit PIN untuk mengamankan akun kamu."
          disabled={loading}
          error={displayError}
          onChange={() => {
            setError(null);
            clearError();
          }}
          onClose={() => {
            if (loading) return;
            if (router.canGoBack()) router.back();
            else router.replace('/(auth)/register');
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
          disabled={loading}
          error={displayError}
          onChange={() => {
            setError(null);
            clearError();
          }}
          onClose={() => {
            if (loading) return;
            firstPinRef.current = '';
            setStep('enter');
            setError(null);
            clearError();
          }}
          onComplete={(entered) => {
            void submit(firstPinRef.current, entered);
          }}
          footer={
            <Button
              label="Kembali"
              variant="ghost"
              disabled={loading}
              onPress={() => {
                firstPinRef.current = '';
                setStep('enter');
                setError(null);
                clearError();
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
