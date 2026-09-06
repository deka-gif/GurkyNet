import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  ScreenContainer,
  LoadingState,
  ErrorState,
} from '../../../src/components/ui';
import {
  accountContentService,
  plainTextFromHtml,
} from '../../../src/services/accountContent.service';
import { parseApiError } from '../../../src/api/client';
import { colors, spacing, typography } from '../../../src/theme';

type Kind = 'terms' | 'privacy' | 'about';

const TITLES: Record<Kind, string> = {
  terms: 'Syarat & Ketentuan',
  privacy: 'Kebijakan Privasi',
  about: 'Tentang GurkyNet',
};

function isKind(v: string): v is Kind {
  return v === 'terms' || v === 'privacy' || v === 'about';
}

/**
 * Thin CMS reader — GET /terms | /privacy | /about (AccountContentController).
 */
export default function AccountLegalScreen() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kindRaw = typeof params.kind === 'string' ? params.kind : '';
  const kind: Kind = isKind(kindRaw) ? kindRaw : 'about';

  const [title, setTitle] = useState(TITLES[kind]);
  const [body, setBody] = useState('');
  const [meta, setMeta] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (kind === 'terms') {
        const res = await accountContentService.getTerms();
        if (!res.success || !res.data) throw new Error(res.message || 'Gagal memuat.');
        setTitle(res.data.title || TITLES.terms);
        setBody(plainTextFromHtml(res.data.content));
        setMeta(null);
      } else if (kind === 'privacy') {
        const res = await accountContentService.getPrivacy();
        if (!res.success || !res.data) throw new Error(res.message || 'Gagal memuat.');
        setTitle(res.data.title || TITLES.privacy);
        setBody(plainTextFromHtml(res.data.content));
        setMeta(null);
      } else {
        const res = await accountContentService.getAbout();
        if (!res.success || !res.data) throw new Error(res.message || 'Gagal memuat.');
        setTitle(res.data.title || TITLES.about);
        setBody(plainTextFromHtml(res.data.content));
        const bits = [res.data.appName, res.data.version ? `Versi ${res.data.version}` : null]
          .filter(Boolean)
          .join(' · ');
        setMeta(bits || null);
      }
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      setError(parsed.message || 'Gagal memuat konten.');
      setBody('');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScreenContainer belowHeader scroll>
      <Stack.Screen
        options={{ headerShown: true, title: TITLES[kind], headerBackTitle: 'Kembali' }}
      />

      {loading ? (
        <LoadingState label="Memuat..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <View style={styles.block}>
          <Text style={styles.docTitle}>{title}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          <Text style={styles.body}>{body || 'Konten belum tersedia.'}</Text>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md, paddingBottom: spacing.xl },
  docTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  meta: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
  },
  body: {
    fontSize: typography.size.sm,
    color: colors.gray[700],
    lineHeight: 22,
  },
});
