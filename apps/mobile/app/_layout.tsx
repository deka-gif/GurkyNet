import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/auth.store';
import { useFeaturesStore } from '../src/store/features.store';
import { useNotificationStore } from '../src/store/notification.store';
import { appEvents, AUTH_UNAUTHORIZED_EVENT } from '../src/utils/eventEmitter';
import { storageService } from '../src/services/storage.service';
import { pushNotificationService } from '../src/services/pushNotification.service';
import { PushPermissionPreprompt } from '../src/components/notifications/PushPermissionPreprompt';

/**
 * Root layout — runs once for the whole app.
 * 1. Hydrates the auth store from secure storage.
 * 2. Loads GET /features (fail-closed purchase gate until resolved).
 * 3. Listens for session-expired and forces login.
 * 4. Push notification listeners + soft permission pre-prompt.
 */
export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const gate = useAuthStore((s) => s.gate);
  const fetchFeatures = useFeaturesStore((s) => s.fetchFeatures);
  const router = useRouter();
  const [showPushPreprompt, setShowPushPreprompt] = useState(false);

  useEffect(() => {
    hydrate();
    void fetchFeatures();
  }, [hydrate, fetchFeatures]);

  useEffect(() => {
    const unsubscribe = appEvents.on(AUTH_UNAUTHORIZED_EVENT, () => {
      void (async () => {
        try {
          await pushNotificationService.disassociateDevice();
        } catch {
          // ignore
        }
        await storageService.clear();
        useNotificationStore.getState().reset();
        const identity = await storageService.getRememberedIdentity();
        useAuthStore.setState({
          user: null,
          token: null,
          rememberedIdentity: identity,
          gate: identity ? 'unlock' : 'login',
        });
        router.replace(identity ? '/(auth)/unlock' : '/(auth)/login');
      })();
    });
    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (gate !== 'authenticated') return;
    const detach = pushNotificationService.attachListeners();
    void pushNotificationService.handleLastResponse();
    return detach;
  }, [gate]);

  useEffect(() => {
    if (gate !== 'authenticated') {
      setShowPushPreprompt(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const seen = await storageService.hasSeenPushPreprompt();
        const status = await pushNotificationService.getPermissionStatus();
        if (cancelled) return;
        if (!seen && status !== 'granted') {
          setShowPushPreprompt(true);
        } else if (status === 'granted') {
          await pushNotificationService.syncPushTokenWithBackend();
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gate]);

  const onLater = async () => {
    setShowPushPreprompt(false);
    await storageService.markPushPrepromptSeen();
  };

  const onAllow = async () => {
    setShowPushPreprompt(false);
    await storageService.markPushPrepromptSeen();
    await pushNotificationService.syncPushTokenWithBackend();
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <PushPermissionPreprompt
        visible={showPushPreprompt}
        onLater={() => void onLater()}
        onAllow={() => void onAllow()}
      />
    </SafeAreaProvider>
  );
}
