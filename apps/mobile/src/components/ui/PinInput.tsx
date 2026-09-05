import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * A single masked field, not per-digit boxes — mirrors the OTP input already used in
 * app/(auth)/login.tsx for visual/behavioral consistency and to avoid multi-box
 * focus-management bugs. Fires onComplete the instant the 6th digit lands, matching
 * web's CheckoutSummary.handlePinChange auto-submit-at-6-digits behavior.
 *
 * This component is the only place a purchase PIN value exists. The caller owns
 * `value` as local component state — never store this in Zustand, never persist it.
 */
export function PinInput({ value, onChange, onComplete, disabled, autoFocus }: PinInputProps) {
  const handleChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 6);
    onChange(cleaned);
    if (cleaned.length === 6) {
      onComplete(cleaned);
    }
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        value={value}
        onChangeText={handleChange}
        placeholder="000000"
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        editable={!disabled}
        autoFocus={autoFocus}
        style={[styles.input, disabled && styles.inputDisabled]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size['2xl'],
    letterSpacing: 8,
    textAlign: 'center',
    backgroundColor: colors.gray[50],
    color: colors.gray[900],
    width: 220,
  },
  inputDisabled: { opacity: 0.5 },
});
