import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHelpStore } from '../../src/store/help.store';
import { LoadingState, EmptyState, Button } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

/**
 * FAQ detail — data from GET /help (question/answer). No separate article API.
 */
export default function HelpFaqDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const faqId = Number(id);
  const faq = useHelpStore((s) => s.faq);
  const loading = useHelpStore((s) => s.loading);
  const fetchHelp = useHelpStore((s) => s.fetchHelp);
  const getFaqById = useHelpStore((s) => s.getFaqById);

  useEffect(() => {
    if (faq.length === 0) void fetchHelp();
  }, [faq.length, fetchHelp]);

  const item = useMemo(() => (Number.isFinite(faqId) ? getFaqById(faqId) : undefined), [
    faqId,
    getFaqById,
    faq,
  ]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Kembali"
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={24} color={colors.gray[900]} />
          </Pressable>
          <Text style={styles.topTitle}>Bantuan</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading && !item ? (
          <LoadingState label="Memuat artikel…" />
        ) : !item ? (
          <View style={styles.body}>
            <EmptyState
              title="Artikel tidak ditemukan"
              message="Bantuan ini mungkin sudah tidak tersedia."
            />
            <Button label="Kembali" onPress={() => router.back()} variant="secondary" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing['3xl'] }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>{item.question}</Text>
            <View style={styles.answerCard}>
              <Text style={styles.answer}>{item.answer}</Text>
            </View>
            <Pressable
              style={styles.ctaRow}
              onPress={() => router.push('/help/chat')}
              accessibilityRole="button"
              accessibilityLabel="Chat dengan Customer Service"
            >
              <Ionicons name="chatbubbles" size={18} color={colors.primary[600]} />
              <Text style={styles.ctaText}>Masih butuh bantuan? Chat CS</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primary[600]} />
            </Pressable>
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray[50] },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
    lineHeight: 28,
  },
  answerCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    padding: spacing.lg,
  },
  answer: {
    fontSize: typography.size.base,
    color: colors.gray[700],
    lineHeight: 24,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[200],
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  ctaText: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
  },
});
