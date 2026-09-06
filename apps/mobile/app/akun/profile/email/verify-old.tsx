import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ScreenContainer, Button } from '../../../../src/components/ui';
import { useAuthStore } from '../../../../src/store/auth.store';
import { useProfileChangeStore } from '../../../../src/store/profileChange.store';
import { profileService } from '../../../../src/services/profile.service';
import { parseApiError } from '../../../../src/api/client';
import { colors, radius, spacing, typography } from '../../../../src/theme';

function maskEmail(email: string): string {
  const [left, right] = email.split('@');
  if (!right) return '***';
  return `${(left || '').slice(0, 2)}***@${right}`;
}

/** Email change step 2 — OTP on OLD email, then OTP issued to NEW email. */
export default function VerifyEmailOldScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const pendingEmail = useProfileChangeStore((s) => s.pendingEmail);

  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);

  useEffect(() => {
    if (!pendingEmail) router.replace('/akun/profile/email');
  }, [pendingEmail, router]);

  const confirm = async () => {
    if (lockRef.current || busy || !pendingEmail || otp.length !== 6) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await profileService.verifyEmailChangeOld({
        otp_code: otp,
        new_email: pendingEmail,
      });
      setOtp('');
      if (res.success) {
        router.replace('/akun/profile/email/verify-new');
        return;
      }
      setError(res.message || 'Verifikasi gagal.');
    } catch (err: unknown) {
      setOtp('');
      setError(parseApiError(err).message || 'Verifikasi gagal.');
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  return (
    <ScreenContainer belowHeader>
      <Stack.Screen
        options={{ headerShown: true, title: 'Verifikasi Email Lama', headerBackTitle: 'Kembali' }}
      />

      <Text style={styles.lead}>
        Masukkan kode yang dikirim ke email lama{' '}
        {user?.email ? maskEmail(user.email) : 'akun kamu'}.
      </Text>

      <Text style={styles.label}>Kode verifikasi</Text>
      <TextInput
        value={otp}
        onChangeText={(t) => {
          setOtp(t.replace(/\D/g, '').slice(0, 6));
          setError(null);
        }}
        keyboardType="number-pad"
        placeholder="••••••"
        placeholderTextColor={colors.gray[400]}
        style={styles.input}
        maxLength={6}
        editable={!busy}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.cta}>
        <Button
          label="Lanjut"
          onPress={() => void confirm()}
          loading={busy}
          disabled={otp.length !== 6 || busy}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    fontSize: typography.size.lg,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.gray[900],
  },
  error: {
    fontSize: typography.size.xs,
    color: colors.status.failed,
    marginTop: spacing.sm,
  },
  cta: { marginTop: spacing.lg },
});
