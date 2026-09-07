import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { colors, spacing, typography } from '../../theme';

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
   */
  footer?: React.ReactNode;
  /** Hide the "Lupa PIN?" row entirely (auth create/confirm flows). */
  hideForgotPin?: boolean;
};

const PIN_LEN = 6;
const KEYS: Array<Array<string | 'backspace' | 'blank'>> = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['blank', '0', 'backspace'],
];

/**
 * MASTER PIN UI — full-screen white layout (mirror unlock PIN / OTP).
 * Used by checkout, transfer, create/confirm/change PIN, PinKeypadPanel.
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
  });
  const [pin, setPin] = useState('');
  const submittingRef = useRef(false);

  const keyHit = Math.min(68, Math.max(56, Math.round(windowWidth * 0.15)));
  const colGap = Math.max(36, Math.round(windowWidth * 0.14));
  const rowGap = Math.max(18, Math.min(34, Math.round(windowHeight * 0.032)));
  const slotStyle = { width: keyHit, height: keyHit };
  const sideColStyle = { width: keyHit, alignItems: 'center' as const };
  const pinFilled = Math.min(PIN_LEN, pin.replace(/\D/g, '').length);

  useEffect(() => {
    setPin('');
    submittingRef.current = false;
  }, [visible]);

  const locked = loading;
  const canDismiss = dismissible && !loading;
  const showForgot = !hideForgotPin;

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
    if (pin.length >= PIN_LEN) return;
    const next = `${pin}${digit}`.slice(0, PIN_LEN);
    setPin(next);
    onEditing?.();
    if (next.length === PIN_LEN) {
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

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={() => {
        if (loading) return;
        onClose();
      }}
    >
      <View
        style={[
          styles.fill,
          {
            paddingTop: Math.max(insets.top, spacing.md),
            paddingBottom: Math.max(insets.bottom, spacing.lg),
          },
        ]}
      >
        <Pressable
          onPress={() => {
            if (!canDismiss) return;
            onClose();
          }}
          disabled={!canDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          style={({ pressed }) => [
            styles.backRow,
            pressed && canDismiss && styles.pressed,
            !canDismiss && styles.disabled,
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.gray[900]} />
          <Text style={styles.backLabel}>Kembali</Text>
        </Pressable>

        <View style={styles.upper}>
          <Text
            style={[styles.title, fontsLoaded && styles.titleModern]}
            accessibilityRole="header"
          >
            {title}
          </Text>
          <Text style={[styles.subtitle, fontsLoaded && styles.subtitleModern]}>
            {subtitle}
          </Text>

          <View
            style={styles.dotsWrap}
            accessibilityRole="text"
            accessibilityLabel={`PIN ${pinFilled} dari ${PIN_LEN} digit`}
          >
            {Array.from({ length: PIN_LEN }).map((_, i) => {
              const filled = i < pinFilled;
              return (
                <View
                  key={`dot-${i}`}
                  style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
                />
              );
            })}
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary[600]} />
              <Text style={styles.loadingText}>Memproses...</Text>
            </View>
          ) : null}

          {error && !loading ? <Text style={styles.error}>{error}</Text> : null}

          {footer ? <View style={styles.footerWrap}>{footer}</View> : null}
        </View>

        <View style={styles.midSpacer} />

        <View style={[styles.keypad, { gap: rowGap }]}>
          {KEYS.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={[styles.keypadRow, { gap: colGap }]}>
              {row.map((key) => {
                if (key === 'blank') {
                  return <View key="blank" style={slotStyle} />;
                }

                if (key === 'backspace') {
                  return (
                    <View key="backspace-col" style={sideColStyle}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Hapus"
                        disabled={locked}
                        hitSlop={12}
                        onPress={backspace}
                        style={({ pressed }) => [
                          styles.iconSlot,
                          slotStyle,
                          pressed && !locked && styles.pressed,
                          locked && styles.disabled,
                        ]}
                      >
                        <Ionicons name="backspace-outline" size={26} color={colors.gray[600]} />
                      </Pressable>
                      {showForgot ? (
                        <Pressable
                          disabled={locked || !onForgotPin}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: locked || !onForgotPin }}
                          accessibilityLabel={
                            onForgotPin ? 'Lupa PIN' : 'Lupa PIN (belum tersedia)'
                          }
                          hitSlop={6}
                          style={[
                            styles.sideLinkWrap,
                            { width: keyHit },
                            !onForgotPin && styles.forgotDisabled,
                          ]}
                          onPress={() => {
                            if (!onForgotPin || locked) return;
                            setPin('');
                            onForgotPin();
                          }}
                        >
                          <Text style={styles.sideLinkText}>LUPA PIN</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                }

                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={`Angka ${key}`}
                    disabled={locked}
                    hitSlop={8}
                    onPress={() => appendDigit(key)}
                    style={({ pressed }) => [
                      styles.digitSlot,
                      slotStyle,
                      { borderRadius: keyHit / 2 },
                      pressed && !locked && styles.digitPressed,
                      locked && styles.disabled,
                    ]}
                  >
                    <Text style={styles.digit}>{key}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.lowerSpacer} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: spacing['2xl'],
  },
  backRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    marginLeft: -spacing.xs,
    marginTop: 19,
  },
  backLabel: {
    fontSize: 16,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
  },
  upper: {
    alignItems: 'center',
    paddingTop: spacing.lg + 40,
  },
  title: {
    fontSize: 24,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
    letterSpacing: -0.35,
  },
  titleModern: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '400',
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    fontWeight: typography.weight.medium,
    color: colors.gray[600],
    textAlign: 'center',
    letterSpacing: 0.15,
    paddingHorizontal: spacing.md,
  },
  subtitleModern: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontWeight: '400',
  },
  dotsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: spacing['3xl'] + spacing.md,
    minHeight: 22,
  },
  dot: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  loadingText: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
  },
  error: {
    marginTop: spacing.md,
    fontSize: typography.size.sm,
    color: colors.status.failed,
    backgroundColor: colors.status.failedBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  footerWrap: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  midSpacer: {
    flexGrow: 0.45,
    minHeight: 16,
  },
  lowerSpacer: {
    flexGrow: 0.55,
    minHeight: 8,
  },
  keypad: {
    alignSelf: 'center',
    marginTop: 38,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  digitSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[100],
  },
  digit: {
    fontSize: 32,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  sideLinkWrap: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideLinkText: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  forgotDisabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.55,
  },
  digitPressed: {
    backgroundColor: colors.gray[200],
  },
  disabled: {
    opacity: 0.35,
  },
});
