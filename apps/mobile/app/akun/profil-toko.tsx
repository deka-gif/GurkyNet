import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { ScreenContainer, Button, Card } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import {
  createEmptyStoreProfile,
  receiptSettingsService,
  type StoreProfile,
} from '../../src/services/receiptSettings.service';
import { useAuthStore } from '../../src/store/auth.store';

/**
 * Profil Toko — local identity for receipt header (no catatan field).
 */
export default function ProfilTokoScreen() {
  const userName = useAuthStore((s) => s.user?.name);
  const [profile, setProfile] = useState<StoreProfile>(createEmptyStoreProfile());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setProfile(await receiptSettingsService.getStoreProfile());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const previewName =
    profile.storeName.trim() || (userName || '').trim() || 'GurkyPay';

  const preview = useMemo(() => {
    const lines = [previewName];
    if (profile.address.trim()) lines.push(profile.address.trim());
    if (profile.whatsapp.trim()) lines.push(`WA: ${profile.whatsapp.trim()}`);
    return lines.join('\n');
  }, [previewName, profile.address, profile.whatsapp]);

  const onSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await receiptSettingsService.setStoreProfile(profile);
      setMsg('Profil toko disimpan di perangkat ini.');
    } catch {
      setMsg('Gagal menyimpan profil toko.');
    } finally {
      setSaving(false);
    }
  };

  return (
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
          Kosongkan untuk memakai nama akun ({userName || '—'}) atau GurkyPay.
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
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Pratinjau header struk</Text>
        <View style={styles.previewBox}>
          <Text style={styles.previewText}>{preview}</Text>
        </View>
      </Card>

      <Button label="Simpan" onPress={() => void onSave()} loading={saving} disabled={saving} />
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  msg: { fontSize: typography.size.sm, color: colors.status.success },
});
