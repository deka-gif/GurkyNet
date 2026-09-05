import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, typography } from '../../theme';
import { resolveMediaSrc } from '../../utils/mediaUrl';
import type { WebsiteLogoValue } from '../../services/website.service';

type PlatformLogoProps = {
  logo?: WebsiteLogoValue;
  /** Display height; width follows a compact slot (not oversized empty space). */
  height?: number;
  /**
   * Soft zoom so Marketing PNGs with transparent canvas padding look fuller
   * without widening the reserved layout slot.
   */
  contentScale?: number;
  style?: ViewStyle;
};

/**
 * GurkyNet platform logo from Marketing Website Settings.
 * Transparent — no white card/border behind the asset.
 */
export function PlatformLogo({ logo, height = 36, contentScale = 1.18, style }: PlatformLogoProps) {
  const [failed, setFailed] = useState(false);
  const uri = resolveMediaSrc(logo);
  const showImage = Boolean(uri) && !failed;

  useEffect(() => {
    setFailed(false);
  }, [logo]);

  if (showImage) {
    // Tight slot (~1.35:1) — visual fill via contentScale, not empty reserved width.
    return (
      <View
        style={[
          {
            height,
            width: height * 1.35,
            justifyContent: 'center',
            alignItems: 'flex-start',
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%', transform: [{ scale: contentScale }] }}
          resizeMode="contain"
          accessibilityLabel="GurkyNet"
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.fallback, { height, width: height, borderRadius: height * 0.28 }, style]}>
      <Text style={[styles.fallbackText, { fontSize: Math.max(12, height * 0.42) }]}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: colors.white,
    fontWeight: typography.weight.black,
  },
});
