import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInput as TextInputType,
} from 'react-native';
import { colors, spacing } from '../../theme';

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * 6-slot PIN visual: empty ○ / filled ● (primary green). Digits never shown.
 * Hidden numeric TextInput keeps the system number-pad open; auto-submits at 6.
 * Caller owns `value` in local state — never Zustand / SecureStore. Never log PIN.
 */
export function PinInput({ value, onChange, onComplete, disabled, autoFocus }: PinInputProps) {
  const inputRef = useRef<TextInputType>(null);
  const length = Math.min(6, (value || '').replace(/\D/g, '').length);

  useEffect(() => {
    if (autoFocus && !disabled) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [autoFocus, disabled]);

  const handleChange = (text: string) => {
    if (disabled) return;
    const cleaned = text.replace(/\D/g, '').slice(0, 6);
    onChange(cleaned);
    if (cleaned.length === 6) {
      onComplete(cleaned);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Masukkan PIN 6 digit"
      onPress={() => {
        if (!disabled) inputRef.current?.focus();
      }}
      style={styles.wrap}
    >
      <View style={styles.dots} pointerEvents="none">
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

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="off"
        importantForAutofill="no"
        secureTextEntry
        caretHidden
        maxLength={6}
        editable={!disabled}
        autoFocus={autoFocus}
        style={styles.hiddenInput}
        contextMenuHidden
      />
    </Pressable>
  );
}

const DOT = 16;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    width: '100%',
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
    borderWidth: 2,
    borderColor: colors.gray[300],
    backgroundColor: 'transparent',
  },
  dotFilled: {
    borderWidth: 0,
    backgroundColor: colors.primary[600],
  },
  /** Invisible field over the dots so the numeric keyboard stays available. */
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0.02,
    color: 'transparent',
  },
});
