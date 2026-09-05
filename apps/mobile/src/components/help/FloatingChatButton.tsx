import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../../theme';

/** Matches `(tabs)/_layout` tabBarStyle height. */
const TAB_BAR_HEIGHT = 58;
const FAB_SIZE = 52;

/**
 * Floating Chat CS — Help Center tab only (mounted from help.tsx, not root layout).
 * Opens existing /help/chat. Not rendered on Home/Riwayat/Wallet/Akun/Chat/Auth.
 */
export function FloatingChatButton() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // tab bar + safe area + 16 gap — stays clear of bottom nav and last content.
  const bottom = TAB_BAR_HEIGHT + Math.max(insets.bottom, 0) + 16;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        onPress={() => router.push('/help/chat')}
        style={[styles.fab, { bottom, right: 16 + Math.max(insets.right, 0) }]}
        accessibilityLabel="Chat dengan Customer Service"
        accessibilityRole="button"
      >
        <Ionicons name="chatbubble-ellipses" size={24} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 50,
  },
});
