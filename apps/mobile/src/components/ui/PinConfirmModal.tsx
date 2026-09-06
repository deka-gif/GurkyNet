import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
};

/**
 * Shared PIN confirmation sheet for any flow that already requires a transaction PIN
 * (checkout, Sesama GurkyPay transfer, …). Does not invent PIN requirements.
 * PIN lives only in this component's local state.
 */
export function PinConfirmModal({
  visible,
  title = 'Masukkan PIN',
  subtitle = 'PIN 6 digit untuk mengonfirmasi transaksi.',
  loading = false,
  error = null,
  onSubmit,
  onClose,
  onEditing,
  dismissible = true,
}: PinConfirmModalProps) {
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setPin('');
      submittingRef.current = false;
    }
  }, [visible]);

  const handleComplete = async (entered: string) => {
    if (submittingRef.current || loading) return;
    if (!/^\d{6}$/.test(entered)) return;
    submittingRef.current = true;
    try {
      await onSubmit(entered);
    } finally {
      // Parent owns loading; clear local PIN so retry starts fresh (never log).
      setPin('');
      submittingRef.current = false;
    }
  };

  const canDismiss = dismissible && !loading;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (canDismiss) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (canDismiss) onClose();
          }}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.pinWrap}>
            <PinInput
              value={pin}
              onChange={(v) => {
                setPin(v);
                onEditing?.();
              }}
              onComplete={(v) => {
                void handleComplete(v);
              }}
              disabled={loading}
              autoFocus={visible}
            />
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary[600]} />
              <Text style={styles.loadingText}>Memproses...</Text>
            </View>
          ) : null}

          {error && !loading ? <Text style={styles.error}>{error}</Text> : null}

          {canDismiss ? (
            <Pressable onPress={onClose} style={styles.cancelBtn} accessibilityRole="button">
              <Text style={styles.cancelText}>Batal</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[200],
    marginBottom: spacing.sm,
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
    marginBottom: spacing.md,
  },
  pinWrap: {
    paddingVertical: spacing.lg,
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
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  cancelText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[500],
  },
});
