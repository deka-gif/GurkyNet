import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Announcement } from '../../services/announcement.service';
import { colors, typography } from '../../theme';

type AnnouncementTickerProps = {
  announcements: Announcement[];
};

const SPEED_DP_PER_SEC = 40;
const BETWEEN_ITEM_PAUSE_MS = 1000;
const FONT_SIZE = 14;
const LINE_HEIGHT = 20;
const TICKER_HEIGHT = 34;
/** Announcement → Banner gap (4–6dp). */
export const ANNOUNCEMENT_BANNER_GAP = 6;

/**
 * Wide unconstrained measure lane so Yoga does not clamp Text to viewport width.
 * Must pair with alignItems:'flex-start' or Text stretches to this width.
 */
const MEASURE_LANE_WIDTH = 10000;

/** AnnouncementResource.`message` only — never title. */
export function getTickerMessages(announcements: Announcement[]): string[] {
  return announcements
    .map((a) => (a.message || '').trim())
    .filter((m) => m.length > 0);
}

/**
 * Horizontal one-line marquee (per message, sequential).
 *
 * Prior bug: measure Text inherited root width (352) → textWidth === viewportWidth
 * → wrap to 2 lines + endX = -viewportWidth (incomplete scroll).
 *
 * Fix: measure in a 10000dp lane with alignItems:flex-start + numberOfLines={1}
 * outside overflow:hidden, so onLayout returns intrinsic single-line width.
 */
export function AnnouncementTicker({ announcements }: AnnouncementTickerProps) {
  const messages = useMemo(() => getTickerMessages(announcements), [announcements]);

  const [index, setIndex] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);
  const offsetRef = useRef(0);
  const indexRef = useRef(0);
  const dimsRef = useRef({ viewport: 0, text: 0 });
  const messagesRef = useRef(messages);
  const advanceRef = useRef<() => void>(() => {});
  const runRef = useRef<(from?: number) => void>(() => {});
  const measureGenRef = useRef(0);

  const currentMessage = messages[index] ?? '';

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    setIndex(0);
    indexRef.current = 0;
    setTextWidth(0);
    measureGenRef.current += 1;
  }, [messages]);

  useEffect(() => {
    const id = translateX.addListener(({ value }) => {
      offsetRef.current = value;
    });
    return () => {
      translateX.removeListener(id);
      animRef.current?.stop();
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    };
  }, [translateX]);

  const clearPauseTimer = () => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  };

  const runMarquee = useCallback(
    (fromValue?: number) => {
      const { viewport, text: tw } = dimsRef.current;
      if (viewport <= 0 || tw <= 0 || pausedRef.current) return;
      if (messagesRef.current.length === 0) return;

      // Full pass: enter from right edge → exit past left edge of full text.
      const endAt = -tw;
      const current = fromValue ?? offsetRef.current;
      const remaining = Math.max(0, current - endAt);
      const durationMs = Math.max(600, (remaining / SPEED_DP_PER_SEC) * 1000);

      animRef.current?.stop();
      translateX.setValue(current);
      offsetRef.current = current;

      animRef.current = Animated.timing(translateX, {
        toValue: endAt,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      });

      animRef.current.start(({ finished }) => {
        if (!finished || pausedRef.current) return;
        clearPauseTimer();
        pauseTimerRef.current = setTimeout(() => {
          pauseTimerRef.current = null;
          if (pausedRef.current) return;
          advanceRef.current();
        }, BETWEEN_ITEM_PAUSE_MS);
      });
    },
    [translateX]
  );

  const advanceAfterPause = useCallback(() => {
    const list = messagesRef.current;
    if (list.length === 0) return;
    const next = (indexRef.current + 1) % list.length;
    indexRef.current = next;
    setTextWidth(0);
    measureGenRef.current += 1;
    setIndex(next);
  }, []);

  useEffect(() => {
    advanceRef.current = advanceAfterPause;
    runRef.current = runMarquee;
  }, [advanceAfterPause, runMarquee]);

  useEffect(() => {
    dimsRef.current = { viewport: viewportWidth, text: textWidth };
    animRef.current?.stop();
    clearPauseTimer();

    if (!currentMessage || viewportWidth <= 0 || textWidth <= 0) return;

    translateX.setValue(viewportWidth);
    offsetRef.current = viewportWidth;
    if (!pausedRef.current) {
      runMarquee(viewportWidth);
    }

    return () => {
      animRef.current?.stop();
      clearPauseTimer();
    };
  }, [currentMessage, viewportWidth, textWidth, translateX, runMarquee]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <View style={styles.root}>
      {/*
        Intrinsic measure lane — OUTSIDE overflow:hidden viewport.
        width:10000 + alignItems:flex-start prevents clamp-to-parent (352) wrap.
        No opacity:0 (Android onLayout). Parked off-screen.
      */}
      <View style={styles.measureHost} pointerEvents="none" collapsable={false}>
        <Text
          key={`measure-${measureGenRef.current}-${index}`}
          numberOfLines={1}
          style={styles.measureText}
          onLayout={(e) => {
            const w = Math.ceil(e.nativeEvent.layout.width);
            // Ignore bogus clamp-to-lane measurements; keep waiting for real intrinsic.
            if (w <= 0 || w >= MEASURE_LANE_WIDTH - 1) return;
            setTextWidth(w);
          }}
        >
          {currentMessage}
        </Text>
      </View>

      <Pressable
        onPressIn={() => {
          pausedRef.current = true;
          animRef.current?.stop();
          clearPauseTimer();
        }}
        onPressOut={() => {
          pausedRef.current = false;
          runRef.current(offsetRef.current);
        }}
        accessibilityRole="text"
        accessibilityLabel={`Pengumuman: ${messages.join('. ')}`}
        style={styles.viewport}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w > 0 && w !== viewportWidth) setViewportWidth(w);
        }}
      >
        {textWidth > 0 ? (
          <Animated.View
            style={[
              styles.track,
              { width: textWidth, transform: [{ translateX }] },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.text, { width: textWidth }]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {currentMessage}
            </Text>
          </Animated.View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    alignSelf: 'stretch',
    marginBottom: ANNOUNCEMENT_BANNER_GAP,
  },
  measureHost: {
    position: 'absolute',
    left: 0,
    top: -1000,
    width: MEASURE_LANE_WIDTH,
    // Critical: without this, children stretch to MEASURE_LANE_WIDTH / parent.
    alignItems: 'flex-start',
    zIndex: -1,
  },
  measureText: {
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    fontWeight: typography.weight.regular,
    color: colors.gray[900],
    includeFontPadding: false,
    flexShrink: 0,
    // No width / maxWidth — intrinsic single-line width only.
  },
  viewport: {
    width: '100%',
    height: TICKER_HEIGHT,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  track: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    height: TICKER_HEIGHT,
    flexShrink: 0,
  },
  text: {
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    fontWeight: typography.weight.regular,
    color: colors.gray[900],
    includeFontPadding: false,
    textAlignVertical: 'center',
    flexShrink: 0,
  },
});
