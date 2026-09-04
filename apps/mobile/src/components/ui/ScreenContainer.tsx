import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  style?: ViewStyle;
  padded?: boolean;
}

export function ScreenContainer({ children, scroll = true, onRefresh, refreshing = false, style, padded = true }: ScreenContainerProps) {
  const content = padded ? <View style={styles.padded}>{children}</View> : children;

  return (
    <SafeAreaView style={[styles.safeArea, style]} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[600]} /> : undefined
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
});
