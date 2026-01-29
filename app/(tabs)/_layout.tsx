import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Hide the default tab bar because we are using a custom MobileBottomNav 
        // in the RootLayout via ResponsiveLayout.
        tabBarStyle: { display: 'none' }, 
      }}>
      
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Menu',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
        }}
      />
      
      {/* Admin routes included as hidden tabs */}
      <Tabs.Screen
        name="create-user"
        options={{
          href: null,
          title: 'Create User',
        }}
      />
      <Tabs.Screen
        name="add-menu-item"
        options={{
          href: null,
          title: 'Add Menu Item',
        }}
      />
      <Tabs.Screen
        name="manage-users"
        options={{
          href: null,
          title: 'Manage Users',
        }}
      />
      <Tabs.Screen
        name="order-history"
        options={{
          href: null,
          title: 'Order History',
        }}
      />
       <Tabs.Screen
        name="edit-menu-item"
        options={{
          href: null,
          title: 'Edit Menu Item',
        }}
      />
    </Tabs>
  );
}
