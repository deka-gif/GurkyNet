import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/store/auth.store';
import { colors } from '../src/theme';

/**
 * Entry route — waits for the secure-storage hydrate() to finish before deciding where
 * to send the user, so an already-logged-in user never flashes the login screen on
 * cold start.
 */
export default function Index() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);

  if (!hydrated) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return <Redirect href={token ? '/(tabs)/home' : '/(auth)/login'} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
});
