import { useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import { AuthSuccessView } from '../../src/components/ui';

/**
 * Post-registration success — then home.
 * Back to PIN blocked via gestureEnabled / headerBackVisible.
 */
export default function RegisterSuccessScreen() {
  const router = useRouter();

  const onContinue = useCallback(() => {
    router.replace('/(tabs)/home');
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, headerBackVisible: false }} />
      <AuthSuccessView
        title="Akun Berhasil Dibuat"
        message="Selamat, akun GurkyNet kamu siap dipakai. Mulai transaksi sekarang."
        buttonLabel="Mulai Sekarang"
        onContinue={onContinue}
      />
    </>
  );
}
