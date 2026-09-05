import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChatStore } from '../../src/store/chat.store';
import { chatStatusLabel, type ChatMessage } from '../../src/services/chat.service';
import { LoadingState, ErrorState } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

const POLL_MS = 5000;
/** Distance from bottom to still count as "following" latest messages. */
const NEAR_BOTTOM_PX = 120;
/** Retries so scrollToEnd runs after FlatList has real content size. */
const INITIAL_SCROLL_MS = [0, 64, 180, 320] as const;
/**
 * Extra gap above the keyboard so the full composer (input + send) clears the
 * keyboard chrome on Android. Added on top of Keyboard endCoordinates.height —
 * uses design-token spacing.md (12), not a hardcoded keyboard height.
 */
const COMPOSER_ABOVE_KEYBOARD_GAP = spacing.md;

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Chat CS — GET/POST /chat/* (same as Web). No division picker.
 *
 * Keyboard (Android-first):
 * - app.json uses softwareKeyboardLayoutMode "pan" so the window is NOT resized
 *   by the OS (resize often fails to lift RN layouts / double-counts with padding).
 * - Lift list+composer with paddingBottom = Keyboard endCoordinates.height
 *   (dynamic from OS event — not a hardcoded spacer).
 * - Composer stays in normal flex flow (not absolute).
 */
export default function HelpChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    transactionId?: string;
    subject?: string;
  }>();

  const loading = useChatStore((s) => s.loading);
  const sending = useChatStore((s) => s.sending);
  const error = useChatStore((s) => s.error);
  const sendError = useChatStore((s) => s.sendError);
  const conversation = useChatStore((s) => s.conversation);
  const messages = useChatStore((s) => s.messages);
  const openChat = useChatStore((s) => s.openChat);
  const refreshThread = useChatStore((s) => s.refreshThread);
  const send = useChatStore((s) => s.send);
  const reset = useChatStore((s) => s.reset);

  const [draft, setDraft] = useState('');
  /** Dynamic keyboard inset from Keyboard events (0 when hidden). */
  const [keyboardInset, setKeyboardInset] = useState(0);

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const nearBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const forceScrollRef = useRef(false);
  const messagesLenRef = useRef(0);

  const boot = useCallback(() => {
    const tx =
      params.transactionId && /^\d+$/.test(params.transactionId)
        ? Number(params.transactionId)
        : null;
    void openChat({
      transactionId: tx,
      subject: params.subject ? String(params.subject) : null,
    });
  }, [openChat, params.subject, params.transactionId]);

  useEffect(() => {
    boot();
    const pollId = setInterval(() => {
      void refreshThread();
    }, POLL_MS);
    return () => {
      clearInterval(pollId);
      reset();
    };
  }, [boot, refreshThread, reset]);

  useEffect(() => {
    initialScrollDoneRef.current = false;
    nearBottomRef.current = true;
    forceScrollRef.current = false;
    messagesLenRef.current = 0;
  }, [conversation?.id]);

  const scrollToLatest = useCallback((animated: boolean) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      // Full keyboard frame height from OS — lifts composer entirely above keyboard.
      const height = Math.ceil(e.endCoordinates.height);
      setKeyboardInset(height > 0 ? height : 0);
      if (nearBottomRef.current || forceScrollRef.current) {
        setTimeout(() => scrollToLatest(true), 50);
      }
    };
    const onHide = () => {
      setKeyboardInset(0);
    };

    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [scrollToLatest]);

  useEffect(() => {
    if (messages.length === 0 || initialScrollDoneRef.current) return;

    const timers = INITIAL_SCROLL_MS.map((ms, index) =>
      setTimeout(() => {
        scrollToLatest(false);
        if (index === INITIAL_SCROLL_MS.length - 1) {
          initialScrollDoneRef.current = true;
          messagesLenRef.current = messages.length;
        }
      }, ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [messages.length, conversation?.id, scrollToLatest]);

  useEffect(() => {
    const prev = messagesLenRef.current;
    const next = messages.length;
    if (next === prev) return;
    messagesLenRef.current = next;

    if (!initialScrollDoneRef.current) return;
    if (next <= prev) return;

    if (forceScrollRef.current || nearBottomRef.current) {
      scrollToLatest(true);
      forceScrollRef.current = false;
    }
  }, [messages.length, scrollToLatest]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    nearBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_PX;
  }, []);

  const onContentSizeChange = useCallback(() => {
    if (!initialScrollDoneRef.current) {
      scrollToLatest(false);
      return;
    }
    if (forceScrollRef.current || nearBottomRef.current) {
      scrollToLatest(true);
      forceScrollRef.current = false;
    }
  }, [scrollToLatest]);

  const keepComposerFocused = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const onSend = async () => {
    const text = draft;
    if (!text.trim()) return;
    forceScrollRef.current = true;
    nearBottomRef.current = true;
    // Keep focus through the press → send cycle (do not blur / dismiss).
    keepComposerFocused();
    const ok = await send(text);
    if (ok) {
      setDraft('');
      // Clear value without losing focus; re-assert focus after RN re-render.
      keepComposerFocused();
      requestAnimationFrame(() => {
        keepComposerFocused();
        scrollToLatest(true);
      });
    } else {
      forceScrollRef.current = false;
      keepComposerFocused();
    }
  };

  const statusText = conversation ? chatStatusLabel(conversation) : '…';
  const keyboardOpen = keyboardInset > 0;
  // Keyboard open: body lifts by OS keyboard height + small token gap; composer
  // keeps only a tight inner pad (safe-area already cleared by keyboardInset).
  const bodyKeyboardPad = keyboardOpen
    ? keyboardInset + COMPOSER_ABOVE_KEYBOARD_GAP
    : 0;
  const composerPadBottom = keyboardOpen ? spacing.sm : Math.max(insets.bottom, 10);

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
          <View style={styles.topMeta}>
            <Text style={styles.topTitle}>Chat CS</Text>
            <Text style={styles.topSub} numberOfLines={1}>
              GurkyNet Customer Service
            </Text>
            <Text style={styles.topStatus} numberOfLines={1}>
              {statusText}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {loading && !conversation ? (
          <LoadingState label="Membuka chat…" />
        ) : error && !conversation ? (
          <ErrorState message={error} onRetry={boot} />
        ) : (
          <View style={[styles.body, { paddingBottom: bodyKeyboardPad }]}>
            <FlatList
              ref={listRef}
              style={styles.list}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.listContent}
              onScroll={onScroll}
              scrollEventThrottle={16}
              onContentSizeChange={onContentSizeChange}
              onLayout={() => {
                if (!initialScrollDoneRef.current && messages.length > 0) {
                  scrollToLatest(false);
                }
              }}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="on-drag"
              renderItem={({ item }) => {
                const mine = item.senderRole === 'user';
                const system = item.senderRole === 'system';
                if (system) {
                  return (
                    <View style={styles.systemBubble}>
                      <Text style={styles.systemText}>{item.body}</Text>
                    </View>
                  );
                }
                return (
                  <View style={[styles.bubbleWrap, mine ? styles.mineWrap : styles.theirsWrap]}>
                    {!mine && item.senderName ? (
                      <Text style={styles.agentName}>{item.senderName}</Text>
                    ) : null}
                    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                      <Text style={[styles.bubbleText, mine && styles.mineText]}>{item.body}</Text>
                      {item.createdAt ? (
                        <Text style={[styles.bubbleTime, mine && styles.mineTime]}>
                          {formatMessageTime(item.createdAt)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyHint}>
                  Kirim pesan untuk memulai chat dengan Customer Service GurkyNet.
                </Text>
              }
            />

            {sendError ? (
              <View style={styles.sendError}>
                <Text style={styles.sendErrorText}>{sendError}</Text>
              </View>
            ) : null}

            <View style={[styles.composer, { paddingBottom: composerPadBottom }]}>
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={setDraft}
                placeholder="Tulis pesan..."
                placeholderTextColor={colors.gray[400]}
                style={styles.input}
                multiline
                maxLength={5000}
                textAlignVertical="top"
                blurOnSubmit={false}
                // Do NOT tie editable to `sending` — Android blurs + dismisses keyboard
                // when editable flips to false mid-send.
                editable={conversation?.status !== 'closed'}
                showSoftInputOnFocus
                onFocus={() => {
                  if (nearBottomRef.current) {
                    setTimeout(() => scrollToLatest(true), 80);
                  }
                }}
              />
              <Pressable
                onPressIn={keepComposerFocused}
                onPress={() => void onSend()}
                disabled={sending || !draft.trim() || conversation?.status === 'closed'}
                style={[
                  styles.sendBtn,
                  (!draft.trim() || sending) && styles.sendBtnDisabled,
                ]}
                accessibilityLabel="Kirim pesan"
              >
                <Ionicons name="send" size={18} color={colors.white} />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray[50] },
  body: { flex: 1 },
  list: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topMeta: { flex: 1, minWidth: 0 },
  topTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  topSub: {
    fontSize: 11,
    color: colors.gray[600],
    marginTop: 1,
  },
  topStatus: {
    fontSize: 10,
    color: colors.gray[400],
    marginTop: 1,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
  },
  emptyHint: {
    textAlign: 'center',
    color: colors.gray[400],
    fontSize: typography.size.sm,
    marginTop: spacing['3xl'],
    paddingHorizontal: spacing.lg,
  },
  systemBubble: {
    alignSelf: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    maxWidth: '90%',
  },
  systemText: {
    fontSize: 11,
    color: colors.gray[500],
    textAlign: 'center',
  },
  bubbleWrap: { maxWidth: '82%', gap: 2 },
  mineWrap: { alignSelf: 'flex-end' },
  theirsWrap: { alignSelf: 'flex-start' },
  agentName: {
    fontSize: 10,
    color: colors.gray[500],
    marginLeft: 4,
  },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mine: {
    backgroundColor: colors.primary[600],
    borderBottomRightRadius: 4,
  },
  theirs: {
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: typography.size.sm,
    color: colors.gray[900],
    lineHeight: 20,
  },
  mineText: { color: colors.white },
  bubbleTime: {
    fontSize: 10,
    color: colors.gray[400],
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  mineTime: { color: 'rgba(255,255,255,0.75)' },
  sendError: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  sendErrorText: {
    fontSize: 12,
    color: colors.status.failed,
    textAlign: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[200],
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: typography.size.sm,
    color: colors.gray[900],
    backgroundColor: colors.gray[50],
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.gray[300],
  },
});
