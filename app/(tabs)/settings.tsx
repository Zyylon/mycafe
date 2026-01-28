import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../services/firebase';

export default function SettingsScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 768;
    
    const { userData } = useAuth();
    const userRole = userData?.role;
    const userName = userData?.username;
    const userEmail = userData?.email || auth.currentUser?.email;
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';

    const handleSignOut = () => {
        auth.signOut();
    };

    const handleNavigate = (path: string) => {
        router.push(path as any);
    };

    const renderProfileContent = () => (
        <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
                <View style={styles.avatarLarge}>
                    <Ionicons name="person-circle" size={100} color="#38bdf8" />
                </View>
                <View style={styles.profileInfo}>
                    <Text style={styles.displayTitle}>{userName}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{userRole?.toUpperCase()}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.detailsGrid}>
                <View style={[styles.detailItem, { width: isLargeScreen ? '48%' : '100%' }]}>
                    <View style={styles.detailIconContainer}>
                         <Ionicons name="person" size={24} color="#38bdf8" />
                    </View>
                    <View>
                        <Text style={styles.detailLabel}>Username</Text>
                        <Text style={styles.detailValue}>{userName}</Text>
                    </View>
                </View>
                <View style={[styles.detailItem, { width: isLargeScreen ? '48%' : '100%' }]}>
                    <View style={styles.detailIconContainer}>
                         <Ionicons name="mail" size={24} color="#38bdf8" />
                    </View>
                    <View>
                        <Text style={styles.detailLabel}>Email Address</Text>
                        <Text style={styles.detailValue}>{userEmail}</Text>
                    </View>
                </View>
                <View style={[styles.detailItem, { width: isLargeScreen ? '48%' : '100%' }]}>
                    <View style={styles.detailIconContainer}>
                         <Ionicons name="shield-checkmark" size={24} color="#38bdf8" />
                    </View>
                    <View>
                        <Text style={styles.detailLabel}>Access Level</Text>
                        <Text style={styles.detailValue}>{userRole === 'superadmin' ? 'Full System Access' : userRole === 'admin' ? 'Administrative' : 'Staff'}</Text>
                    </View>
                </View>
                <View style={[styles.detailItem, { width: isLargeScreen ? '48%' : '100%' }]}>
                    <View style={[styles.detailIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                         <Ionicons name="radio-button-on" size={24} color="#10b981" />
                    </View>
                    <View>
                        <Text style={styles.detailLabel}>Account Status</Text>
                        <Text style={[styles.detailValue, { color: '#10b981' }]}>Active</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    const renderMobileMenu = () => (
        <View style={styles.mobileMenuContainer}>
            <Text style={styles.sectionTitle}>Management</Text>
            {isAdmin && (
                <>
                    <Pressable style={styles.menuItem} onPress={() => handleNavigate('/create-user')}>
                        <View style={styles.menuIconBox}>
                            <Ionicons name="person-add-outline" size={22} color="#38bdf8" />
                        </View>
                        <Text style={styles.menuItemText}>Create User</Text>
                        <Ionicons name="chevron-forward" size={20} color="#64748b" style={{marginLeft: 'auto'}} />
                    </Pressable>

                    <Pressable style={styles.menuItem} onPress={() => handleNavigate('/add-menu-item')}>
                        <View style={styles.menuIconBox}>
                            <Ionicons name="clipboard-outline" size={22} color="#38bdf8" />
                        </View>
                        <Text style={styles.menuItemText}>Inventory & Menu</Text>
                        <Ionicons name="chevron-forward" size={20} color="#64748b" style={{marginLeft: 'auto'}} />
                    </Pressable>

                    <Pressable style={styles.menuItem} onPress={() => handleNavigate('/manage-users')}>
                         <View style={styles.menuIconBox}>
                            <Ionicons name="people-outline" size={22} color="#38bdf8" />
                        </View>
                        <Text style={styles.menuItemText}>Manage Users</Text>
                        <Ionicons name="chevron-forward" size={20} color="#64748b" style={{marginLeft: 'auto'}} />
                    </Pressable>

                    <Pressable style={styles.menuItem} onPress={() => handleNavigate('/order-history')}>
                         <View style={styles.menuIconBox}>
                            <Ionicons name="receipt-outline" size={22} color="#38bdf8" />
                        </View>
                        <Text style={styles.menuItemText}>Order History</Text>
                        <Ionicons name="chevron-forward" size={20} color="#64748b" style={{marginLeft: 'auto'}} />
                    </Pressable>
                </>
            )}
            
            <Pressable style={[styles.menuItem, styles.signOutItem]} onPress={handleSignOut}>
                <View style={[styles.menuIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <Ionicons name="log-out-outline" size={22} color="#ef4444" />
                </View>
                <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Sign Out</Text>
            </Pressable>
        </View>
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.header}>
                 {!isLargeScreen && (
                     <View style={styles.logoContainer}>
                        <Ionicons name="settings" size={24} color="#f8fafc" />
                        <Text style={styles.logoText}>Settings</Text>
                     </View>
                 )}
                 {isLargeScreen && <Text style={styles.pageHeaderTitle}>Settings</Text>}
            </View>

            <View style={styles.contentArea}>
                {renderProfileContent()}
                {!isLargeScreen && renderMobileMenu()}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logoText: { fontSize: 20, fontWeight: '700', color: '#f8fafc' },
    pageHeaderTitle: { fontSize: 28, fontWeight: '800', color: '#f8fafc' },

    contentArea: {
        flex: 1,
        padding: 24,
        alignItems: 'center',
    },
    profileCard: {
        width: '100%',
        maxWidth: 900,
        backgroundColor: '#1e293b',
        borderRadius: 24,
        padding: 32,
        borderWidth: 1,
        borderColor: '#334155',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
        marginBottom: 30,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 40,
        flexWrap: 'wrap',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
        paddingBottom: 30,
    },
    profileInfo: {
        marginLeft: 24,
        alignItems: 'flex-start',
    },
    displayTitle: {
        fontSize: 36,
        fontWeight: '800',
        color: '#f8fafc',
        marginBottom: 8,
    },
    avatarLarge: {
        backgroundColor: '#0f172a',
        borderRadius: 60,
        padding: 4,
        borderWidth: 2,
        borderColor: '#38bdf8',
        shadowColor: "#38bdf8",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
    },
    badge: {
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#38bdf8',
    },
    badgeText: {
        color: '#38bdf8',
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'space-between',
    },
    detailItem: {
        backgroundColor: '#0f172a',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#334155',
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    detailIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    detailLabel: {
        fontSize: 14,
        color: '#94a3b8',
        marginBottom: 4,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    detailValue: {
        fontSize: 18,
        color: '#f8fafc',
        fontWeight: 'bold',
    },
    
    // Mobile Menu Styling
    mobileMenuContainer: {
        width: '100%',
        maxWidth: 900,
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#64748b',
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginLeft: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#334155',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    menuIconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    menuItemText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#f8fafc',
    },
    signOutItem: {
        marginTop: 20,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
    },
});
