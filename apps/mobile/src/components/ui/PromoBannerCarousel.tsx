import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Banner } from '../../services/banner.service';
import { colors, radius, spacing } from '../../theme';
import { resolveMediaUrl } from '../../utils/mediaUrl';

type PromoBannerCarouselProps = {
  banners: Banner[];
};

/** Prefer Marketing mobile asset; fall back to desktop image (BannerResource already absolute). */
export function bannerImageUrl(banner: Banner): string {
  const raw =
    banner.mobileImageUrl ||
    banner.mobile_image_url ||
    banner.image ||
    banner.imageUrl ||
    '';
  return resolveMediaUrl(raw);
}

/**
 * Only open http(s) CTAs — mobile has no /dashboard/promo screen.
 * Internal web paths are ignored (banner stays non-clickable).
 */
function openBannerAction(banner: Banner): void {
  const url = (banner.redirectUrl || banner.ctaUrl || '').trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) return;
  void Linking.openURL(url).catch(() => {
    /* ignore — marketing CTA must not break Home */
  });
}

/**
 * Compact Marketing promo carousel for Home.
 * Data must come from GET /public/banners (same CMS as web).
 */
export function PromoBannerCarousel({ banners }: PromoBannerCarouselProps) {
  const [index, setIndex] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const [failedIds, setFailedIds] = useState<Record<string, true>>({});
  const scrollRef = useRef<ScrollView>(null);
  const pausedRef = useRef(false);

  const visible = banners.filter((b) => {
    const uri = bannerImageUrl(b);
    return Boolean(uri) && !failedIds[b.id];
  });

  useEffect(() => {
    setIndex(0);
    if (slideWidth > 0) {
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [visible.length, slideWidth]);

  // Gentle autoplay — pause while user is interacting (mirrors web 5s interval).
  useEffect(() => {
    if (visible.length <= 1 || slideWidth <= 0) return;
    const timer = setInterval(() => {
      if (pausedRef.current) return;
      setIndex((prev) => {
        const next = (prev + 1) % visible.length;
        scrollRef.current?.scrollTo({ x: next * slideWidth, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [visible.length, slideWidth]);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (slideWidth <= 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
      setIndex(next);
    },
    [slideWidth]
  );

  if (visible.length === 0) {
    return null;
  }

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== slideWidth) setSlideWidth(w);
      }}
    >
      {slideWidth > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          onScrollBeginDrag={() => {
            pausedRef.current = true;
          }}
          onMomentumScrollEnd={(e) => {
            onScrollEnd(e);
            pausedRef.current = false;
          }}
          onScrollEndDrag={() => {
            pausedRef.current = false;
          }}
          style={styles.scroll}
        >
          {visible.map((banner) => {
            const uri = bannerImageUrl(banner);
            const clickable = /^https?:\/\//i.test((banner.redirectUrl || banner.ctaUrl || '').trim());
            const content = (
              <Image
                source={{ uri }}
                style={{ width: slideWidth, height: slideWidth / 2.4 }}
                resizeMode="cover"
                accessibilityLabel={banner.title}
                onError={() => setFailedIds((prev) => ({ ...prev, [banner.id]: true }))}
              />
            );

            return (
              <View key={banner.id} style={{ width: slideWidth, height: slideWidth / 2.4 }}>
                {clickable ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={banner.ctaLabel || banner.title}
                    onPress={() => openBannerAction(banner)}
                  >
                    {content}
                  </Pressable>
                ) : (
                  content
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={[styles.scroll, styles.placeholder]} />
      )}

      {visible.length > 1 && slideWidth > 0 ? (
        <View style={styles.dots} pointerEvents="none">
          {visible.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  scroll: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.gray[100],
  },
  placeholder: {
    aspectRatio: 2.4,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray[300],
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.primary[600],
  },
});
