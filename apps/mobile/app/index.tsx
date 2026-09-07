import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../src/store/auth.store';
import { useWebsiteStore } from '../src/store/website.store';
import { colors, spacing, typography } from '../src/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * Bootstrap — wait hydrate, then route WITHOUT flashing Login for returning users.
 * gate: unlock | login | authenticated
 */
export default function Index() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const gate = useAuthStore((s) => s.gate);
  const token = useAuthStore((s) => s.token);
  const fetchSettings = useWebsiteStore((s) => s.fetchSettings);
  const [minSplashDone, setMinSplashDone] = useState(false);

  useEffect(() => {
    void fetchSettings();
    const t = setTimeout(() => setMinSplashDone(true), 700);
    return () => clearTimeout(t);
  }, [fetchSettings]);

  useEffect(() => {
    if (hydrated && minSplashDone) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [hydrated, minSplashDone]);

  if (!hydrated || !minSplashDone) {
    return (
      <View style={styles.splash}>
        <Image
          source={require('../assets/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="GurkyPay"
        />
        <Text style={styles.brand}>GurkyPay</Text>
        <ActivityIndicator color={colors.white} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  if (gate === 'authenticated' && token) {
    return <Redirect href="/(tabs)/home" />;
  }
  if (gate === 'unlock') {
    return <Redirect href="/(auth)/unlock" />;
  }
  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
  },
  logo: { width: 96, height: 96 },
  brand: {
    marginTop: spacing.md,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.white,
  },
});
