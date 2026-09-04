import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { colors } from '../../src/theme';

/**
 * Five tabs per spec section 6: Home / Transaksi / Riwayat / Notifikasi / Akun — no menu
 * added here without a corresponding backend feature behind it.
 */
export default function TabsLayout() {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (hydrated && !token) {
      router.replace('/(auth)/login');
    }
  }, [hydrated, token, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="transaksi"
        options={{ title: 'Transaksi', tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="riwayat"
        options={{ title: 'Riwayat', tabBarIcon: ({ color, size }) => <Ionicons name="time" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="notifikasi"
        options={{ title: 'Notifikasi', tabBarIcon: ({ color, size }) => <Ionicons name="notifications" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="akun"
        options={{ title: 'Akun', tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
