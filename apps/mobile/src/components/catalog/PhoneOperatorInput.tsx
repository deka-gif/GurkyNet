import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import {
  DetectedOperator,
  detectOperatorFromPhone,
  providerBadgeLabel,
} from '../../utils/detectOperator';
import { operatorBrandColor } from '../../utils/operatorBrand';
import { phoneTargetError, sanitizePhoneDigits } from '../../utils/targetValidation';

/**
 * Shared Pulsa / Paket Data phone field:
 * digits left + detected operator badge right (UI metadata only).
 * Detection: existing `detectOperatorFromPhone` (same prefixes as Web).
 */

type Props = {
  value: string;
  onChangeText: (digits: string) => void;
  /** Optional override — defaults to detectOperatorFromPhone(value). */
  operator?: DetectedOperator | null;
  /** Hint when ≥4 digits but prefix unknown — defaults to shared copy. */
  unrecognizedMessage?: string;
  /** Field label — defaults to "Nomor Handphone". */
  label?: string;
  /** Shown when operator is detected (e.g. Tembak Langsung helper). */
  helperWhenDetected?: string;
};

export function PhoneOperatorInput({
  value,
  onChangeText,
  operator: operatorProp,
  unrecognizedMessage = 'Operator tidak dikenali dari nomor ini.',
  label = 'Nomor Handphone',
  helperWhenDetected,
}: Props) {
  const operator = operatorProp !== undefined ? operatorProp : detectOperatorFromPhone(value);
  const phoneErr = value.length > 0 ? phoneTargetError(value) : null;
  const digits = value.replace(/\D/g, '');
  const unrecognized = digits.length >= 4 && !operator;
  const typingShort = digits.length > 0 && digits.length < 4;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          value={value}
          onChangeText={(t) => onChangeText(sanitizePhoneDigits(t))}
          placeholder="08xxxxxxxxxx"
          keyboardType="number-pad"
          placeholderTextColor={colors.gray[400]}
          style={styles.input}
          accessibilityLabel={label}
        />
        {operator ? (
          <Text
            style={[styles.badge, { color: operatorBrandColor(operator) }]}
            numberOfLines={1}
            accessibilityLabel={`Operator ${providerBadgeLabel(operator)}`}
          >
            {providerBadgeLabel(operator)}
          </Text>
        ) : null}
      </View>
      {operator && helperWhenDetected ? (
        <Text style={styles.hint}>{helperWhenDetected}</Text>
      ) : unrecognized ? (
        <Text style={styles.hintWarn}>{unrecognizedMessage}</Text>
      ) : typingShort ? (
        <Text style={styles.hint}>Masukkan minimal 4 digit untuk deteksi operator.</Text>
      ) : null}
      {phoneErr ? <Text style={styles.error}>{phoneErr}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[700] },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    backgroundColor: colors.white,
    minHeight: 48,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingRight: spacing.sm,
    fontSize: typography.size.base,
    color: colors.gray[900],
    minWidth: 0,
  },
  badge: {
    flexShrink: 0,
    maxWidth: '42%',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.3,
    textAlign: 'right',
  },
  hint: { fontSize: typography.size.xs, color: colors.gray[500] },
  hintWarn: { fontSize: typography.size.xs, color: colors.status.pending },
  error: { fontSize: typography.size.xs, color: colors.status.failed },
});
