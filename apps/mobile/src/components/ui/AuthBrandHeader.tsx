import { Image, StyleSheet, Text, View } from 'react-native';
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { PlatformLogo } from './PlatformLogo';
import { useWebsiteStore } from '../../store/website.store';
import { colors, spacing, typography } from '../../theme';

type Props = {
  subtitle?: string;
  compact?: boolean;
};

/**
 * GurkyPay / GurkyNet brand mark for auth screens.
 * Prefers Marketing platform logo; falls back to splash asset then wordmark.
 */
export function AuthBrandHeader({ subtitle, compact = false }: Props) {
  const logo = useWebsiteStore((s) => s.logo);
  const websiteName = useWebsiteStore((s) => s.websiteName);
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_800ExtraBold,
  });

  const logoHeight = compact ? 52 : 72;
  const fallbackSize = compact ? 60 : 80;

  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      {logo ? (
        <PlatformLogo logo={logo} height={logoHeight} contentScale={1.22} />
      ) : (
        <Image
          source={require('../../../assets/splash-icon.png')}
          style={{ width: fallbackSize, height: fallbackSize }}
          resizeMode="contain"
          accessibilityLabel="GurkyPay"
        />
      )}
      <Text
        style={[
          styles.brand,
          compact && styles.brandCompact,
          fontsLoaded && styles.brandModern,
        ]}
      >
        {websiteName || 'GurkyPay'}
      </Text>
      {subtitle ? (
        <Text style={[styles.sub, fontsLoaded && styles.subModern]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  compact: { marginBottom: spacing.md },
  brand: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.black,
    color: colors.gray[900],
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  brandCompact: {
    fontSize: typography.size.xl,
  },
  brandModern: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: '400',
  },
  sub: {
    fontSize: typography.size.base,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
    letterSpacing: 0.15,
  },
  subModern: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontWeight: '400',
  },
});
