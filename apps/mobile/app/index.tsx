import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../src/store/auth.store';
import { useWebsiteStore } from '../src/store/website.store';
import { colors, spacing, typography } from '../src/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * Bootstrap — wait hydrate (+ server session check when token exists), then route.
 * gate: unlock | login | authenticated — never route while gate === 'booting'.
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
    if (hydrated && minSplashDone && gate !== 'booting') {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [hydrated, minSplashDone, gate]);

  if (!hydrated || !minSplashDone || gate === 'booting') {
    return (
      <View style={styles.splash}>
        <Image
          source={require('../assets/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="GurkyNet"
        />
        <Text style={styles.brand}>GurkyNet</Text>
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
    backgroundColor: colors.primary[700],
  },
  logo: { width: 112, height: 112 },
  brand: {
    marginTop: spacing.md,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.white,
  },
});
