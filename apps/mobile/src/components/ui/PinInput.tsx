import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme';

interface PinInputProps {
  /** Digits entered so far (0–6). Digits are never rendered — only fill state. */
  value: string;
  disabled?: boolean;
}

const DOT = 14;

/**
 * 6-slot PIN visual only (empty ○ / filled ● primary green).
 * Digits are never shown. Keypad lives in PinConfirmModal — no native keyboard.
 * Caller owns `value` in local state — never Zustand / SecureStore. Never log PIN.
 */
export function PinInput({ value, disabled }: PinInputProps) {
  const length = Math.min(6, (value || '').replace(/\D/g, '').length);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`PIN ${length} dari 6 digit`}
      style={[styles.wrap, disabled && styles.disabled]}
    >
      <View style={styles.dots}>
        {Array.from({ length: 6 }).map((_, i) => {
          const filled = i < length;
          return (
            <View
              key={i}
              style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    width: '100%',
  },
  disabled: {
    opacity: 0.55,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  dotEmpty: {
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    backgroundColor: 'transparent',
  },
  dotFilled: {
    borderWidth: 1.5,
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[600],
  },
});
