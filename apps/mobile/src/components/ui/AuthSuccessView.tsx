import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { AuthBrandHeader } from './AuthBrandHeader';
import { colors, spacing, typography } from '../../theme';

type Props = {
  title?: string;
  message?: string;
  buttonLabel?: string;
  onContinue: () => void;
  autoContinueMs?: number;
};

/**
 * Lightweight success animation (RN Animated) — no network GIF.
 */
export function AuthSuccessView({
  title = 'Berhasil!',
  message = 'Selamat, akun GurkyNet kamu berhasil dibuat.',
  buttonLabel = 'Mulai Sekarang',
  onContinue,
  autoContinueMs,
}: Props) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  useEffect(() => {
    if (!autoContinueMs) return;
    const t = setTimeout(onContinue, autoContinueMs);
    return () => clearTimeout(t);
  }, [autoContinueMs, onContinue]);

  return (
    <View style={styles.wrap}>
      <AuthBrandHeader compact />
      <Animated.View style={[styles.iconWrap, { opacity, transform: [{ scale }] }]}>
        <Ionicons name="checkmark-circle" size={72} color={colors.primary[600]} />
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Button label={buttonLabel} onPress={onContinue} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing['2xl'],
    gap: spacing.md,
    backgroundColor: colors.white,
  },
  iconWrap: {
    alignSelf: 'center',
    marginVertical: spacing.md,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
    textAlign: 'center',
  },
  message: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
});
