import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

/**
 * Large, thumb-friendly tap target (52px) by design — this app is used by counter staff
 * dozens of times a day (spec section 4/32), not tapped occasionally like a settings screen.
 * Always shows a loading state and disables itself while `loading` — the double-tap /
 * double-submit guard for "Beli Sekarang" and similar actions lives at the call site
 * (disable via `loading`/`disabled`), this component just renders that state clearly.
 */
export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false, fullWidth = true, icon }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.primary[600] : colors.white} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, textVariantStyles[variant]]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  fullWidth: { width: '100%' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: typography.size.md, fontWeight: typography.weight.bold },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary[600] },
  secondary: { backgroundColor: colors.primary[50], borderWidth: 1, borderColor: colors.primary[200] },
  danger: { backgroundColor: colors.status.failed },
  ghost: { backgroundColor: 'transparent' },
});

const textVariantStyles = StyleSheet.create({
  primary: { color: colors.white },
  secondary: { color: colors.primary[700] },
  danger: { color: colors.white },
  ghost: { color: colors.primary[700] },
});
