import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, useWindowDimensions, View } from 'react-native';
import Sidebar from '../../components/Sidebar';

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const isWeb = Platform.OS === 'web';
  const showSidebar = isWeb && isLargeScreen;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#0f172a' }}>
      {showSidebar && <Sidebar />}
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: '#2D3748',
              borderTopColor: '#4A5568',
              height: Platform.OS === 'ios' ? 85 : 60,
              paddingBottom: Platform.OS === 'ios' ? 30 : 10,
              paddingTop: 10,
              display: showSidebar ? 'none' : 'flex',
            },
            tabBarActiveTintColor: '#38bdf8',
            tabBarInactiveTintColor: '#A0AEC0',
          }}>
          
          <Tabs.Screen
            name="index"
            options={{
              href: null,
              tabBarStyle: { display: 'none' },
            }}
          />

          <Tabs.Screen
            name="dashboard"
            options={{
              title: 'Menu',
              tabBarIcon: ({ color }) => <Ionicons name="restaurant-outline" size={24} color={color} />,
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Settings',
              tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />,
            }}
          />
          {/* Admin routes included as hidden tabs to keep them in the same context */}
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
      </View>
    </View>
  );
}
