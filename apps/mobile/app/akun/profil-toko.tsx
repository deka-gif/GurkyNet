import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { ScreenContainer, Button, Card } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import {
  createEmptyStoreProfile,
  receiptSettingsService,
  type StoreProfile,
} from '../../src/services/receiptSettings.service';
import { useAuthStore } from '../../src/store/auth.store';

/**
 * Profil Toko — store identity + closing message for receipts (per-user SecureStore).
 */
export default function ProfilTokoScreen() {
  const userName = useAuthStore((s) => s.user?.name);
  const [profile, setProfile] = useState<StoreProfile>(createEmptyStoreProfile());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, error = false) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, error });
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  const load = useCallback(async () => {
    setProfile(await receiptSettingsService.getStoreProfile());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const previewName =
    profile.storeName.trim() || (userName || '').trim() || 'GurkyNet';

  const preview = useMemo(() => {
    const lines = [previewName];
    if (profile.address.trim()) lines.push(profile.address.trim());
    if (profile.whatsapp.trim()) lines.push(`WA: ${profile.whatsapp.trim()}`);
    if (profile.closingMessage.trim()) lines.push(profile.closingMessage.trim());
    return lines.join('\n');
  }, [previewName, profile.address, profile.whatsapp, profile.closingMessage]);

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await receiptSettingsService.setStoreProfile(profile);
      const verified = await receiptSettingsService.getStoreProfile();
      setProfile(verified);
      showToast('Profil toko berhasil disimpan.');
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan profil toko.', true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenContainer scroll belowHeader>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Profil Toko',
            headerBackTitle: 'Kembali',
          }}
        />

        <Card style={styles.card}>
          <Text style={styles.label}>Nama toko</Text>
          <TextInput
            style={styles.input}
            value={profile.storeName}
            onChangeText={(storeName) => setProfile((p) => ({ ...p, storeName }))}
            placeholder={userName || 'Nama toko / konter'}
            placeholderTextColor={colors.gray[400]}
          />
          <Text style={styles.hint}>
            Kosongkan untuk memakai nama akun ({userName || '—'}) atau GurkyNet.
          </Text>

          <Text style={styles.label}>Alamat (opsional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={profile.address}
            onChangeText={(address) => setProfile((p) => ({ ...p, address }))}
            placeholder="Alamat toko"
            placeholderTextColor={colors.gray[400]}
            multiline
          />

          <Text style={styles.label}>WhatsApp (opsional)</Text>
          <TextInput
            style={styles.input}
            value={profile.whatsapp}
            onChangeText={(whatsapp) => setProfile((p) => ({ ...p, whatsapp }))}
            placeholder="08…"
            placeholderTextColor={colors.gray[400]}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Pesan penutup struk (opsional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={profile.closingMessage}
            onChangeText={(closingMessage) => setProfile((p) => ({ ...p, closingMessage }))}
            placeholder="Terima kasih sudah berbelanja."
            placeholderTextColor={colors.gray[400]}
            multiline
          />
          <Text style={styles.hint}>
            Pesan ini akan muncul di bagian bawah struk jika diaktifkan di Template Struk.
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Pratinjau header struk</Text>
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>{preview}</Text>
          </View>
        </Card>

        <Button label="Simpan" onPress={() => void onSave()} loading={saving} disabled={saving} />
      </ScreenContainer>

      {toast ? (
        <View
          style={[styles.toast, toast.error ? styles.toastError : styles.toastOk]}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  card: { gap: spacing.sm },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
    marginTop: spacing.xs,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[300],
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.size.sm,
    color: colors.gray[900],
    backgroundColor: colors.white,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  hint: { fontSize: typography.size.xs, color: colors.gray[500], lineHeight: 18 },
  sectionTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  previewBox: {
    backgroundColor: colors.gray[50],
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
  },
  previewText: {
    fontSize: typography.size.sm,
    color: colors.gray[900],
    textAlign: 'center',
    lineHeight: 20,
  },
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    borderRadius: radius.lg,
    padding: spacing.md,
    zIndex: 20,
    elevation: 6,
  },
  toastOk: { backgroundColor: colors.gray[800] },
  toastError: { backgroundColor: colors.status.failed },
  toastText: {
    color: colors.white,
    fontSize: typography.size.sm,
    textAlign: 'center',
    fontWeight: typography.weight.bold,
  },
});
