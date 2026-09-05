import { useEffect, useState, ReactNode } from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import { resolveMediaUrl } from '../../utils/mediaUrl';

type CategoryMarketingIconProps = {
  /** Disk-relative path from GET /catalog/category-icons, or null. */
  iconPath?: string | null;
  size?: number;
  /** Ionicons (or other) fallback when Marketing asset is missing/fails. */
  fallback: ReactNode;
  style?: ViewStyle;
};

/**
 * Renders a Marketing category icon when a valid media path exists;
 * otherwise renders the provided Ionicons fallback. Never shows a broken image.
 */
export function CategoryMarketingIcon({
  iconPath,
  size = 22,
  fallback,
  style,
}: CategoryMarketingIconProps) {
  const [failed, setFailed] = useState(false);
  const uri = iconPath ? resolveMediaUrl(iconPath) : '';
  const showImage = Boolean(uri) && !failed;

  useEffect(() => {
    setFailed(false);
  }, [iconPath]);

  if (!showImage) {
    return <>{fallback}</>;
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Image
        source={{ uri }}
        style={styles.image}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
