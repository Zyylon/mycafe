import React from 'react';
import { View, StyleSheet, Pressable, Text, Platform, useWindowDimensions } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
    const router = useRouter();
    const pathname = usePathname();
    const { userData } = useAuth();
    const isAdmin = userData?.role === 'admin' || userData?.role === 'superadmin';

    const menuItems = [
        { name: 'Menu', href: '/dashboard', icon: 'restaurant-outline' },
        { name: 'Settings', href: '/settings', icon: 'settings-outline' },
    ];

    return (
        <View style={styles.sidebar}>
            <View>
                <Text style={styles.sidebarHeader}>Navigation</Text>
                {menuItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Pressable 
                            key={item.name} 
                            style={[styles.sideItem, isActive && styles.sideItemActive]} 
                            onPress={() => router.replace(item.href as any)}
                        >
                            <Ionicons name={item.icon as any} size={20} color={isActive ? '#38bdf8' : '#E2E8F0'} />
                            <Text style={[styles.sideItemText, isActive && { color: '#38bdf8' }]}>{item.name}</Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
};

export default function AppLayout() {
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 768;

    if (!isLargeScreen) {
        // On mobile, we fall back to the tab navigator for a better UX.
        // We will need to re-create the (tabs) layout.
        // For now, let's keep the sidebar for consistency until we build the mobile-specific layout.
        // Or, we can just use the sidebar for both. Let's do that for simplicity.
    }

    return (
        <View style={styles.container}>
            <Sidebar />
            <View style={styles.verticalDivider} />
            <View style={styles.contentContainer}>
                <Slot />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#0f172a',
    },
    sidebar: {
        width: 260,
        backgroundColor: '#1e293b',
        padding: 24,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    sidebarHeader: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: 20,
        paddingLeft: 10,
    },
    sideItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 8,
    },
    sideItemActive: {
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
    },
    sideItemText: {
        color: '#E2E8F0',
        fontSize: 16,
        marginLeft: 12,
        fontWeight: '500',
    },
    verticalDivider: {
        width: 1,
        backgroundColor: '#334155',
    },
    contentContainer: {
        flex: 1,
    }
});
