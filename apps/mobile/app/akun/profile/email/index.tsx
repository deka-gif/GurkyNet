import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  ScreenContainer,
  Button,
  ConfirmSheet,
  PinKeypadPanel,
} from '../../../../src/components/ui';
import { useAuthStore } from '../../../../src/store/auth.store';
import { useProfileChangeStore } from '../../../../src/store/profileChange.store';
import { profileService } from '../../../../src/services/profile.service';
import { parseApiError } from '../../../../src/api/client';
import { colors, radius, spacing, typography } from '../../../../src/theme';

type Step = 'form' | 'pin';

/**
 * Ubah Email — backend SoT (3 steps):
 * 1) request { password, pin, new_email } → OTP to OLD email
 * 2) verify-old → OTP to NEW email
 * 3) verify-new → apply
 */
export default function ChangeEmailScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasPin = !!user?.hasPin;
  const setPendingEmail = useProfileChangeStore((s) => s.setPendingEmail);

  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [warnOpen, setWarnOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim());
  const canContinue =
    emailOk &&
    password.length > 0 &&
    newEmail.trim().toLowerCase() !== (user?.email || '').toLowerCase() &&
    hasPin;

  const openWarn = () => {
    setError(null);
    if (!hasPin) {
      setError('Buat PIN transaksi terlebih dahulu di Keamanan & PIN.');
      return;
    }
    if (!canContinue) {
      setError('Lengkapi email baru dan password akun.');
      return;
    }
    setWarnOpen(true);
  };

  const afterConfirmWarn = () => {
    setWarnOpen(false);
    setPin('');
    setStep('pin');
  };

  const submitRequest = async (pinValue: string) => {
    if (lockRef.current || busy) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await profileService.requestEmailChange({
        password,
        pin: pinValue,
        new_email: newEmail.trim(),
      });
      setPassword('');
      setPin('');
      if (res.success) {
        setPendingEmail(newEmail.trim());
        router.replace('/akun/profile/email/verify-old');
        return;
      }
      setError(res.message || 'Gagal mengirim kode verifikasi.');
      setStep('form');
    } catch (err: unknown) {
      setPassword('');
      setPin('');
      setError(parseApiError(err).message || 'Gagal mengirim kode verifikasi.');
      setStep('form');
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  return (
    <ScreenContainer belowHeader scroll={step === 'form'}>
      <Stack.Screen
        options={{ headerShown: true, title: 'Ubah Email', headerBackTitle: 'Kembali' }}
      />

      {step === 'form' ? (
        <View style={styles.form}>
          <Text style={styles.lead}>
            Perubahan email membutuhkan password, PIN transaksi, lalu kode verifikasi ke email
            lama dan email baru.
          </Text>

          <Text style={styles.label}>Email Terdaftar</Text>
          <TextInput
            value={user?.email || ''}
            editable={false}
            style={[styles.input, styles.readonly]}
          />

          <Text style={styles.label}>Email Baru</Text>
          <TextInput
            value={newEmail}
            onChangeText={(t) => {
              setNewEmail(t);
              setError(null);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            placeholder="email.baru@contoh.com"
            placeholderTextColor={colors.gray[400]}
            style={styles.input}
            editable={!busy}
          />
          <Text style={styles.hint}>
            Setelah verifikasi email lama, kode berikutnya dikirim ke email baru.
          </Text>

          <Text style={styles.label}>Password Akun</Text>
          <TextInput
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError(null);
            }}
            secureTextEntry
            placeholder="Password login"
            placeholderTextColor={colors.gray[400]}
            style={styles.input}
            editable={!busy}
            autoCapitalize="none"
          />

          {!hasPin ? (
            <Text style={styles.warn}>
              Kamu belum punya PIN transaksi. Buat PIN di Keamanan & PIN sebelum mengganti email.
            </Text>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Lanjutkan" onPress={openWarn} disabled={!canContinue || busy} />
        </View>
      ) : (
        <PinKeypadPanel
          title="Masukkan PIN"
          subtitle="PIN transaksi untuk mengonfirmasi perubahan"
          value={pin}
          onChange={(v) => {
            setPin(v);
            setError(null);
          }}
          disabled={busy}
          error={error}
          onClose={() => {
            if (busy) return;
            setPin('');
            setStep('form');
            setError(null);
          }}
          onComplete={(entered) => void submitRequest(entered)}
        />
      )}

      <ConfirmSheet
        visible={warnOpen}
        title="Yakin mau ubah email?"
        message="Kamu akan diminta memasukkan PIN, lalu memverifikasi kode yang dikirim ke email lama dan email baru."
        confirmLabel="Ya, Ubah"
        cancelLabel="Batal"
        onConfirm={afterConfirmWarn}
        onCancel={() => setWarnOpen(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  lead: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    lineHeight: 20,
    marginBottom: spacing.xs,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    fontSize: typography.size.md,
    color: colors.gray[900],
  },
  readonly: {
    backgroundColor: colors.gray[50],
    color: colors.gray[500],
  },
  hint: { fontSize: typography.size.xs, color: colors.gray[500], marginTop: -4 },
  warn: {
    fontSize: typography.size.xs,
    color: colors.status.pending,
    backgroundColor: colors.status.pendingBg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  error: { fontSize: typography.size.xs, color: colors.status.failed },
});
