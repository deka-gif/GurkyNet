import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PinInput } from './PinInput';
import { colors, radius, spacing, typography } from '../../theme';

export type PinConfirmModalProps = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  /** Called once when the 6th digit is entered. PIN must not be persisted by the parent. */
  onSubmit: (pin: string) => void | Promise<void>;
  onClose: () => void;
  /** Fired when the user edits digits (e.g. clear prior PIN error). Never receives the raw PIN. */
  onEditing?: () => void;
  /** When false, backdrop / close is ignored (e.g. while submitting). Default true. */
  dismissible?: boolean;
  /**
   * Optional — navigate to /akun/pin/forgot after closing.
   * When omitted, "Lupa PIN?" stays non-interactive (safe default).
   */
  onForgotPin?: () => void;
  /**
   * Optional secondary UI under error / Lupa PIN (e.g. biometric, resend OTP).
   * Does not change keypad/dots — checkout master layout preserved.
   */
  footer?: React.ReactNode;
  /** Hide the "Lupa PIN?" row entirely (auth create/confirm flows). */
  hideForgotPin?: boolean;
};

const KEYS: Array<Array<string | 'backspace' | 'blank'>> = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['blank', '0', 'backspace'],
];

/**
 * MASTER PIN UI (checkout reference) — bottom sheet + 6 dots + numeric keypad.
 * Reused for transaction, transfer, login unlock, create/confirm/change/forgot PIN.
 * PIN lives only in local component state. Never Zustand / SecureStore / logs.
 */
export function PinConfirmModal({
  visible,
  title = 'Masukkan PIN',
  subtitle = 'Masukkan 6 digit PIN kamu',
  loading = false,
  error = null,
  onSubmit,
  onClose,
  onEditing,
  dismissible = true,
  onForgotPin,
  footer,
  hideForgotPin = false,
}: PinConfirmModalProps) {
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const submittingRef = useRef(false);

  useEffect(() => {
    setPin('');
    submittingRef.current = false;
  }, [visible]);

  const locked = loading;

  const handleComplete = async (entered: string) => {
    if (submittingRef.current || loading) return;
    if (!/^\d{6}$/.test(entered)) return;
    submittingRef.current = true;
    try {
      await onSubmit(entered);
    } finally {
      setPin('');
      submittingRef.current = false;
    }
  };

  const appendDigit = (digit: string) => {
    if (locked || submittingRef.current) return;
    if (!/^\d$/.test(digit)) return;
    if (pin.length >= 6) return;
    const next = `${pin}${digit}`.slice(0, 6);
    setPin(next);
    onEditing?.();
    if (next.length === 6) {
      requestAnimationFrame(() => {
        void handleComplete(next);
      });
    }
  };

  const backspace = () => {
    if (locked || submittingRef.current) return;
    if (!pin) return;
    setPin(pin.slice(0, -1));
    onEditing?.();
  };

  const canDismiss = dismissible && !loading;
  const showForgot = !hideForgotPin;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        // Android hardware/gesture back must not get stuck when sheet is open.
        // Backdrop still respects `dismissible`; visuals unchanged.
        if (loading) return;
        onClose();
      }}
    >
      <View style={styles.flex}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (canDismiss) onClose();
          }}
          accessibilityLabel="Tutup"
        />

        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
        >
          <View style={styles.handle} />

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.pinWrap}>
            <PinInput value={pin} disabled={locked} />
          </View>

          {showForgot ? (
            <Pressable
              disabled={locked || !onForgotPin}
              accessibilityRole="button"
              accessibilityState={{ disabled: locked || !onForgotPin }}
              accessibilityLabel={onForgotPin ? 'Lupa PIN' : 'Lupa PIN (belum tersedia)'}
              style={[styles.forgotWrap, !onForgotPin && styles.forgotDisabled]}
              onPress={() => {
                if (!onForgotPin || locked) return;
                setPin('');
                onForgotPin();
              }}
            >
              <Text style={styles.forgotText}>Lupa PIN?</Text>
            </Pressable>
          ) : null}

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary[600]} />
              <Text style={styles.loadingText}>Memproses...</Text>
            </View>
          ) : null}

          {error && !loading ? <Text style={styles.error}>{error}</Text> : null}

          {footer ? <View style={styles.footerWrap}>{footer}</View> : null}

          <View style={styles.spacer} />

          <View style={styles.keypad}>
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
                        <Ionicons
                          name="backspace-outline"
                          size={28}
                          color={colors.gray[800]}
                        />
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    maxHeight: '92%',
    minHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[200],
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: typography.size.sm,
    color: colors.gray[500],
    textAlign: 'center',
  },
  pinWrap: {
    marginTop: spacing['2xl'],
    marginBottom: spacing.md,
  },
  forgotWrap: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  forgotDisabled: {
    opacity: 0.55,
  },
  forgotText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.primary[600],
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  loadingText: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.status.failed,
    backgroundColor: colors.status.failedBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  footerWrap: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  spacer: {
    flexGrow: 1,
    minHeight: spacing.xl,
  },
  keypad: {
    paddingTop: spacing.lg,
    gap: spacing.xs,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  keyCell: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    opacity: 0.45,
  },
  keyDisabled: {
    opacity: 0.35,
  },
  keyDigit: {
    fontSize: 28,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
  },
});
