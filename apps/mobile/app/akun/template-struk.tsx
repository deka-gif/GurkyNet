import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, Button, Card } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import {
  RECEIPT_FIELD_LABELS,
  createDefaultReceiptTemplate,
  createEmptyStoreProfile,
  receiptSettingsService,
  type ReceiptFieldConfig,
  type ReceiptTemplate,
  type StoreProfile,
} from '../../src/services/receiptSettings.service';
import { buildReceiptLines, receiptLinesToPreviewText } from '../../src/utils/receiptPrint';
import { useAuthStore } from '../../src/store/auth.store';

/**
 * Template Struk — visibility + order only.
 * Closing message text lives on Profil Toko (store.closingMessage).
 */
export default function TemplateStrukScreen() {
  const userName = useAuthStore((s) => s.user?.name);
  const [template, setTemplate] = useState<ReceiptTemplate>(createDefaultReceiptTemplate());
  const [store, setStore] = useState<StoreProfile>(createEmptyStoreProfile());
  const [paperWidthMm, setPaperWidthMm] = useState<58 | 80>(58);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [t, s, p] = await Promise.all([
      receiptSettingsService.getReceiptTemplate(),
      receiptSettingsService.getStoreProfile(),
      receiptSettingsService.getPrinterPreferences(),
    ]);
    setTemplate(t);
    setStore(s);
    setPaperWidthMm(p.paperWidthMm);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const previewText = useMemo(() => {
    const lines = buildReceiptLines({
      receipt: null,
      store,
      template,
      userName,
      paperWidthMm,
      sample: true,
    });
    return receiptLinesToPreviewText(lines);
  }, [store, template, userName, paperWidthMm]);

  const moveField = (index: number, dir: -1 | 1) => {
    setTemplate((prev) => {
      const next = [...prev.fields];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return { ...prev, fields: next };
    });
  };

  const toggleField = (id: ReceiptFieldConfig['id'], visible: boolean) => {
    setTemplate((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => {
        if (f.id !== id) return f;
        if (f.locked) return { ...f, visible: true };
        return { ...f, visible };
      }),
    }));
  };

  const onSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await receiptSettingsService.setReceiptTemplate(template);
      setMsg('Template struk disimpan di perangkat ini.');
    } catch (err: any) {
      setMsg(err?.message || 'Gagal menyimpan template.');
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    try {
      const def = await receiptSettingsService.resetReceiptTemplate();
      setTemplate(def);
      setMsg('Template dikembalikan ke default.');
    } catch (err: any) {
      setMsg(err?.message || 'Gagal mereset template.');
    }
  };

  return (
    <ScreenContainer scroll belowHeader>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Template Struk',
          headerBackTitle: 'Kembali',
        }}
      />

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Pratinjau langsung</Text>
        <Text style={styles.hint}>
          Menggunakan Profil Toko aktif. Lebar kertas: {paperWidthMm} mm (Akun → Printer).
        </Text>
        <View style={styles.previewBox}>
          <Text style={styles.previewText}>{previewText}</Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Field struk</Text>
        <Text style={styles.hint}>
          Pesan penutup diisi di Profil Toko. Toggle di bawah hanya menampilkan / menyembunyikan.
        </Text>
        {template.fields.map((field, index) => (
          <View key={field.id} style={styles.fieldRow}>
            <View style={styles.fieldMain}>
              <Text style={styles.fieldLabel}>{RECEIPT_FIELD_LABELS[field.id]}</Text>
              {field.id === 'note' ? (
                <Text style={styles.fieldSub}>
                  Tampilkan pesan penutup dari Profil Toko
                  {store.closingMessage.trim()
                    ? `: “${store.closingMessage.trim().slice(0, 40)}${
                        store.closingMessage.trim().length > 40 ? '…' : ''
                      }”`
                    : ' (belum diisi)'}
                </Text>
              ) : null}
              {field.locked ? <Text style={styles.lockedBadge}>Wajib</Text> : null}
            </View>
            <Switch
              value={field.locked ? true : field.visible}
              onValueChange={(v) => toggleField(field.id, v)}
              disabled={field.locked}
              trackColor={{ false: colors.gray[300], true: colors.primary[300] }}
              thumbColor={field.visible || field.locked ? colors.primary[600] : colors.gray[100]}
            />
            <View style={styles.reorder}>
              <Pressable
                onPress={() => moveField(index, -1)}
                disabled={index === 0}
                hitSlop={8}
                style={styles.reorderBtn}
              >
                <Ionicons
                  name="chevron-up"
                  size={18}
                  color={index === 0 ? colors.gray[300] : colors.gray[700]}
                />
              </Pressable>
              <Pressable
                onPress={() => moveField(index, 1)}
                disabled={index === template.fields.length - 1}
                hitSlop={8}
                style={styles.reorderBtn}
              >
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={
                    index === template.fields.length - 1 ? colors.gray[300] : colors.gray[700]
                  }
                />
              </Pressable>
            </View>
          </View>
        ))}
      </Card>

      <Button label="Simpan template" onPress={() => void onSave()} loading={saving} disabled={saving} />
      <Button label="Reset ke default" variant="secondary" onPress={() => void onReset()} />
      {msg ? (
        <Text style={[styles.msg, /gagal/i.test(msg) ? styles.msgError : styles.msgOk]}>
          {msg}
        </Text>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  sectionTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  hint: { fontSize: typography.size.xs, color: colors.gray[500], lineHeight: 18 },
  previewBox: {
    backgroundColor: colors.gray[50],
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
  },
  previewText: {
    fontSize: 11,
    color: colors.gray[900],
    lineHeight: 16,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[200],
  },
  fieldMain: { flex: 1, gap: 2 },
  fieldLabel: {
    fontSize: typography.size.sm,
    color: colors.gray[900],
    fontWeight: typography.weight.medium,
  },
  fieldSub: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
    lineHeight: 16,
  },
  lockedBadge: {
    fontSize: 10,
    color: colors.primary[700],
    fontWeight: typography.weight.bold,
  },
  reorder: { flexDirection: 'column' },
  reorderBtn: { padding: 2 },
  msg: { fontSize: typography.size.sm, lineHeight: 20, marginBottom: spacing.xl },
  msgOk: { color: colors.status.success },
  msgError: { color: colors.status.failed },
});
