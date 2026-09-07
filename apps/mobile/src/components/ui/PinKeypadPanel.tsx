import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PinConfirmModal } from './PinConfirmModal';
import { colors } from '../../theme';

type Props = {
  /** @deprecated Controlled value ignored — master PinConfirmModal owns digits. */
  value?: string;
  /** Called on digit edit (error clear). Partial PIN is never passed. */
  onChange?: (next: string) => void;
  /** Fired once when length becomes 6 (maps to PinConfirmModal onSubmit). */
  onComplete?: (pin: string) => void;
  disabled?: boolean;
  title?: string;
  subtitle?: string;
  error?: string | null;
  maxLength?: number;
  footer?: React.ReactNode;
  /** Show "Lupa PIN?" — default false for account/auth flows. */
  showForgotPin?: boolean;
  onForgotPin?: () => void;
  /**
   * Backdrop tap dismiss (default false).
   * Android hardware back always calls `onClose` via PinConfirmModal (unless loading).
   */
  dismissible?: boolean;
  /** Required for back navigation while the PIN sheet is open. */
  onClose: () => void;
};

/**
 * Compatibility wrapper — ALL PIN entry uses master UI (`PinConfirmModal`).
 * Full-screen unlock/OTP layout (not bottom sheet).
 */
export function PinKeypadPanel({
  onChange,
  onComplete,
  disabled = false,
  title = 'Masukkan PIN',
  subtitle = 'Masukkan 6 digit PIN kamu',
  error = null,
  footer,
  showForgotPin = false,
  onForgotPin,
  dismissible = false,
  onClose,
}: Props) {
  return (
    <View style={styles.fill} pointerEvents="box-none">
      <PinConfirmModal
        visible
        title={title}
        subtitle={subtitle}
        loading={disabled}
        error={error}
        footer={footer}
        hideForgotPin={!showForgotPin}
        onForgotPin={showForgotPin ? onForgotPin : undefined}
        dismissible={dismissible && !disabled}
        onClose={() => {
          if (disabled) return;
          onClose();
        }}
        onEditing={() => {
          onChange?.('');
        }}
        onSubmit={async (pin) => {
          await onComplete?.(pin);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.white,
    minHeight: 280,
  },
});
