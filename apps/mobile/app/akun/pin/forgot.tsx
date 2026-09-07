import { useCallback, useEffect, useRef, useState } from 'react';
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

type Step = 'email' | 'otp' | 'enter' | 'confirm' | 'success';

/**
 * Lupa PIN — OTP MUST be backend-validated before PIN entry.
 *
 * POST /auth/pin/forgot/request
 * POST /auth/pin/forgot/verify-otp  ← gate (assertValid, does not consume)
 * POST /auth/pin/forgot/confirm     ← consumes OTP + sets PIN
 *
 * Root cause of prior bug: acceptOtp() advanced on 6 digits without API call.
 */
export default function ForgotPinScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(user?.email || '');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());

  const lockRef = useRef(false);
  const otpRef = useRef('');
  const newPinRef = useRef('');
  /** Only true after POST /auth/pin/forgot/verify-otp succeeds. */
  const otpBackendOkRef = useRef(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (resendAt == null) return;
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAt]);

  const resendSecondsLeft =
    resendAt != null ? Math.max(0, Math.ceil((resendAt - nowTs) / 1000)) : 0;

  const clearSensitive = () => {
    otpRef.current = '';
    newPinRef.current = '';
    otpBackendOkRef.current = false;
    setOtp('');
    setPin('');
    setConfirm('');
  };

  const goHome = () => {
    clearSensitive();
    setError(null);
    setInfo(null);
    router.replace('/(tabs)/home');
  };

  /**
   * Map backend/network errors for OTP gate.
   * Never treat route-missing / 404 / 5xx as "OTP salah".
   */
  const mapOtpError = (
    message: string,
    errors?: Record<string, string[]> | null,
    status?: number | string
  ) => {
    const field = errors?.otp?.[0] || errors?.otp_code?.[0] || message;
    const raw = `${field || ''} ${message || ''}`;

    // Deployment / routing — not an OTP mismatch
    if (
      status === 404 ||
      /could not be found|route .* not found|not found/i.test(raw)
    ) {
      return 'Gagal memverifikasi kode. Coba lagi.';
    }
    if (
      status === 429 ||
      (typeof status === 'number' && status >= 500) ||
      status === 'unknown' ||
      /timeout|network|koneksi|server sedang/i.test(raw)
    ) {
      return 'Gagal memverifikasi kode. Coba lagi.';
    }

    if (/kedaluwarsa|expired/i.test(field)) return 'Kode verifikasi sudah kedaluwarsa.';
    if (/tidak valid|salah|tidak ditemukan|sudah digunakan/i.test(field)) {
      return 'Kode verifikasi salah.';
    }
    // Field-level OTP errors only → wrong OTP; otherwise generic verify failure
    if (errors?.otp?.[0] || errors?.otp_code?.[0]) {
      return 'Kode verifikasi salah.';
    }
    return 'Gagal memverifikasi kode. Coba lagi.';
  };

  const onHeaderBack = () => {
    if (busy) return;
    setError(null);
    if (step === 'email') {
      clearSensitive();
      router.back();
      return;
    }
    if (step === 'otp') {
      clearSensitive();
      setInfo(null);
      setResendAt(null);
      setStep('email');
      return;
    }
    if (step === 'enter') {
      newPinRef.current = '';
      setPin('');
      setConfirm('');
      setOtp('');
      otpBackendOkRef.current = false;
      setStep('otp');
      return;
    }
    if (step === 'confirm') {
      setConfirm('');
      setPin('');
      setStep('enter');
      return;
    }
    if (step === 'success') goHome();
  };

  const requestOtp = async () => {
    if (lockRef.current || busy) return;
    if (resendSecondsLeft > 0) return;
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email wajib diisi.');
      return;
    }
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await profileService.requestForgotPin(trimmed);
      if (res.success) {
        // Keep OTP screen clean (PIN-like); no banner that pulls content up.
        setInfo(null);
        setStep('otp');
        setOtp('');
        otpRef.current = '';
        otpBackendOkRef.current = false;
        const at = res.data?.resend_available_at
          ? Date.parse(res.data.resend_available_at)
          : Date.now() + 60_000;
        setResendAt(Number.isFinite(at) ? at : Date.now() + 60_000);
        return;
      }
      setError(res.message || 'Gagal mengirim kode verifikasi.');
    } catch (err: unknown) {
      setError(parseApiError(err).message || 'Gagal mengirim kode verifikasi.');
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  /** P0 — never advance to PIN until backend verify-otp succeeds. */
  const submitOtpGate = async (code: string) => {
    if (lockRef.current || busy) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await profileService.verifyForgotPinOtp({
        email: email.trim(),
        otp_code: code,
      });
      if (res.success && res.data?.verified !== false) {
        otpRef.current = code;
        otpBackendOkRef.current = true;
        setOtp('');
        setPin('');
        setConfirm('');
        setInfo(null);
        setStep('enter');
        return;
      }
      setError(mapOtpError(res.message || '', null));
      setOtp('');
      otpBackendOkRef.current = false;
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      setError(mapOtpError(parsed.message || '', parsed.errors, parsed.status));
      setOtp('');
      otpBackendOkRef.current = false;
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  const finish = async (confirmValue: string) => {
    if (lockRef.current || busy) return;
    const next = newPinRef.current;
    if (next !== confirmValue) {
      setError('PIN baru tidak sama. Silakan coba lagi.');
      setConfirm('');
      return;
    }
    if (!otpBackendOkRef.current || otpRef.current.length !== 6) {
      setError('Kode verifikasi belum tervalidasi. Masukkan ulang kode.');
      clearSensitive();
      setStep('otp');
      return;
    }

    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await profileService.confirmForgotPin({
        email: email.trim(),
        otp_code: otpRef.current,
        pin: next,
        pin_confirmation: confirmValue,
      });
      if (res.success) {
        clearSensitive();
        await fetchUser();
        setStep('success');
        return;
      }
      setError(res.message || 'Gagal mereset PIN.');
      setConfirm('');
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      const msg = parsed.message || 'Gagal mereset PIN.';
      const otpFail =
        !!parsed.errors?.otp_code?.[0] ||
        !!parsed.errors?.otp?.[0] ||
        /otp|kode verifikasi|kedaluwarsa|salah/i.test(msg);
      setError(otpFail ? mapOtpError(msg, parsed.errors, parsed.status) : msg);
      setConfirm('');
      if (otpFail) {
        clearSensitive();
        setStep('otp');
      }
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  const pinSteps = step === 'otp' || step === 'enter' || step === 'confirm';

  return (
    <ScreenContainer belowHeader scroll={step === 'email'}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Lupa PIN',
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

      {step === 'email' ? (
        <View style={styles.form}>
          <Text style={styles.lead}>
            Masukkan email yang terdaftar untuk menerima kode verifikasi.
          </Text>
          <Text style={styles.label}>Email Terdaftar</Text>
          <View style={styles.readonly}>
            <Text style={styles.readonlyText}>{email || '—'}</Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label="Kirim Kode"
            loading={busy}
            disabled={busy || !email.trim()}
            onPress={() => void requestOtp()}
          />
        </View>
      ) : null}

      {pinSteps ? (
        <View style={styles.body}>
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={colors.primary[600]} size="small" />
              <Text style={styles.busyText}>Memproses…</Text>
            </View>
          ) : null}

          {step === 'otp' ? (
            <PinKeypadPanel
              key="otp"
              title="Masukkan kode verifikasi"
              subtitle="Masukkan 6 digit kode yang dikirim ke email kamu"
              value={otp}
              onChange={(v) => {
                setOtp(v);
                setError(null);
              }}
              disabled={busy}
              error={error}
              onClose={onHeaderBack}
              onComplete={(entered) => void submitOtpGate(entered)}
              footer={
                <Pressable
                  onPress={() => void requestOtp()}
                  disabled={busy || resendSecondsLeft > 0}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Kirim ulang kode"
                >
                  <Text
                    style={[
                      styles.resend,
                      (busy || resendSecondsLeft > 0) && styles.resendDisabled,
                    ]}
                  >
                    {resendSecondsLeft > 0
                      ? `Kirim ulang dalam ${resendSecondsLeft} detik`
                      : 'Kirim ulang kode'}
                  </Text>
                </Pressable>
              }
            />
          ) : null}

          {step === 'enter' ? (
            <PinKeypadPanel
              key="enter"
              title="Buat PIN baru"
              subtitle="Buat 6 digit PIN baru kamu"
              value={pin}
              onChange={(v) => {
                setPin(v);
                setError(null);
              }}
              disabled={busy}
              error={error}
              onClose={onHeaderBack}
              onComplete={(entered) => {
                if (!otpBackendOkRef.current) {
                  setError('Kode verifikasi belum tervalidasi.');
                  setStep('otp');
                  return;
                }
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
              key="confirm"
              title="Konfirmasi PIN baru"
              subtitle="Masukkan kembali PIN baru kamu"
              value={confirm}
              onChange={(v) => {
                setConfirm(v);
                setError(null);
              }}
              disabled={busy}
              error={error}
              onClose={onHeaderBack}
              onComplete={(entered) => {
                void finish(entered);
              }}
            />
          ) : null}
        </View>
      ) : null}

      <Modal visible={step === 'success'} transparent animationType="fade">
        <View style={styles.successBackdrop}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={64} color={colors.primary[600]} />
            <Text style={styles.successTitle}>PIN Berhasil Diubah</Text>
            <Text style={styles.successMessage}>
              PIN baru kamu sudah berhasil dibuat.
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
  busyText: { fontSize: typography.size.xs, color: colors.gray[500] },
  info: {
    fontSize: typography.size.sm,
    color: colors.primary[700],
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  form: { gap: spacing.md },
  lead: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    lineHeight: 20,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
  readonly: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.gray[50],
  },
  readonlyText: {
    fontSize: typography.size.md,
    color: colors.gray[600],
  },
  error: {
    fontSize: typography.size.xs,
    color: colors.status.failed,
  },
  resend: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
    paddingVertical: spacing.sm,
  },
  resendDisabled: { opacity: 0.45 },
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
