import { useRef, useState } from 'react';
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
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useAuthStore } from '../../src/store/auth.store';
import { Button } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

/** Ikon orang + tanda daftar (person add) realistis. */
function PersonAddIcon({ size = 44 }: { size?: number }) {
  const body = colors.primary[600];
  const dark = colors.primary[800];
  const light = colors.primary[400];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Daftar akun">
      {/* Head */}
      <Circle cx="26" cy="18" r="11" fill={body} />
      <Circle cx="26" cy="16" r="4" fill={light} opacity={0.4} />
      {/* Shoulders / torso */}
      <Path
        d="M8 52 C8 38 16 32 26 32 C36 32 44 38 44 52 Z"
        fill={body}
      />
      <Path
        d="M14 48 C16 40 20 36 26 36 C32 36 36 40 38 48"
        stroke={light}
        strokeWidth={3}
        fill="none"
        opacity={0.45}
      />
      {/* Plus badge */}
      <Circle cx="48" cy="44" r="13" fill={colors.white} />
      <Circle cx="48" cy="44" r="11" fill={dark} />
      <Rect x="45" y="37.5" width="6" height="13" rx="2" fill={colors.white} />
      <Rect x="41.5" y="41" width="13" height="6" rx="2" fill={colors.white} />
    </Svg>
  );
}

/**
 * Daftar akun — name / email / phone / password → OTP onboarding.
 * Password required by backend RegisterRequest even though product copy focuses on identity.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const registerStart = useAuthStore((s) => s.registerStart);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const validationErrors = useAuthStore((s) => s.validationErrors);
  const clearError = useAuthStore((s) => s.clearError);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const lockRef = useRef(false);

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    phone.trim().length > 0 &&
    password.length >= 8 &&
    passwordConfirmation.length > 0 &&
    !loading;

  const handleSubmit = async () => {
    if (lockRef.current || loading) return;
    clearError();
    setLocalError(null);

    if (password !== passwordConfirmation) {
      setLocalError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (!/^08\d{8,11}$/.test(phone.trim())) {
      setLocalError('Nomor HP harus diawali 08 (10–13 digit).');
      return;
    }

    lockRef.current = true;
    try {
      const result = await registerStart({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone_number: phone.trim(),
        password,
        password_confirmation: passwordConfirmation,
      });
      if (result) {
        router.push({
          pathname: '/(auth)/register-otp',
          params: {
            onboarding_id: String(result.onboardingId),
            email: result.email,
          },
        });
      }
    } finally {
      lockRef.current = false;
    }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <PersonAddIcon size={44} />
          </View>
          <Text style={styles.title}>Daftar Akun</Text>
          <Text style={styles.lead}>Buat Akun Untuk Memulai Transaksi</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Nama Lengkap</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Contoh: Budi Santoso"
            autoCapitalize="words"
            style={styles.input}
          />
          {validationErrors?.name ? (
            <Text style={styles.fieldError}>{validationErrors.name[0]}</Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="nama@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />
          {validationErrors?.email ? (
            <Text style={styles.fieldError}>{validationErrors.email[0]}</Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Nomor HP</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="08xxxxxxxxxx"
            keyboardType="phone-pad"
            style={styles.input}
          />
          {validationErrors?.phone_number ? (
            <Text style={styles.fieldError}>{validationErrors.phone_number[0]}</Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Kata Sandi</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 8 karakter"
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

        <View style={styles.field}>
          <Text style={styles.label}>Ulangi Kata Sandi</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={passwordConfirmation}
              onChangeText={setPasswordConfirmation}
              placeholder="Ulangi kata sandi"
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              style={[styles.input, styles.passwordInput]}
            />
            <Pressable
              onPress={() => setShowConfirm((v) => !v)}
              hitSlop={10}
              style={styles.eyeBtn}
              accessibilityRole="button"
              accessibilityLabel={showConfirm ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            >
              <Ionicons
                name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.gray[500]}
              />
            </Pressable>
          </View>
          {validationErrors?.password_confirmation ? (
            <Text style={styles.fieldError}>{validationErrors.password_confirmation[0]}</Text>
          ) : null}
        </View>

        {displayError ? <Text style={styles.errorText}>{displayError}</Text> : null}

        <Button
          label="Lanjut"
          onPress={() => void handleSubmit()}
          loading={loading}
          disabled={!canSubmit}
        />

        <Text style={styles.footer}>
          Sudah punya akun?{' '}
          <Link href="/(auth)/login" style={styles.footerLink}>
            Masuk
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
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.black,
    color: colors.gray[900],
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  lead: {
    fontSize: typography.size.base,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
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
  fieldError: { fontSize: typography.size.xs, color: colors.status.failed },
  errorText: {
    fontSize: typography.size.sm,
    color: colors.status.failed,
    backgroundColor: colors.status.failedBg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
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
