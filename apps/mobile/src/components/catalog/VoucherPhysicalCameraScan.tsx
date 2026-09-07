import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../ui';
import { colors, radius, spacing, typography } from '../../theme';
import {
  normalizeScanPayloadToSerial,
  UNRECOGNIZED_SCAN_CODE_MESSAGE,
  type ScannedSerial,
} from '../../utils/voucherPhysicalScan';

/** Supported barcode types — Expo SDK 57 CameraView. */
export const VOUCHER_PHYSICAL_BARCODE_TYPES: BarcodeType[] = [
  'qr',
  'code128',
  'code39',
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
];

export type CameraScanOutcome = 'added' | 'duplicate' | 'ignored' | 'at_capacity' | 'unrecognized';

type Props = {
  visible: boolean;
  list: ScannedSerial[];
  maxItems: number;
  /** When false, scanner stops accepting new codes (at capacity). */
  scanningEnabled: boolean;
  limitReached: boolean;
  notice?: string | null;
  onDetected: (normalizedSerial: string) => CameraScanOutcome;
  onUnrecognizedCode?: (message: string) => void;
  onRemove: (serial: string) => void;
  onEditSave: (index: number, nextSerial: string) => { ok: true } | { ok: false; error: string };
  onConfirm: () => void;
  onSwitchManual: () => void;
  onClose: () => void;
};

const COOLDOWN_MS = 1000;
const FLASH_MS = 250;

const SOUND_SUCCESS = require('./sounds/scan_success.wav');
const SOUND_DUPLICATE = require('./sounds/scan_duplicate.wav');
const SOUND_ERROR = require('./sounds/scan_error.wav');

function normalizeScanData(data: string): string {
  return data.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function playScanTone(player: AudioPlayer) {
  try {
    player.seekTo(0);
    player.play();
  } catch {
    // Audio best-effort — never block scan path.
  }
}

/**
 * Full-screen barcode/QR scanner for Voucher Fisik SN input.
 * Dedup/limit SoT lives in parent via addCodesToScan — this component only
 * handles permission, preview, cooldown, and feedback (flash + haptic + audio).
 */
export function VoucherPhysicalCameraScan({
  visible,
  list,
  maxItems,
  scanningEnabled,
  limitReached,
  notice,
  onDetected,
  onUnrecognizedCode,
  onRemove,
  onEditSave,
  onConfirm,
  onSwitchManual,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [dupFlash, setDupFlash] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const processingRef = useRef(false);
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const soundEnabledRef = useRef(true);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  soundEnabledRef.current = soundEnabled;

  const successPlayer = useAudioPlayer(SOUND_SUCCESS);
  const duplicatePlayer = useAudioPlayer(SOUND_DUPLICATE);
  const errorPlayer = useAudioPlayer(SOUND_ERROR);

  useEffect(() => {
    if (!visible) {
      setTorchOn(false);
      processingRef.current = false;
      cooldownRef.current.clear();
      setEditIndex(null);
      setEditError(null);
      return;
    }
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => undefined);
  }, [visible]);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const playAudio = useCallback(
    (kind: 'success' | 'duplicate' | 'error') => {
      if (!soundEnabledRef.current) return;
      try {
        successPlayer.pause();
        duplicatePlayer.pause();
        errorPlayer.pause();
      } catch {
        // ignore
      }
      if (kind === 'success') playScanTone(successPlayer);
      else if (kind === 'duplicate') playScanTone(duplicatePlayer);
      else playScanTone(errorPlayer);
    },
    [successPlayer, duplicatePlayer, errorPlayer]
  );

  const playSuccessFeedback = useCallback(() => {
    flashOpacity.setValue(0.55);
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: FLASH_MS,
      useNativeDriver: true,
    }).start();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    playAudio('success');
  }, [flashOpacity, playAudio]);

  const playDuplicateFeedback = useCallback(() => {
    setDupFlash(true);
    setTimeout(() => setDupFlash(false), FLASH_MS);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    playAudio('duplicate');
  }, [playAudio]);

  const playErrorFeedback = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    playAudio('error');
  }, [playAudio]);

  const handleBarcode = useCallback(
    (result: BarcodeScanningResult) => {
      if (!scanningEnabled || processingRef.current) return;

      const prepared = normalizeScanData(result.data ?? '');
      const normalized = normalizeScanPayloadToSerial(prepared);
      if (!normalized.ok) {
        processingRef.current = true;
        playErrorFeedback();
        if (normalized.reason === 'unrecognized_url') {
          onUnrecognizedCode?.(normalized.message || UNRECOGNIZED_SCAN_CODE_MESSAGE);
        }
        processingRef.current = false;
        return;
      }

      const serial = normalized.serial;

      const now = Date.now();
      const lastAt = cooldownRef.current.get(serial) ?? 0;
      if (now - lastAt < COOLDOWN_MS) return;

      processingRef.current = true;
      cooldownRef.current.set(serial, now);

      try {
        const outcome = onDetectedRef.current(serial);
        if (outcome === 'added') {
          playSuccessFeedback();
        } else if (outcome === 'duplicate') {
          playDuplicateFeedback();
        } else if (
          outcome === 'at_capacity' ||
          outcome === 'ignored' ||
          outcome === 'unrecognized'
        ) {
          playErrorFeedback();
        }
      } finally {
        processingRef.current = false;
      }
    },
    [
      scanningEnabled,
      playSuccessFeedback,
      playDuplicateFeedback,
      playErrorFeedback,
      onUnrecognizedCode,
    ]
  );

  const openEdit = (index: number) => {
    setEditIndex(index);
    setEditValue(list[index]?.serial ?? '');
    setEditError(null);
  };

  const saveEdit = () => {
    if (editIndex === null) return;
    const result = onEditSave(editIndex, editValue);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditIndex(null);
    setEditError(null);
  };

  const openSettings = () => {
    void Linking.openSettings();
  };

  const renderPermissionBody = () => {
    if (!permission) {
      return (
        <View style={styles.permBox}>
          <ActivityIndicator color={colors.white} />
          <Text style={styles.permText}>Memeriksa izin kamera…</Text>
        </View>
      );
    }

    if (permission.granted) return null;

    const blocked = !permission.canAskAgain;
    return (
      <View style={styles.permBox}>
        <Ionicons name="camera-outline" size={40} color={colors.white} />
        <Text style={styles.permTitle}>
          {blocked ? 'Izin kamera diblokir' : 'Izin kamera diperlukan'}
        </Text>
        <Text style={styles.permText}>
          {blocked
            ? 'Aktifkan kamera di Pengaturan perangkat untuk memindai barcode/QR, atau gunakan Input Manual.'
            : 'GurkyPay membutuhkan kamera untuk memindai nomor seri voucher fisik.'}
        </Text>
        <View style={styles.permActions}>
          {blocked ? (
            <Button label="Buka Pengaturan" onPress={openSettings} />
          ) : (
            <Button label="Coba Lagi" onPress={() => void requestPermission()} />
          )}
          <Button label="Input Manual" variant="secondary" onPress={onSwitchManual} />
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.cameraPane}>
          {permission?.granted && scanningEnabled ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torchOn}
              barcodeScannerSettings={{ barcodeTypes: VOUCHER_PHYSICAL_BARCODE_TYPES }}
              onBarcodeScanned={handleBarcode}
            />
          ) : permission?.granted && !scanningEnabled ? (
            <View style={[StyleSheet.absoluteFill, styles.camOff]}>
              <Text style={styles.permTitle}>Batas SN sudah tercapai</Text>
              <Text style={styles.permText}>
                Hapus SN dari daftar jika ingin scan lagi, atau lanjut konfirmasi.
              </Text>
            </View>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.camOff]}>{renderPermissionBody()}</View>
          )}

          <Animated.View
            pointerEvents="none"
            style={[styles.flash, { opacity: flashOpacity, backgroundColor: colors.status.success }]}
          />
          {dupFlash ? (
            <View pointerEvents="none" style={[styles.flash, { backgroundColor: 'rgba(220,38,38,0.35)' }]} />
          ) : null}

          {permission?.granted ? (
            <View style={styles.viewfinder} pointerEvents="none">
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
            </View>
          ) : null}

          <View style={styles.topBar}>
            <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={8} accessibilityLabel="Tutup">
              <Ionicons name="close" size={22} color={colors.white} />
            </Pressable>
            <View style={styles.counterPill}>
              <Text style={styles.counterPillText}>
                {list.length}/{maxItems} SN
              </Text>
            </View>
            <View style={styles.topRight}>
              <Pressable
                onPress={() => setSoundEnabled((v) => !v)}
                style={[styles.iconBtn, !soundEnabled && styles.iconBtnMuted]}
                hitSlop={8}
                accessibilityLabel={soundEnabled ? 'Matikan suara scan' : 'Nyalakan suara scan'}
                accessibilityState={{ checked: soundEnabled }}
              >
                <Ionicons
                  name={soundEnabled ? 'volume-high' : 'volume-mute'}
                  size={20}
                  color={colors.white}
                />
              </Pressable>
              {permission?.granted ? (
                <Pressable
                  onPress={() => setTorchOn((v) => !v)}
                  style={[styles.iconBtn, torchOn && styles.iconBtnOn]}
                  hitSlop={8}
                  accessibilityLabel={torchOn ? 'Matikan lampu' : 'Nyalakan lampu'}
                >
                  <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={20} color={colors.white} />
                </Pressable>
              ) : (
                <View style={styles.iconBtnPlaceholder} />
              )}
            </View>
          </View>

          {permission?.granted && scanningEnabled ? (
            <Text style={styles.hint}>Arahkan ke barcode / QR voucher</Text>
          ) : null}
        </View>

        <View style={[styles.bottomPane, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.tabRow}>
            <Text style={styles.tabActive}>Scan Kamera</Text>
            <Pressable onPress={onSwitchManual} hitSlop={8}>
              <Text style={styles.tabLink}>Input Manual</Text>
            </Pressable>
          </View>

          {limitReached ? (
            <Text style={styles.limitMsg}>Batas SN sudah tercapai</Text>
          ) : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <ScrollView style={styles.listScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {list.length === 0 ? (
              <Text style={styles.emptyList}>Belum ada SN. Scan barcode/QR untuk menambah.</Text>
            ) : (
              list.map((item, index) => (
                <View key={`${item.serial}-${index}`} style={styles.row}>
                  <Pressable style={styles.rowMain} onPress={() => openEdit(index)}>
                    <Text style={styles.rowIndex}>{index + 1}.</Text>
                    <Text style={styles.rowSerial} numberOfLines={1}>
                      {item.serial}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onRemove(item.serial)}
                    hitSlop={8}
                    accessibilityLabel={`Hapus ${item.serial}`}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.status.failed} />
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>

          <Button
            label="Lanjut Pilih Produk"
            onPress={onConfirm}
            disabled={list.length === 0}
          />
        </View>

        <Modal visible={editIndex !== null} transparent animationType="fade" onRequestClose={() => setEditIndex(null)}>
          <View style={styles.editBackdrop}>
            <View style={styles.editSheet}>
              <Text style={styles.editTitle}>Edit SN #{(editIndex ?? 0) + 1}</Text>
              <TextInput
                value={editValue}
                onChangeText={(t) => {
                  setEditValue(t);
                  setEditError(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.editInput}
              />
              {editError ? <Text style={styles.editError}>{editError}</Text> : null}
              <Button label="Simpan" onPress={saveEdit} />
              <Button label="Batal" variant="secondary" onPress={() => setEditIndex(null)} />
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  cameraPane: {
    flex: 1.15,
    backgroundColor: '#061510',
    overflow: 'hidden',
  },
  camOff: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: '#061510',
    gap: spacing.md,
  },
  flash: {
    ...StyleSheet.absoluteFill,
  },
  viewfinder: {
    position: 'absolute',
    top: '22%',
    left: '14%',
    right: '14%',
    bottom: '28%',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: colors.primary[400],
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  topBar: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  iconBtnOn: { backgroundColor: 'rgba(31,168,122,0.45)' },
  iconBtnMuted: { backgroundColor: 'rgba(220,38,38,0.35)' },
  iconBtnPlaceholder: { width: 40, height: 40 },
  counterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full ?? 999,
    backgroundColor: colors.primary[600],
  },
  counterPillText: {
    color: colors.white,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  hint: {
    position: 'absolute',
    bottom: spacing.lg,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.75)',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  bottomPane: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    maxHeight: '46%',
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabActive: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
  },
  tabLink: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary[600],
    textDecorationLine: 'underline',
  },
  limitMsg: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.status.failed,
  },
  notice: {
    fontSize: typography.size.xs,
    color: colors.status.pending,
    fontWeight: typography.weight.medium,
  },
  listScroll: { maxHeight: 160 },
  emptyList: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowIndex: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[500],
    minWidth: 22,
  },
  rowSerial: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    fontVariant: ['tabular-nums'],
  },
  permBox: { alignItems: 'center', gap: spacing.md, maxWidth: 320 },
  permTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.white,
    textAlign: 'center',
  },
  permText: {
    fontSize: typography.size.xs,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 18,
  },
  permActions: { width: '100%', gap: spacing.sm },
  editBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  editSheet: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  editTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  editInput: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  editError: {
    fontSize: typography.size.xs,
    color: colors.status.failed,
    fontWeight: typography.weight.bold,
  },
});
