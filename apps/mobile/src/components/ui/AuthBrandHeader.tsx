import { Image, StyleSheet, Text, View } from 'react-native';
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

  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      {logo ? (
        <PlatformLogo logo={logo} height={compact ? 40 : 52} />
      ) : (
        <Image
          source={require('../../../assets/splash-icon.png')}
          style={{ width: compact ? 48 : 64, height: compact ? 48 : 64 }}
          resizeMode="contain"
          accessibilityLabel="GurkyPay"
        />
      )}
      <Text style={styles.brand}>{websiteName || 'GurkyPay'}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
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
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  sub: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
});
