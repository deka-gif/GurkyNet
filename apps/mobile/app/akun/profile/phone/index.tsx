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

function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('62') && d.length >= 11) d = `0${d.slice(2)}`;
  if (d.startsWith('8') && !d.startsWith('08')) d = `0${d}`;
  return d.slice(0, 13);
}

type Step = 'form' | 'pin';

/**
 * Ubah Nomor HP — backend SoT:
 * POST /account-security/phone/change/request { password, pin, new_phone }
 * OTP dikirim ke EMAIL akun (bukan WhatsApp ke nomor baru).
 * Confirm: /akun/profile/phone/verify
 */
export default function ChangePhoneScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasPin = !!user?.hasPin;
  const setPendingPhone = useProfileChangeStore((s) => s.setPendingPhone);

  const [newPhone, setNewPhone] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [warnOpen, setWarnOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);

  const phoneOk = /^08[0-9]{8,11}$/.test(newPhone);
  const canContinue =
    phoneOk && password.length > 0 && newPhone !== (user?.phone || '') && hasPin;

  const openWarn = () => {
    setError(null);
    if (!hasPin) {
      setError('Buat PIN transaksi terlebih dahulu di Keamanan & PIN.');
      return;
    }
    if (!canContinue) {
      setError('Lengkapi nomor baru dan password akun.');
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
      const res = await profileService.requestPhoneChange({
        password,
        pin: pinValue,
        new_phone: newPhone,
      });
      // Clear secrets from memory ASAP
      setPassword('');
      setPin('');
      if (res.success) {
        setPendingPhone(newPhone);
        router.replace('/akun/profile/phone/verify');
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
        options={{ headerShown: true, title: 'Ubah Nomor HP', headerBackTitle: 'Kembali' }}
      />

      {step === 'form' ? (
        <View style={styles.form}>
          <Text style={styles.lead}>
            Perubahan nomor HP membutuhkan password, PIN transaksi, dan kode verifikasi yang
            dikirim ke email akun kamu.
          </Text>

          <Text style={styles.label}>Nomor HP Terdaftar</Text>
          <View style={styles.readonly}>
            <Text style={styles.prefix}>+62</Text>
            <Text style={styles.readonlyValue}>
              {(user?.phone || '').replace(/^0/, '') || '—'}
            </Text>
          </View>

          <Text style={styles.label}>Nomor HP Baru</Text>
          <View style={styles.phoneRow}>
            <Text style={styles.prefix}>+62</Text>
            <TextInput
              value={newPhone.startsWith('0') ? newPhone.slice(1) : newPhone}
              onChangeText={(t) => {
                const n = normalizePhone(t.startsWith('0') ? t : `0${t}`);
                setNewPhone(n);
                setError(null);
              }}
              keyboardType="phone-pad"
              placeholder="812xxxxxxx"
              placeholderTextColor={colors.gray[400]}
              style={styles.phoneInput}
              editable={!busy}
            />
          </View>
          <Text style={styles.hint}>Pastikan nomor HP baru aktif dan dapat dihubungi.</Text>

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
              Kamu belum punya PIN transaksi. Buat PIN di Keamanan & PIN sebelum mengganti nomor HP.
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
          onComplete={(entered) => void submitRequest(entered)}
        />
      )}

      <ConfirmSheet
        visible={warnOpen}
        title="Yakin mau ubah nomor HP?"
        message="Perubahan nomor HP membutuhkan verifikasi. Kode akan dikirim ke email akun kamu setelah kamu memasukkan PIN transaksi."
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
  readonly: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  readonlyValue: {
    fontSize: typography.size.md,
    color: colors.gray[500],
    fontWeight: typography.weight.medium,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  prefix: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
  phoneInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    color: colors.gray[900],
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
