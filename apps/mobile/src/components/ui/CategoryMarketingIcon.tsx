import { useEffect, useState, ReactNode } from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import { resolveMediaUrl } from '../../utils/mediaUrl';

type CategoryMarketingIconProps = {
  /** Disk-relative path from GET /catalog/category-icons, or null. */
  iconPath?: string | null;
  size?: number;
  /**
   * Soft zoom to offset transparent canvas padding in Marketing PNGs
   * (no backend crop; pure UI scale). Default 1.22.
   */
  contentScale?: number;
  /** Ionicons (or other) fallback when Marketing asset is missing/fails. */
  fallback: ReactNode;
  style?: ViewStyle;
};

/**
 * Marketing category icon — transparent float, larger perceived size via soft scale.
 * Never shows a broken image; falls back to Ionicons.
 */
export function CategoryMarketingIcon({
  iconPath,
  size = 36,
  contentScale = 1.22,
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
    <View style={[{ width: size, height: size, overflow: 'hidden' }, style]}>
      <Image
        source={{ uri }}
        style={[
          styles.image,
          {
            transform: [{ scale: contentScale }],
          },
        ]}
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
