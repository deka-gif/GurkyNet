import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../theme';

type Props = {
  visible: boolean;
  onLater: () => void;
  onAllow: () => void;
};

/**
 * Soft pre-prompt before OS permission dialog.
 * Does not claim OS permission has been granted.
 */
export function PushPermissionPreprompt({ visible, onLater, onAllow }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="notifications-outline" size={28} color={colors.primary[600]} />
          </View>
          <Text style={styles.title}>Tetap dapat kabar penting</Text>
          <Text style={styles.body}>
            Kami akan memberi tahu Anda tentang transaksi dan informasi penting dari GurkyNet.
          </Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onLater}
              style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Nanti"
            >
              <Text style={styles.btnSecondaryText}>Nanti</Text>
            </Pressable>
            <Pressable
              onPress={onAllow}
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Izinkan"
            >
              <Text style={styles.btnPrimaryText}>Izinkan</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  body: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  btnSecondary: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray[300],
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: colors.gray[700],
    fontWeight: typography.weight.bold,
  },
  btnPrimary: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: colors.white,
    fontWeight: typography.weight.bold,
  },
  pressed: { opacity: 0.9 },
});
