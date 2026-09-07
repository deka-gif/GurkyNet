import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  PinKeypadPanel,
  AuthBrandHeader,
  AuthSuccessView,
  Button,
} from '../../src/components/ui';
import { authService } from '../../src/services/auth.service';
import { useAuthStore } from '../../src/store/auth.store';
import { parseApiError } from '../../src/api/client';
import { colors, radius, spacing, typography } from '../../src/theme';

type Step = 'phone' | 'enter' | 'confirm' | 'success';

/**
 * Lengkapi registrasi Google — phone + PIN enter/confirm.
 * completeGoogleRegistration + applySession; accept_policies true.
 */
export default function GoogleCompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ google_token?: string }>();
  const googleToken = typeof params.google_token === 'string' ? params.google_token : '';

  const applySession = useAuthStore((s) => s.applySession);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [displayPin, setDisplayPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstPinRef = useRef('');
  const lockRef = useRef(false);

  useEffect(() => {
    if (!googleToken) {
      router.replace('/(auth)/login');
    }
  }, [googleToken, router]);

  const clearPins = () => {
    firstPinRef.current = '';
    setDisplayPin('');
  };

  const goAfterSuccess = async () => {
    router.replace('/(tabs)/home');
  };

  const submitComplete = async (pinValue: string, confirmValue: string) => {
    if (lockRef.current || busy) return;
    if (pinValue !== confirmValue) {
      setError('Konfirmasi PIN tidak cocok.');
      setDisplayPin('');
      setStep('confirm');
      return;
    }
    if (!/^08\d{8,11}$/.test(phone.trim())) {
      setError('Nomor HP harus diawali 08 (10–13 digit).');
      setStep('phone');
      return;
    }
    if (!googleToken) {
      setError('Sesi Google tidak valid. Silakan mulai ulang.');
      return;
    }

    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await authService.completeGoogleRegistration({
        google_token: googleToken,
        phone_number: phone.trim(),
        pin: pinValue,
        pin_confirmation: confirmValue,
        accept_policies: true,
      });
      clearPins();
      if (res.success && res.data?.token) {
        await applySession(res.data.token, res.data.user, phone.trim());
        setStep('success');
        return;
      }
      setError(res.message || 'Gagal menyelesaikan registrasi Google.');
      setStep('phone');
    } catch (err: unknown) {
      clearPins();
      const parsed = parseApiError(err);
      setError(parsed.message || 'Gagal menyelesaikan registrasi Google.');
      if (parsed.errors?.phone_number) {
        setStep('phone');
      } else {
        setStep('enter');
      }
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  if (step === 'success') {
    return (
      <AuthSuccessView
        title="Akun Berhasil Dibuat"
        message="Registrasi Google selesai. Akun GurkyNet kamu siap dipakai."
        buttonLabel="Mulai Sekarang"
        onContinue={() => void goAfterSuccess()}
      />
    );
  }

  if (step === 'enter' || step === 'confirm') {
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
              setStep('phone');
              setError(null);
            }}
            onComplete={(entered) => {
              firstPinRef.current = entered;
              setDisplayPin('');
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
              clearPins();
              setStep('enter');
              setError(null);
            }}
            onComplete={(entered) => {
              void submitComplete(firstPinRef.current, entered);
            }}
            footer={
              <Button
                label="Kembali"
                variant="ghost"
                disabled={busy}
                onPress={() => {
                  clearPins();
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

  return (
    <KeyboardAvoidingView
      style={styles.flexWhite}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AuthBrandHeader subtitle="Lengkapi nomor HP untuk menyelesaikan akun Google" />
        <Text style={styles.heading}>Lengkapi Profil</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Nomor HP</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="08xxxxxxxxxx"
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          label="Lanjut Buat PIN"
          onPress={() => {
            setError(null);
            if (!/^08\d{8,11}$/.test(phone.trim())) {
              setError('Nomor HP harus diawali 08 (10–13 digit).');
              return;
            }
            clearPins();
            setStep('enter');
          }}
          disabled={busy || !phone.trim()}
        />
        <Button
          label="Kembali ke Masuk"
          variant="ghost"
          disabled={busy}
          onPress={() => router.replace('/(auth)/login')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.gray[50] },
  body: { flex: 1, minHeight: 0 },
  flex: { flex: 1 },
  flexWhite: { flex: 1, backgroundColor: colors.white },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing['2xl'],
    gap: spacing.md,
  },
  heading: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
  },
  field: { gap: spacing.xs },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.base,
    backgroundColor: colors.gray[50],
    color: colors.gray[900],
  },
  errorText: {
    fontSize: typography.size.sm,
    color: colors.status.failed,
    backgroundColor: colors.status.failedBg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
