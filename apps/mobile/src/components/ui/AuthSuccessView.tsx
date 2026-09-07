import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors, spacing, typography } from '../../theme';

type Props = {
  title?: string;
  message?: string;
  buttonLabel?: string;
  onContinue: () => void;
  autoContinueMs?: number;
};

/**
 * Success screen — checkmark pop animation (RN Animated), no brand header.
 */
export function AuthSuccessView({
  title = 'Berhasil!',
  message = 'Selamat, akun GurkyNet kamu berhasil dibuat.',
  buttonLabel = 'Mulai Sekarang',
  onContinue,
  autoContinueMs,
}: Props) {
  const scale = useRef(new Animated.Value(0.2)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.4)).current;
  const ringOpacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1.12,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ringScale, {
          toValue: 1.55,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, ringOpacity, ringScale, scale]);

  useEffect(() => {
    if (!autoContinueMs) return;
    const t = setTimeout(onContinue, autoContinueMs);
    return () => clearTimeout(t);
  }, [autoContinueMs, onContinue]);

  return (
    <View style={styles.wrap}>
      <View style={styles.iconStage}>
        <Animated.View
          style={[
            styles.ring,
            {
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />
        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <Ionicons name="checkmark-circle" size={88} color={colors.primary[600]} />
        </Animated.View>
      </View>
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
  iconStage: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  ring: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: colors.primary[300],
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
