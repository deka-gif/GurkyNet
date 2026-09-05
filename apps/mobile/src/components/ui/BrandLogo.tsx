import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, typography } from '../../theme';
import { marketingLogoPath, resolveMediaUrl } from '../../utils/mediaUrl';

type BrandLogoProps = {
  /** Customer-facing brand/operator name (Telkomsel, XL, …) — never Digiflazz/VIP. */
  name: string;
  /** Raw `providerDetails.logo` from ProductResource (may be placeholder). */
  logo?: string | null;
  size?: number;
  style?: ViewStyle;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * Brand/operator avatar — Marketing logo when valid, else initials.
 * Mirrors web BrandAvatar presentation intent (FR-OPS-03 curated assets).
 */
export function BrandLogo({ name, logo, size = 40, style }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);
  const path = marketingLogoPath(logo);
  const uri = path ? resolveMediaUrl(path) : '';
  const showImage = Boolean(uri) && !failed;

  useEffect(() => {
    setFailed(false);
  }, [logo]);

  if (showImage) {
    return (
      <View style={[styles.frame, { width: size, height: size, borderRadius: size * 0.28 }, style]}>
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel={name}
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size * 0.28 },
        style,
      ]}
      accessibilityLabel={name}
    >
      <Text style={[styles.initials, { fontSize: Math.max(10, size * 0.32) }]}>{initials(name || '?')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.white,
    fontWeight: typography.weight.black,
  },
});
