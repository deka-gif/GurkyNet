import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../theme';

/**
 * Used only for screens this phase intentionally hasn't built yet (spec section 39's
 * phased rollout + section 40's "no dummy data" rule) — never fake content, an honest
 * "not yet" state instead. Every phase name here maps to a real phase in
 * MOBILE_APP_AUDIT_REPORT.md, not a made-up one.
 */
export function ComingSoon({ icon, title, phase }: { icon: keyof typeof Ionicons.glyphMap; title: string; phase: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={32} color={colors.primary[600]} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Fitur ini akan hadir pada {phase}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing['2xl'] },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.gray[900] },
  subtitle: { fontSize: typography.size.sm, color: colors.gray[500], textAlign: 'center' },
});
