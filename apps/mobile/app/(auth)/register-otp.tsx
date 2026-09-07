import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer, PinKeypadPanel, AuthBrandHeader } from '../../src/components/ui';
import { authService } from '../../src/services/auth.service';
import { parseApiError } from '../../src/api/client';
import { colors, typography } from '../../src/theme';

/**
 * Verifikasi email OTP onboarding.
 * onComplete MUST call POST /auth/otp/verify — never advance on length===6 alone.
 */
export default function RegisterOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ onboarding_id?: string; email?: string }>();
  const onboardingId = Number(params.onboarding_id);
  const email = typeof params.email === 'string' ? params.email : '';

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const lockRef = useRef(false);

  useEffect(() => {
    if (!onboardingId || !email) {
      router.replace('/(auth)/register');
    }
  }, [onboardingId, email, router]);

  useEffect(() => {
    if (resendAt == null) return;
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAt]);

  const resendSecondsLeft =
    resendAt != null ? Math.max(0, Math.ceil((resendAt - nowTs) / 1000)) : 0;

  const verifyOtp = async (code: string) => {
    if (lockRef.current || busy) return;
    if (!onboardingId) {
      setError('Sesi registrasi tidak valid. Silakan daftar ulang.');
      return;
    }
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await authService.verifyOnboardingOtp({
        onboarding_id: onboardingId,
        code,
      });
      if (res.success) {
        setOtp('');
        router.replace({
          pathname: '/(auth)/register-pin',
          params: { onboarding_id: String(onboardingId) },
        });
        return;
      }
      setOtp('');
      setError(res.message || 'Kode verifikasi salah.');
    } catch (err: unknown) {
      setOtp('');
      const parsed = parseApiError(err);
      setError(parsed.message || 'Kode verifikasi salah.');
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  const resendOtp = async () => {
    if (busy || resendSecondsLeft > 0 || !email) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authService.resendOnboardingOtp({ email });
      if (res.success) {
        const at = res.data?.resend_available_at
          ? Date.parse(res.data.resend_available_at)
          : Date.now() + 60_000;
        setResendAt(Number.isFinite(at) ? at : Date.now() + 60_000);
        setOtp('');
      } else {
        setError(res.message || 'Gagal mengirim ulang OTP.');
      }
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      setError(parsed.message || 'Gagal mengirim ulang OTP.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer scroll={false} padded>
      <View style={styles.body}>
        <AuthBrandHeader compact />
        <PinKeypadPanel
          title="Verifikasi Email"
          subtitle={`Kode OTP 6 digit telah dikirim ke ${email || 'email kamu'}. Masukkan kode untuk melanjutkan.`}
          value={otp}
          onChange={(v) => {
            setOtp(v);
            setError(null);
          }}
          disabled={busy}
          error={error}
          onClose={() => {
            if (busy) return;
            if (router.canGoBack()) router.back();
            else router.replace('/(auth)/register');
          }}
          onComplete={(code) => void verifyOtp(code)}
          footer={
            <Pressable
              onPress={() => void resendOtp()}
              disabled={busy || resendSecondsLeft > 0}
              hitSlop={8}
            >
              <Text
                style={[
                  styles.resend,
                  (busy || resendSecondsLeft > 0) && styles.resendDisabled,
                ]}
              >
                {resendSecondsLeft > 0
                  ? `Kirim ulang dalam ${resendSecondsLeft}d`
                  : 'Kirim ulang kode'}
              </Text>
            </Pressable>
          }
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, minHeight: 0 },
  resend: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
  },
  resendDisabled: { color: colors.gray[400] },
});
