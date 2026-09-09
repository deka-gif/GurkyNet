import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenContainer,
  Button,
  Card,
} from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import {
  receiptSettingsService,
  type PaperWidthMm,
  type PrinterPreferences,
} from '../../src/services/receiptSettings.service';
import {
  ensureBluetoothPermissions,
  openSystemSettings,
  printerService,
  type BluetoothPermissionState,
  type PrinterScanDevice,
} from '../../src/services/printer.service';
import { useAuthStore } from '../../src/store/auth.store';

/**
 * Bluetooth & Printer — scan, connect, persist default, paper width, test print.
 * Requires development build (react-native-thermal-printer-driver).
 */
export default function PrinterScreen() {
  const userName = useAuthStore((s) => s.user?.name);
  const [prefs, setPrefs] = useState<PrinterPreferences | null>(null);
  const [scanning, setScanning] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [devices, setDevices] = useState<PrinterScanDevice[]>([]);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] =
    useState<BluetoothPermissionState | null>(null);
  const [testing, setTesting] = useState(false);

  const reload = useCallback(async () => {
    const p = await receiptSettingsService.getPrinterPreferences();
    setPrefs(p);
    if (p.printer && printerService.isNativeAvailable()) {
      setConnected(await printerService.isDefaultConnected());
    } else {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onScan = async () => {
    setError(null);
    setMessage(null);
    if (!printerService.isNativeAvailable()) {
      setError(
        'Modul printer belum tersedia di build ini. Gunakan development build (EAS), bukan Expo Go.'
      );
      return;
    }
    const perm = await ensureBluetoothPermissions();
    setPermissionState(perm);
    if (perm === 'blocked') {
      setError('Izin Bluetooth diblokir. Buka pengaturan sistem untuk mengaktifkannya.');
      return;
    }
    if (perm === 'denied') {
      setError('Izin Bluetooth ditolak. Izinkan akses lalu coba pindai lagi.');
      return;
    }

    setScanning(true);
    setDevices([]);
    try {
      const list = await printerService.scanDevices();
      setDevices(list);
      setMessage(
        list.length
          ? `Ditemukan ${list.length} perangkat.`
          : 'Tidak ada perangkat ditemukan. Pastikan printer menyala dan dalam jangkauan.'
      );
    } catch (err: any) {
      if (err?.permissionState) setPermissionState(err.permissionState);
      setError(err?.message || 'Gagal memindai perangkat Bluetooth.');
    } finally {
      setScanning(false);
    }
  };

  const onConnect = async (device: PrinterScanDevice) => {
    setError(null);
    setMessage(null);
    setConnectingId(device.connectAddress);
    try {
      await printerService.connectAndSave(device);
      await reload();
      setConnected(true);
      setMessage(`Terhubung ke ${device.name || 'printer'}.`);
    } catch (err: any) {
      setConnected(false);
      setError(err?.message || 'Gagal menghubungkan printer.');
    } finally {
      setConnectingId(null);
    }
  };

  const onPaperWidth = async (paperWidthMm: PaperWidthMm) => {
    await receiptSettingsService.setPaperWidth(paperWidthMm);
    await reload();
  };

  const onTestPrint = async () => {
    setError(null);
    setMessage(null);
    if (!prefs?.printer) {
      setError('Belum ada printer default. Pindai dan hubungkan printer terlebih dahulu.');
      return;
    }
    setTesting(true);
    try {
      await printerService.printTestReceipt(userName);
      setMessage('Struk tes terkirim ke printer.');
    } catch (err: any) {
      setError(err?.message || 'Gagal mencetak struk tes.');
    } finally {
      setTesting(false);
    }
  };

  const onClearPrinter = async () => {
    await receiptSettingsService.setDefaultPrinter(null);
    setConnected(false);
    await reload();
    setMessage('Printer default dihapus dari perangkat ini.');
  };

  return (
    <ScreenContainer scroll belowHeader>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Bluetooth & Printer',
          headerBackTitle: 'Kembali',
        }}
      />

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Printer default</Text>
        {prefs?.printer ? (
          <>
            <Text style={styles.printerName}>{prefs.printer.name}</Text>
            <Text style={styles.muted}>{prefs.printer.address}</Text>
            <Text style={[styles.status, connected ? styles.statusOk : styles.statusOff]}>
              {connected ? 'Terhubung' : 'Tersimpan (belum terverifikasi terhubung)'}
            </Text>
            <Button label="Hapus printer default" variant="ghost" onPress={() => void onClearPrinter()} />
          </>
        ) : (
          <Text style={styles.muted}>Belum ada printer terhubung.</Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Lebar kertas</Text>
        <View style={styles.widthRow}>
          {([58, 80] as PaperWidthMm[]).map((w) => {
            const active = prefs?.paperWidthMm === w;
            return (
              <Pressable
                key={w}
                onPress={() => void onPaperWidth(w)}
                style={[styles.widthChip, active && styles.widthChipActive]}
              >
                <Text style={[styles.widthChipText, active && styles.widthChipTextActive]}>
                  {w} mm
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>Default 58 mm. Ubah kapan saja tanpa update aplikasi.</Text>
      </Card>

      {permissionState === 'blocked' || permissionState === 'denied' ? (
        <Card style={styles.card}>
          <Text style={styles.error}>
            {permissionState === 'blocked'
              ? 'Izin Bluetooth diblokir permanen.'
              : 'Izin Bluetooth belum diberikan.'}
          </Text>
          <Button label="Buka Pengaturan Sistem" variant="secondary" onPress={openSystemSettings} />
        </Card>
      ) : null}

      <Button
        label={scanning ? 'Memindai…' : 'Pindai perangkat bluetooth'}
        onPress={() => void onScan()}
        loading={scanning}
        disabled={scanning}
      />

      {devices.length > 0 ? (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Hasil pindai</Text>
          {devices.map((d) => {
            const busy = connectingId === d.connectAddress;
            return (
              <Pressable
                key={d.connectAddress}
                onPress={() => void onConnect(d)}
                disabled={!!connectingId}
                style={({ pressed }) => [styles.deviceRow, pressed && styles.pressed]}
              >
                <View style={styles.deviceIcon}>
                  <Ionicons name="print-outline" size={20} color={colors.primary[600]} />
                </View>
                <View style={styles.deviceText}>
                  <Text style={styles.deviceName}>{d.name || 'Perangkat tanpa nama'}</Text>
                  <Text style={styles.muted}>
                    {d.connectAddress} · {d.deviceType}
                  </Text>
                </View>
                {busy ? (
                  <ActivityIndicator color={colors.primary[600]} />
                ) : (
                  <Text style={styles.connectHint}>Hubungkan</Text>
                )}
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      <Button
        label={testing ? 'Mencetak…' : 'Tes cetak struk'}
        variant="secondary"
        onPress={() => void onTestPrint()}
        loading={testing}
        disabled={testing || !prefs?.printer}
      />

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.iosNote}>
        Catatan iOS: hanya printer BLE atau TCP/Wi‑Fi. Printer Bluetooth Classic saja tidak
        didukung sistem iOS (bukan bug aplikasi).
      </Text>
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
  printerName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  muted: { fontSize: typography.size.xs, color: colors.gray[500] },
  status: { fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  statusOk: { color: colors.status.success },
  statusOff: { color: colors.gray[600] },
  widthRow: { flexDirection: 'row', gap: spacing.sm },
  widthChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[300],
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  widthChipActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  widthChipText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
  widthChipTextActive: { color: colors.primary[700] },
  hint: { fontSize: typography.size.xs, color: colors.gray[500] },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[200],
  },
  deviceIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceText: { flex: 1, gap: 2 },
  deviceName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
  },
  connectHint: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
  },
  pressed: { opacity: 0.7 },
  message: { fontSize: typography.size.sm, color: colors.status.success },
  error: { fontSize: typography.size.sm, color: colors.status.failed, lineHeight: 20 },
  iosNote: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
    lineHeight: 18,
    marginBottom: spacing.xl,
  },
});
