import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { AuthProvider } from '../context/AuthContext';
import { PaperProvider } from 'react-native-paper';
import ResponsiveLayout from '../components/ResponsiveLayout';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  return (
    <PaperProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
    </PaperProvider>
  );
}

function RootLayoutNav() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <ResponsiveLayout>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="auth/login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="create-user" options={{ title: 'Create User',headerShown: false }} />
          <Stack.Screen name="add-menu-item" options={{ title: 'Add Menu Item',headerShown: false }} />
          <Stack.Screen name="manage-users" options={{ title: 'Manage Users',headerShown: false }} />
          <Stack.Screen name="order-history" options={{ title: 'Order History',headerShown: false }} />
          <Stack.Screen name="edit-menu-item" options={{ title: 'Edit Menu Item',headerShown: false }} />
          <Stack.Screen name="checkout" options={{ title: 'Checkout',headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ResponsiveLayout>
    </ThemeProvider>
  );
}
