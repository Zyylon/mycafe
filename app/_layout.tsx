import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { auth } from '../lib/firebaseConfig';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <RootLayoutNav />
  );
}

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      const inAuthGroup = segments[0] === '(auth)';

      if (user && !inAuthGroup) {
        router.replace('/(tabs)/dashboard');
      } else if (!user) {
        router.replace('/');
      }
    });
    return () => unsubscribe();
  }, [segments]);

  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="create-user" options={{ title: 'Create User' }} />
        <Stack.Screen name="add-menu-item" options={{ title: 'Add Menu Item' }} />
        <Stack.Screen name="manage-users" options={{ title: 'Manage Users' }} />
        <Stack.Screen name="order-history" options={{ title: 'Order History' }} />
        <Stack.Screen name="edit-menu-item" options={{ title: 'Edit Menu Item' }} />
        <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
        <Stack.Screen name="admin-dashboard" options={{ title: 'Admin Dashboard' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
