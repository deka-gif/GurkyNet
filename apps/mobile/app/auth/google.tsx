import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { authService } from '../../src/services/auth.service';
import { storageService } from '../../src/services/storage.service';
import { parseApiError } from '../../src/api/client';
import { colors, spacing, typography } from '../../src/theme';

function firstString(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) {
    return value[0];
  }
  return null;
}

/**
 * Deep-link catcher for Google OAuth redirect (`…/auth/google`).
 * Reads token / google_token / google_error from query or Linking URL,
 * then routes to session home, google-complete, or login with error.
 */
export default function GoogleAuthDeepLinkScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    token?: string | string[];
    google_token?: string | string[];
    google_error?: string | string[];
  }>();
  const applySession = useAuthStore((s) => s.applySession);
  const [message, setMessage] = useState('Memproses login Google…');
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    void (async () => {
      try {
        let token = firstString(params.token);
        let googleToken = firstString(params.google_token);
        let googleError = firstString(params.google_error);

        if (!token && !googleToken && !googleError) {
          const url = await Linking.getInitialURL();
          if (url) {
            const parsed = Linking.parse(url);
            const q = parsed.queryParams || {};
            token = typeof q.token === 'string' ? q.token : token;
            googleToken = typeof q.google_token === 'string' ? q.google_token : googleToken;
            googleError = typeof q.google_error === 'string' ? q.google_error : googleError;
          }
        }

        if (googleError) {
          router.replace({
            pathname: '/(auth)/login',
            params: { google_error: googleError },
          });
          return;
        }

        if (googleToken) {
          router.replace({
            pathname: '/(auth)/google-complete',
            params: { google_token: googleToken },
          });
          return;
        }

        if (token) {
          setMessage('Mengambil profil…');
          await storageService.setToken(token);
          const meRes = await authService.me();
          if (meRes.success) {
            const payload: unknown = meRes.data;
            const userRaw =
              payload &&
              typeof payload === 'object' &&
              'user' in (payload as Record<string, unknown>)
                ? (payload as { user: unknown }).user
                : payload;
            await applySession(token, userRaw);
            const user = useAuthStore.getState().user;
            if (user && !user.hasPin) {
              router.replace('/(auth)/setup-pin');
              return;
            }
            router.replace('/(tabs)/home');
            return;
          }
          router.replace({
            pathname: '/(auth)/login',
            params: {
              google_error: meRes.message || 'Gagal mengambil profil setelah Google login.',
            },
          });
          return;
        }

        router.replace({
          pathname: '/(auth)/login',
          params: { google_error: 'Respons Google tidak dikenali.' },
        });
      } catch (err: unknown) {
        const parsed = parseApiError(err);
        router.replace({
          pathname: '/(auth)/login',
          params: { google_error: parsed.message || 'Login Google gagal.' },
        });
      }
    })();
  }, [applySession, params.google_error, params.google_token, params.token, router]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.primary[600]} size="large" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    padding: spacing['2xl'],
  },
  text: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    textAlign: 'center',
  },
});
