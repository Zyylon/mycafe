import { useRouter } from 'expo-router';
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { auth } from '../../lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
    const router = useRouter();
    const { userData } = useAuth();
    const userRole = userData?.role;
    const userName = userData?.username;
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';

    const handleSignOut = () => {
        auth.signOut();
    };

    const handleNavigate = (path: string) => {
        // Explicitly cast path to any to avoid type strictness issues with string literals
        router.push(path as any);
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.webContainer}>
                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        <Ionicons name="person-circle-outline" size={80} color="#E2E8F0" />
                    </View>
                    <Text style={styles.userName}>{userName}</Text>
                    <Text style={styles.userRole}>{userRole?.toUpperCase()}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <Pressable style={styles.menuItem} onPress={handleSignOut}>
                        <Ionicons name="log-out-outline" size={24} color="#E53E3E" />
                        <Text style={[styles.menuItemText, { color: '#E53E3E' }]}>Sign Out</Text>
                    </Pressable>
                </View>

                {isAdmin && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Admin Actions</Text>
                        
                        <Pressable style={styles.menuItem} onPress={() => handleNavigate('/create-user')}>
                            <Ionicons name="person-add-outline" size={24} color="#38bdf8" />
                            <Text style={styles.menuItemText}>Create User</Text>
                        </Pressable>

                        <Pressable style={styles.menuItem} onPress={() => handleNavigate('/add-menu-item')}>
                            <Ionicons name="clipboard-outline" size={24} color="#38bdf8" />
                            <Text style={styles.menuItemText}>Inventory & Menu</Text>
                        </Pressable>

                        <Pressable style={styles.menuItem} onPress={() => handleNavigate('/manage-users')}>
                            <Ionicons name="people-outline" size={24} color="#38bdf8" />
                            <Text style={styles.menuItemText}>Manage Users</Text>
                        </Pressable>

                        <Pressable style={styles.menuItem} onPress={() => handleNavigate('/order-history')}>
                            <Ionicons name="receipt-outline" size={24} color="#38bdf8" />
                            <Text style={styles.menuItemText}>Order History</Text>
                        </Pressable>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1A202C',
    },
    contentContainer: {
        padding: 20,
        paddingTop: 60,
        alignItems: 'center', // Center content for web
    },
    webContainer: {
        width: '100%',
        maxWidth: 600, // Limit width for web
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    avatarContainer: {
        marginBottom: 15,
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#E2E8F0',
        marginBottom: 5,
    },
    userRole: {
        fontSize: 14,
        color: '#A0AEC0',
        letterSpacing: 1,
    },
    section: {
        marginBottom: 30,
        backgroundColor: '#2D3748',
        borderRadius: 16,
        overflow: 'hidden',
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: '#334155',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#A0AEC0',
        marginLeft: 20,
        marginTop: 15,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#4A5568',
        cursor: Platform.OS === 'web' ? 'pointer' : 'auto', // Add cursor pointer for web
    },
    menuItemText: {
        fontSize: 16,
        color: '#E2E8F0',
        marginLeft: 15,
        fontWeight: '500',
    },
});
