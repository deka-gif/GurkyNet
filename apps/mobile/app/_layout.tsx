import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/auth.store';
import { appEvents, AUTH_UNAUTHORIZED_EVENT } from '../src/utils/eventEmitter';

/**
 * Root layout — runs once for the whole app.
 * 1. Hydrates the auth store from secure storage (never trust in-memory state alone,
 *    the app may have been killed and relaunched).
 * 2. Listens for the global "session expired" event fired by the API client's 401
 *    interceptor and forces the user back to the login stack — the RN equivalent of
 *    web's `window.addEventListener('auth-unauthorized', ...)` in App.tsx.
 */
export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const router = useRouter();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const unsubscribe = appEvents.on(AUTH_UNAUTHORIZED_EVENT, () => {
      useAuthStore.setState({ user: null, token: null });
      router.replace('/(auth)/login');
    });
    return unsubscribe;
  }, [router]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}
