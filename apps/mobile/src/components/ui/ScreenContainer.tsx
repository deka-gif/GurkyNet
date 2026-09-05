import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  style?: ViewStyle;
  padded?: boolean;
  /**
   * Use under a visible Stack header. Skips duplicate top safe-area inset
   * (header already accounts for status bar) and uses compact paddingTop (8–16).
   * Tab/root screens without a header should leave this false.
   */
  belowHeader?: boolean;
}

const EDGES_DEFAULT: Edge[] = ['top', 'left', 'right'];
const EDGES_BELOW_HEADER: Edge[] = ['left', 'right'];

export function ScreenContainer({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  style,
  padded = true,
  belowHeader = false,
}: ScreenContainerProps) {
  const content = padded ? (
    <View style={belowHeader ? styles.paddedBelowHeader : styles.padded}>{children}</View>
  ) : (
    children
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, style]}
      edges={belowHeader ? EDGES_BELOW_HEADER : EDGES_DEFAULT}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[600]} />
            ) : undefined
          }
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        <View style={styles.flex}>{content}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.gray[50] },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  padded: { padding: spacing.lg, gap: spacing.lg },
  /** Compact top under Stack header — spacing.md (12) within 8–16 target. */
  paddedBelowHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
});
