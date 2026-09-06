import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PinInput } from './PinInput';
import { colors, spacing, typography } from '../../theme';

const KEYS: Array<Array<string | 'backspace' | 'blank'>> = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['blank', '0', 'backspace'],
];

type Props = {
  value: string;
  onChange: (next: string) => void;
  /** Fired once when length becomes 6 (caller clears / advances). */
  onComplete?: (pin: string) => void;
  disabled?: boolean;
  title?: string;
  subtitle?: string;
  error?: string | null;
  maxLength?: number;
  /** Optional content below dots (e.g. resend link) — kept outside key cells. */
  footer?: React.ReactNode;
};

/**
 * Account PIN / OTP keypad — 6 dots + numeric pad.
 * Layout: header spaced below Stack header, flexible mid-gap, keypad toward bottom.
 * Key cells use flex (not % width + aspectRatio) to avoid Android overlap.
 * Does not touch checkout/transfer PinConfirmModal.
 */
export function PinKeypadPanel({
  value,
  onChange,
  onComplete,
  disabled = false,
  title,
  subtitle,
  error,
  maxLength = 6,
  footer,
}: Props) {
  const insets = useSafeAreaInsets();
  const locked = disabled;
  const digits = (value || '').replace(/\D/g, '').slice(0, maxLength);

  const appendDigit = (digit: string) => {
    if (locked) return;
    if (!/^\d$/.test(digit)) return;
    if (digits.length >= maxLength) return;
    const next = `${digits}${digit}`.slice(0, maxLength);
    onChange(next);
    if (next.length === maxLength && onComplete) {
      requestAnimationFrame(() => onComplete(next));
    }
  };

  const backspace = () => {
    if (locked || !digits) return;
    onChange(digits.slice(0, -1));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <View style={styles.pinWrap}>
          <PinInput value={digits} disabled={locked} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>

      {/* Flexible mid-gap pushes keypad down (no maxHeight — that glued keypad mid-screen). */}
      <View style={styles.spacer} />

      <View style={[styles.keypad, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {KEYS.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.keypadRow}>
            {row.map((key, colIndex) => {
              if (key === 'blank') {
                return <View key={`blank-${colIndex}`} style={styles.keyCell} />;
              }
              if (key === 'backspace') {
                return (
                  <Pressable
                    key="backspace"
                    accessibilityRole="button"
                    accessibilityLabel="Hapus"
                    disabled={locked}
                    onPress={backspace}
                    style={({ pressed }) => [
                      styles.keyCell,
                      pressed && !locked && styles.keyPressed,
                      locked && styles.keyDisabled,
                    ]}
                  >
                    <Ionicons name="backspace-outline" size={26} color={colors.gray[800]} />
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={`Angka ${key}`}
                  disabled={locked}
                  onPress={() => appendDigit(key)}
                  style={({ pressed }) => [
                    styles.keyCell,
                    pressed && !locked && styles.keyPressed,
                    locked && styles.keyDisabled,
                  ]}
                >
                  <Text style={styles.keyDigit}>{key}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  pinWrap: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  error: {
    fontSize: typography.size.xs,
    color: colors.status.failed,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  /** Grows to push keypad toward bottom — PIN reference proportion. */
  spacer: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: spacing['2xl'],
  },
  keypad: {
    gap: spacing.xs,
    paddingTop: spacing.lg,
  },
  keypadRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  keyCell: {
    flex: 1,
    minHeight: 56,
    maxHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  keyPressed: { backgroundColor: colors.gray[100] },
  keyDisabled: { opacity: 0.45 },
  keyDigit: {
    fontSize: 26,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
  },
  footer: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
});
