import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  ScreenContainer,
  Button,
} from '../../../src/components/ui';
import { useAuthStore } from '../../../src/store/auth.store';
import { profileService } from '../../../src/services/profile.service';
import { parseApiError } from '../../../src/api/client';
import { resolveMediaUrl } from '../../../src/utils/mediaUrl';
import { colors, radius, spacing, typography } from '../../../src/theme';

/**
 * Ubah Profil — avatar, nama, entry ke ganti HP / email.
 * Name → PUT /profile. Avatar → POST /profile/avatar.
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  const [name, setName] = useState(user?.name || '');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const lockRef = useRef(false);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const avatarUri = resolveMediaUrl(user?.avatar || null);
  const nameDirty = name.trim() !== '' && name.trim() !== (user?.name || '').trim();

  const saveName = async () => {
    if (lockRef.current || busy || !nameDirty) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await profileService.updateProfile({ name: name.trim() });
      if (res.success) {
        setMsg(res.message || 'Nama berhasil diperbarui.');
        await fetchUser();
      } else {
        setError(res.message || 'Gagal menyimpan nama.');
      }
    } catch (err: unknown) {
      setError(parseApiError(err).message || 'Gagal menyimpan nama.');
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    const uri = asset.uri;
    const nameGuess =
      uri.split('/').pop()?.split('?')[0] || `avatar-${Date.now()}.jpg`;
    const type = asset.mimeType || 'image/jpeg';

    setAvatarBusy(true);
    try {
      const res = await profileService.uploadAvatar({
        uri,
        name: nameGuess,
        type,
      });
      if (res.success) {
        setMsg('Foto profil berhasil diperbarui.');
        await fetchUser();
      } else {
        setError(res.message || 'Gagal mengunggah foto.');
      }
    } catch (err: unknown) {
      setError(parseApiError(err).message || 'Gagal mengunggah foto.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin diperlukan', 'Izinkan akses galeri untuk mengganti foto profil.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadAsset(result.assets[0]);
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin diperlukan', 'Izinkan akses kamera untuk mengambil foto profil.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadAsset(result.assets[0]);
  };

  const pickAvatar = useCallback(() => {
    if (avatarBusy) return;
    setError(null);
    setMsg(null);
    Alert.alert('Pilih Foto', 'Ambil foto baru atau pilih dari galeri.', [
      { text: 'Galeri', onPress: () => void pickFromGallery() },
      { text: 'Kamera', onPress: () => void pickFromCamera() },
      { text: 'Batal', style: 'cancel' },
    ]);
  }, [avatarBusy, fetchUser]);

  return (
    <ScreenContainer belowHeader scroll>
      <Stack.Screen
        options={{ headerShown: true, title: 'Ubah Profil', headerBackTitle: 'Kembali' }}
      />

      {msg ? <Text style={styles.success}>{msg}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.avatarBlock}>
        <Pressable onPress={pickAvatar} disabled={avatarBusy} style={styles.avatarTap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {(user?.name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.cameraBadge}>
            {avatarBusy ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="camera" size={14} color={colors.white} />
            )}
          </View>
        </Pressable>
        <Text style={styles.avatarHint}>Ketuk untuk ganti foto</Text>
      </View>

      <Text style={styles.label}>Nama Lengkap</Text>
      <TextInput
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(null);
          setMsg(null);
        }}
        placeholder="Nama lengkap"
        placeholderTextColor={colors.gray[400]}
        editable={!busy}
        style={styles.input}
      />

      <View style={styles.fieldCard}>
        <View style={styles.fieldRow}>
          <View style={styles.fieldText}>
            <Text style={styles.fieldLabel}>Nomor HP</Text>
            <Text style={styles.fieldValue}>{user?.phone || '—'}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/akun/profile/phone')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ubah nomor HP"
          >
            <Text style={styles.link}>Ubah</Text>
          </Pressable>
        </View>
        <View style={styles.divider} />
        <View style={styles.fieldRow}>
          <View style={styles.fieldText}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{user?.email || '—'}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/akun/profile/email')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ubah email"
          >
            <Text style={styles.link}>Ubah</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.cta}>
        <Button
          label="Simpan"
          onPress={() => void saveName()}
          loading={busy}
          disabled={!nameDirty || busy}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  success: {
    fontSize: typography.size.sm,
    color: colors.primary[700],
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.status.failed,
    backgroundColor: colors.status.failedBg,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  avatarBlock: { alignItems: 'center', marginBottom: spacing.lg, gap: spacing.xs },
  avatarTap: { position: 'relative' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.gray[200],
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.white,
    fontSize: 28,
    fontWeight: typography.weight.black,
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary[700],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarHint: { fontSize: typography.size.xs, color: colors.gray[500] },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.white,
    fontSize: typography.size.md,
    color: colors.gray[900],
    marginBottom: spacing.md,
  },
  fieldCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    marginBottom: spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: spacing.md,
  },
  fieldText: { flex: 1, minWidth: 0, gap: 2 },
  fieldLabel: { fontSize: typography.size.xs, color: colors.gray[500] },
  fieldValue: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
  },
  link: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray[100],
    marginLeft: spacing.md,
  },
  cta: { marginTop: spacing.sm },
});
