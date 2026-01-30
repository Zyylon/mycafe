import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useAuth } from '../../context/AuthContext';

export default function TabsLayout() {
  const { userData } = useAuth();
  const isStaffOrAdmin = userData?.role === 'staff' || userData?.role === 'admin' || userData?.role === 'superadmin';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, 
      }}>
      
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="dashboard" options={{ title: 'Menu' }} />
      
      {isStaffOrAdmin && (
        <Tabs.Screen
          name="ongoing-orders"
          options={{
            title: 'Ongoing',
          }}
        />
      )}

      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      
      {/* Hidden Admin/Kitchen routes */}
      <Tabs.Screen name="create-user" options={{ href: null }} />
      <Tabs.Screen name="add-menu-item" options={{ href: null }} />
      <Tabs.Screen name="manage-users" options={{ href: null }} />
      <Tabs.Screen name="order-history" options={{ href: null }} />
      <Tabs.Screen name="edit-menu-item" options={{ href: null }} />
      <Tabs.Screen name="kitchen" options={{ href: null }} />
    </Tabs>
  );
}
