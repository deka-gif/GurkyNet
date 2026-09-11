import { useEffect, useState, ReactNode } from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import { resolveMediaUrl } from '../../utils/mediaUrl';

/** Default inner padding so logos with edge-to-edge art don’t look larger than padded assets. */
export const SERVICE_ICON_PAD = 7;

type CategoryMarketingIconProps = {
  /** Disk-relative path from GET /catalog/category-icons, or null. */
  iconPath?: string | null;
  size?: number;
  /**
   * Soft zoom — prefer 1 so all logos share the same visual footprint.
   * Kept optional for rare call-site overrides.
   */
  contentScale?: number;
  /** Inner padding (px) inside the fixed slot. */
  pad?: number;
  /** Ionicons (or other) fallback when Marketing asset is missing/fails. */
  fallback: ReactNode;
  style?: ViewStyle;
};

/**
 * Marketing category icon — fixed slot, resizeMode contain, consistent inner pad.
 * Never shows a broken image; falls back to Ionicons.
 */
export function CategoryMarketingIcon({
  iconPath,
  size = 40,
  contentScale = 1,
  pad = SERVICE_ICON_PAD,
  fallback,
  style,
}: CategoryMarketingIconProps) {
  const [failed, setFailed] = useState(false);
  const uri = iconPath ? resolveMediaUrl(iconPath) : '';
  const showImage = Boolean(uri) && !failed;
  const inner = Math.max(8, size - pad * 2);

  useEffect(() => {
    setFailed(false);
  }, [iconPath]);

  if (!showImage) {
    return <>{fallback}</>;
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          padding: pad,
        },
        style,
      ]}
    >
      <Image
        source={{ uri }}
        style={[
          styles.image,
          {
            width: inner,
            height: inner,
            transform: contentScale === 1 ? undefined : [{ scale: contentScale }],
          },
        ]}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {},
});
