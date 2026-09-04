import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { Button } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login, verifyLogin2fa, error, validationErrors, loading, twoFactorChallenge, clearTwoFactorChallenge } = useAuthStore();

  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const handleLogin = async () => {
    const result = await login({ identity: identity.trim(), password });
    if (result === 'ok') {
      router.replace('/(tabs)/home');
    }
    // '2fa' → the twoFactorChallenge state below renders the OTP step.
    // false → `error` from the store is shown below the form.
  };

  const handleVerify2fa = async () => {
    const ok = await verifyLogin2fa(otpCode.trim());
    if (ok) {
      router.replace('/(tabs)/home');
    }
  };

  if (twoFactorChallenge) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Text style={styles.heading}>Verifikasi 2FA</Text>
          <Text style={styles.subheading}>Masukkan kode 6 digit yang dikirim ke {twoFactorChallenge.identifier}.</Text>

          <TextInput
            value={otpCode}
            onChangeText={setOtpCode}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            style={styles.otpInput}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button label="Verifikasi" onPress={handleVerify2fa} loading={loading} disabled={otpCode.length !== 6} />
          <Button label="Kembali" onPress={clearTwoFactorChallenge} variant="ghost" />
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.brandBlock}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>G</Text>
          </View>
          <Text style={styles.brandName}>GurkyPay</Text>
          <Text style={styles.subheading}>Masuk untuk mulai transaksi konter</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email atau Nomor HP</Text>
          <TextInput
            value={identity}
            onChangeText={setIdentity}
            placeholder="email@contoh.com atau 08xxxxxxxxxx"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />
          {validationErrors?.phone_or_email && <Text style={styles.fieldError}>{validationErrors.phone_or_email[0]}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Kata Sandi</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
          {validationErrors?.password && <Text style={styles.fieldError}>{validationErrors.password[0]}</Text>}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button
          label="Masuk"
          onPress={handleLogin}
          loading={loading}
          disabled={!identity.trim() || !password || loading}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  container: { flex: 1, justifyContent: 'center', padding: spacing['2xl'], gap: spacing.lg },
  brandBlock: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg },
  heading: { fontSize: typography.size.xl, fontWeight: typography.weight.black, color: colors.gray[900], textAlign: 'center' },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoText: { color: colors.white, fontSize: typography.size['2xl'], fontWeight: typography.weight.black },
  brandName: { fontSize: typography.size.xl, fontWeight: typography.weight.black, color: colors.gray[900] },
  subheading: { fontSize: typography.size.sm, color: colors.gray[500], textAlign: 'center' },
  field: { gap: spacing.xs },
  label: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[700] },
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
  otpInput: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size['2xl'],
    letterSpacing: 8,
    textAlign: 'center',
    backgroundColor: colors.gray[50],
    color: colors.gray[900],
  },
  fieldError: { fontSize: typography.size.xs, color: colors.status.failed },
  errorText: {
    fontSize: typography.size.sm,
    color: colors.status.failed,
    backgroundColor: colors.status.failedBg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
