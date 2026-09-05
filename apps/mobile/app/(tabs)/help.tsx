import { useCallback, useEffect, useMemo } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHelpStore } from '../../src/store/help.store';
import {
  buildHelpTopicShortcuts,
  filterHelpFaqs,
  topicSearchQuery,
  type HelpTopicShortcut,
} from '../../src/services/help.service';
import {
  ScreenContainer,
  LoadingState,
  ErrorState,
  EmptyState,
} from '../../src/components/ui';
import { FloatingChatButton } from '../../src/components/help/FloatingChatButton';
import { colors, radius, spacing, typography } from '../../src/theme';

const TAB_BAR_HEIGHT = 58;
const FAB_CLEARANCE = 52 + 16;

/**
 * Help Center UI — Search → Chat → Topics → FAQ list → Contacts.
 * Data: GET /help only. Topics = client-side FAQ shortcuts (not backend categories).
 */
export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const loading = useHelpStore((s) => s.loading);
  const error = useHelpStore((s) => s.error);
  const faq = useHelpStore((s) => s.faq);
  const contacts = useHelpStore((s) => s.contacts);
  const searchQuery = useHelpStore((s) => s.searchQuery);
  const setSearchQuery = useHelpStore((s) => s.setSearchQuery);
  const fetchHelp = useHelpStore((s) => s.fetchHelp);
  const refreshUnread = useHelpStore((s) => s.refreshUnread);

  useEffect(() => {
    void fetchHelp();
    void refreshUnread();
  }, [fetchHelp, refreshUnread]);

  const items = useMemo(() => filterHelpFaqs(faq, searchQuery), [faq, searchQuery]);
  const topics = useMemo(() => buildHelpTopicShortcuts(faq), [faq]);
  const searching = searchQuery.trim().length > 0;

  // Content already padded by ScreenContainer (spacing.lg each side).
  const contentWidth = width - spacing.lg * 2;
  const gridGap = spacing.sm;
  const tileWidth = Math.floor((contentWidth - gridGap) / 2);

  const openWhatsApp = useCallback(() => {
    const raw = contacts?.whatsapp?.replace(/\D/g, '') || '';
    if (!raw) return;
    void Linking.openURL(`https://wa.me/${raw}`);
  }, [contacts?.whatsapp]);

  const openEmail = useCallback(() => {
    const email = contacts?.email?.trim();
    if (!email) return;
    void Linking.openURL(`mailto:${email}`);
  }, [contacts?.email]);

  const openPhone = useCallback(() => {
    const phone = contacts?.phone?.replace(/\s/g, '') || '';
    if (!phone) return;
    void Linking.openURL(`tel:${phone}`);
  }, [contacts?.phone]);

  const onTopicPress = (topic: HelpTopicShortcut) => {
    setSearchQuery(topicSearchQuery(topic));
  };

  const bottomPad = Math.max(insets.bottom, 8) + TAB_BAR_HEIGHT + FAB_CLEARANCE;

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Bantuan</Text>
      </View>

      <ScreenContainer belowHeader style={{ flex: 1 }}>
        <View style={{ paddingBottom: bottomPad, gap: spacing.md }}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.gray[400]} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Cari bantuan"
            placeholderTextColor={colors.gray[400]}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Cari bantuan"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8} accessibilityLabel="Hapus pencarian">
              <Ionicons name="close-circle" size={18} color={colors.gray[400]} />
            </Pressable>
          ) : null}
        </View>

        {loading && faq.length === 0 ? (
          <LoadingState label="Memuat bantuan…" />
        ) : error && faq.length === 0 ? (
          <ErrorState message={error} onRetry={() => void fetchHelp()} />
        ) : (
          <>
            {/* Quick support — above FAQ */}
            {!searching ? (
              <Pressable
                style={styles.chatCard}
                onPress={() => router.push('/help/chat')}
                accessibilityRole="button"
                accessibilityLabel="Chat dengan Customer Service GurkyNet"
              >
                <View style={styles.chatIconWrap}>
                  <Ionicons name="chatbubbles" size={22} color={colors.primary[600]} />
                </View>
                <View style={styles.chatBody}>
                  <Text style={styles.chatEyebrow}>Butuh bantuan langsung?</Text>
                  <Text style={styles.chatTitle}>Chat dengan Customer Service GurkyNet</Text>
                  {contacts?.operatingHours ? (
                    <Text style={styles.chatHours} numberOfLines={1}>
                      Jam layanan: {contacts.operatingHours}
                    </Text>
                  ) : (
                    <Text style={styles.chatHint}>Masih butuh bantuan? Hubungi CS GurkyNet.</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.primary[600]} />
              </Pressable>
            ) : null}

            {/* Topic shortcuts — only topics that match FAQ content */}
            {!searching && topics.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Bantuan populer</Text>
                <View style={[styles.topicGrid, { gap: gridGap }]}>
                  {topics.map((topic) => (
                    <Pressable
                      key={topic.key}
                      onPress={() => onTopicPress(topic)}
                      style={[styles.topicTile, { width: tileWidth }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter bantuan: ${topic.label}`}
                    >
                      <View style={styles.topicIcon}>
                        <Ionicons name={topic.icon} size={20} color={colors.primary[600]} />
                      </View>
                      <Text style={styles.topicLabel} numberOfLines={2}>
                        {topic.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Compact FAQ list */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {searching ? 'Hasil pencarian' : 'Pertanyaan umum'}
              </Text>

              {items.length === 0 ? (
                <EmptyState
                  title={searching ? 'Tidak menemukan bantuan' : 'Bantuan belum tersedia'}
                  message={
                    searching
                      ? 'Coba gunakan kata kunci lain.'
                      : 'Belum ada artikel bantuan untuk saat ini.'
                  }
                />
              ) : (
                <View style={styles.faqList}>
                  {items.map((item, index) => (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.faqRow,
                        index < items.length - 1 && styles.faqRowBorder,
                      ]}
                      onPress={() => router.push(`/help/${item.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={item.question}
                    >
                      <Text style={styles.faqTitle} numberOfLines={2}>
                        {item.question}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.gray[400]} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Compact contacts */}
            {(contacts?.whatsapp || contacts?.email || contacts?.phone) && !searching ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Kontak kami</Text>
                <View style={styles.contactRow}>
                  {contacts?.whatsapp ? (
                    <Pressable
                      style={styles.contactChip}
                      onPress={openWhatsApp}
                      accessibilityLabel="WhatsApp"
                    >
                      <Ionicons name="logo-whatsapp" size={18} color={colors.primary[700]} />
                      <Text style={styles.contactChipText}>WhatsApp</Text>
                    </Pressable>
                  ) : null}
                  {contacts?.email ? (
                    <Pressable
                      style={styles.contactChip}
                      onPress={openEmail}
                      accessibilityLabel="Email"
                    >
                      <Ionicons name="mail-outline" size={18} color={colors.primary[700]} />
                      <Text style={styles.contactChipText}>Email</Text>
                    </Pressable>
                  ) : null}
                  {contacts?.phone ? (
                    <Pressable
                      style={styles.contactChip}
                      onPress={openPhone}
                      accessibilityLabel="Telepon"
                    >
                      <Ionicons name="call-outline" size={18} color={colors.primary[700]} />
                      <Text style={styles.contactChipText}>Telepon</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
          </>
        )}
        </View>
      </ScreenContainer>

      {/* FAB only on Help tab — not root layout / other tabs */}
      <FloatingChatButton />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray[50] },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  topTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.gray[900],
    paddingVertical: 8,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[200],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 72,
  },
  chatIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBody: { flex: 1, minWidth: 0, gap: 2 },
  chatEyebrow: {
    fontSize: 11,
    fontWeight: typography.weight.medium,
    color: colors.primary[700],
  },
  chatTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  chatHours: {
    fontSize: 11,
    color: colors.gray[500],
    marginTop: 2,
  },
  chatHint: {
    fontSize: 11,
    color: colors.gray[500],
    marginTop: 2,
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  topicTile: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    padding: spacing.md,
    minHeight: 88,
    gap: spacing.sm,
  },
  topicIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    lineHeight: 18,
  },
  faqList: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    overflow: 'hidden',
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    paddingVertical: spacing.sm,
  },
  faqRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  faqTitle: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
    lineHeight: 18,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  contactChipText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
  },
});
