import { Stack } from 'expo-router';
import { ScreenContainer } from '../src/components/ui';
import { CekHargaCatalogFlow } from '../src/components/catalog/CekHargaCatalogFlow';

/**
 * Dedicated Cek Harga page — read-only catalog browser.
 * Entry: Home → Cek Harga. Purchase via existing /produk/[slug] only.
 */
export default function CekHargaScreen() {
  return (
    <ScreenContainer belowHeader>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Cek Harga',
          headerBackTitle: 'Kembali',
        }}
      />
      <CekHargaCatalogFlow />
    </ScreenContainer>
  );
}
