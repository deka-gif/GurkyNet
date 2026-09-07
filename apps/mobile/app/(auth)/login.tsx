import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { useWebsiteStore } from '../../src/store/website.store';
import { authService } from '../../src/services/auth.service';
import { storageService } from '../../src/services/storage.service';
import { Button, AuthBrandHeader } from '../../src/components/ui';
import { parseApiError } from '../../src/api/client';
import { colors, radius, spacing, typography } from '../../src/theme';

/**
 * First-time / password login.
 * Returning users are routed to /(auth)/unlock from bootstrap.
 */
export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ google_error?: string | string[] }>();
  const fetchSettings = useWebsiteStore((s) => s.fetchSettings);
  const {
    login,
    verifyLogin2fa,
    applySession,
    error,
    validationErrors,
    loading,
    twoFactorChallenge,
    clearTwoFactorChallenge,
    clearError,
  } = useAuthStore();

  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const lockRef = useRef(false);

  useEffect(() => {
    void fetchSettings();
    void (async () => {
      const remembered = await storageService.getRememberedIdentity();
      if (remembered) setIdentity(remembered);
    })();
  }, [fetchSettings]);

  useEffect(() => {
    const raw = params.google_error;
    const msg = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : null;
    if (msg) setLocalError(msg);
  }, [params.google_error]);

  const afterAuthOk = useCallback(
    async (hasPin?: boolean) => {
      // Biometric is not auto-enabled — user must consent explicitly on unlock.
      if (hasPin === false) {
        router.replace('/(auth)/setup-pin');
        return;
      }
      const user = useAuthStore.getState().user;
      if (user && !user.hasPin) {
        router.replace('/(auth)/setup-pin');
        return;
      }
      router.replace('/(tabs)/home');
    },
    [router]
  );

  const handleLogin = async () => {
    if (lockRef.current || loading) return;
    lockRef.current = true;
    clearError();
    setLocalError(null);
    try {
      const result = await login({ identity: identity.trim(), password });
      if (result === 'ok') {
        await afterAuthOk(useAuthStore.getState().user?.hasPin);
      }
    } finally {
      lockRef.current = false;
    }
  };

  const handleVerify2fa = async () => {
    const ok = await verifyLogin2fa(otpCode.trim());
    if (ok) await afterAuthOk(useAuthStore.getState().user?.hasPin);
  };

  const handleGoogle = async () => {
    if (googleBusy || lockRef.current) return;
    setGoogleBusy(true);
    setLocalError(null);
    clearError();
    try {
      const result = await authService.startGoogleOAuth();
      if (result.type === 'cancelled') return;
      if (result.type === 'error') {
        setLocalError(result.message);
        return;
      }
      if (result.type === 'google_token') {
        router.push({
          pathname: '/(auth)/google-complete',
          params: { google_token: result.googleToken },
        });
        return;
      }
      // Existing Google user — token issued by backend.
      const me = await authService.me().catch(() => null);
      // Token not yet in store — set then me()
      await storageService.setToken(result.token);
      const meRes = await authService.me();
      if (meRes.success) {
        const payload: any = meRes.data;
        await applySession(result.token, payload?.user ?? payload);
        await afterAuthOk(useAuthStore.getState().user?.hasPin);
      } else {
        setLocalError(meRes.message || 'Gagal mengambil profil setelah Google login.');
      }
      void me;
    } catch (err: unknown) {
      setLocalError(parseApiError(err).message || 'Login Google gagal.');
    } finally {
      setGoogleBusy(false);
    }
  };

  if (twoFactorChallenge) {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuthBrandHeader subtitle={`Masukkan kode 6 digit yang dikirim ke ${twoFactorChallenge.identifier}.`} />
          <Text style={styles.heading}>Verifikasi 2FA</Text>
          <TextInput
            value={otpCode}
            onChangeText={setOtpCode}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            style={styles.otpInput}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Button
            label="Verifikasi"
            onPress={() => void handleVerify2fa()}
            loading={loading}
            disabled={otpCode.length !== 6}
          />
          <Button label="Kembali" onPress={clearTwoFactorChallenge} variant="ghost" />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AuthBrandHeader subtitle="Masuk untuk mulai transaksi konter" />

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
          {validationErrors?.phone_or_email ? (
            <Text style={styles.fieldError}>{validationErrors.phone_or_email[0]}</Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Kata Sandi</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={[styles.input, styles.passwordInput]}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={10}
              style={styles.eyeBtn}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.gray[500]}
              />
            </Pressable>
          </View>
          {validationErrors?.password ? (
            <Text style={styles.fieldError}>{validationErrors.password[0]}</Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => router.push('/(auth)/forgot-password')}
          hitSlop={8}
          style={styles.forgotWrap}
        >
          <Text style={styles.forgot}>Lupa Password?</Text>
        </Pressable>

        {displayError ? <Text style={styles.errorText}>{displayError}</Text> : null}

        <Button
          label="Masuk"
          onPress={() => void handleLogin()}
          loading={loading}
          disabled={!identity.trim() || !password || loading || googleBusy}
        />

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>atau</Text>
          <View style={styles.divider} />
        </View>

        <Button
          label="Masuk dengan Google"
          variant="secondary"
          loading={googleBusy}
          disabled={loading || googleBusy}
          onPress={() => void handleGoogle()}
          labelStyle={{ color: colors.gray[900] }}
          icon={<Ionicons name="logo-google" size={18} color={colors.gray[900]} />}
        />

        <Text style={styles.footer}>
          Belum punya akun?{' '}
          <Link href="/(auth)/register" style={styles.footerLink}>
            Daftar
          </Link>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
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
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 14, height: '100%', justifyContent: 'center' },
  forgotWrap: { alignSelf: 'flex-end', marginTop: -spacing.xs },
  forgot: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.gray[200] },
  dividerText: { fontSize: typography.size.xs, color: colors.gray[400] },
  footer: {
    textAlign: 'center',
    fontSize: typography.size.sm,
    color: colors.gray[600],
    marginTop: spacing.md,
  },
  footerLink: {
    color: colors.primary[700],
    fontWeight: '700',
  },
});
