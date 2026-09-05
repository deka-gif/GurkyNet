import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { useHelpStore } from '../../src/store/help.store';
import { colors } from '../../src/theme';

/**
 * Bottom navigation: Home | Riwayat | Wallet | Help | Akun (exactly 5).
 * Transaksi & Notifikasi stay registered for deep links / Home → Lainnya but are hidden.
 */
export default function TabsLayout() {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const unreadUser = useHelpStore((s) => s.unreadUser);
  const refreshUnread = useHelpStore((s) => s.refreshUnread);

  useEffect(() => {
    if (hydrated && !token) {
      router.replace('/(auth)/login');
    }
  }, [hydrated, token, router]);

  useEffect(() => {
    if (hydrated && token) {
      void refreshUnread();
    }
  }, [hydrated, token, refreshUnread]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: {
          height: 58,
          paddingBottom: 8,
          paddingTop: 4,
          borderTopColor: colors.gray[200],
          borderTopWidth: StyleSheet.hairlineWidth,
          backgroundColor: colors.white,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="riwayat"
        options={{
          title: 'Riwayat',
          tabBarIcon: ({ color, size }) => <Ionicons name="time" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          title: 'Help',
          tabBarBadge: unreadUser > 0 ? (unreadUser > 9 ? '9+' : unreadUser) : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="help-circle" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="akun"
        options={{
          title: 'Akun',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />
      {/* Keep screens registered; hide from bottom nav */}
      <Tabs.Screen name="transaksi" options={{ href: null }} />
      <Tabs.Screen name="notifikasi" options={{ href: null }} />
    </Tabs>
  );
}
