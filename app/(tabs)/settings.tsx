import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../services/firebase';

// Web-specific scrollbar styles
const WebScrollbarStyles = () => {
    if (Platform.OS !== 'web') return null;
    return (
        <style type="text/css">
            {`
            ::-webkit-scrollbar { width: 8px; height: 8px; }
            ::-webkit-scrollbar-track { background: #0f172a; }
            ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
            ::-webkit-scrollbar-thumb:hover { background: #475569; }
            `}
        </style>
    );
};

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
                    <Ionicons name="person" size={64} color="#38bdf8" />
                </View>
                <View style={styles.profileInfo}>
                    <Text style={styles.displayTitle}>{userName || 'User'}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{userRole?.toUpperCase() || 'GUEST'}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.detailsGrid}>
                <View style={[styles.detailItem, { width: isLargeScreen ? '48%' : '100%' }]}>
                    <View style={styles.detailIconContainer}>
                         <Ionicons name="person-outline" size={24} color="#38bdf8" />
                    </View>
                    <View>
                        <Text style={styles.detailLabel}>Username</Text>
                        <Text style={styles.detailValue}>{userName}</Text>
                    </View>
                </View>
                <View style={[styles.detailItem, { width: isLargeScreen ? '48%' : '100%' }]}>
                    <View style={styles.detailIconContainer}>
                         <Ionicons name="mail-outline" size={24} color="#38bdf8" />
                    </View>
                    <View>
                        <Text style={styles.detailLabel}>Email Address</Text>
                        <Text style={styles.detailValue}>{userEmail}</Text>
                    </View>
                </View>
                <View style={[styles.detailItem, { width: isLargeScreen ? '48%' : '100%' }]}>
                    <View style={styles.detailIconContainer}>
                         <Ionicons name="shield-checkmark-outline" size={24} color="#38bdf8" />
                    </View>
                    <View>
                        <Text style={styles.detailLabel}>Access Level</Text>
                        <Text style={styles.detailValue}>
                            {userRole === 'superadmin' ? 'System Administrator' : userRole === 'admin' ? 'Manager' : 'Staff Member'}
                        </Text>
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
            <Text style={styles.sectionTitle}>Admin Controls</Text>
            {isAdmin && (
                <>
                    <Pressable style={styles.menuItem} onPress={() => handleNavigate('/create-user')}>
                        <View style={styles.menuIconBox}>
                            <Ionicons name="person-add-outline" size={22} color="#38bdf8" />
                        </View>
                        <Text style={styles.menuItemText}>Create New User</Text>
                        <Ionicons name="chevron-forward" size={20} color="#64748b" style={{marginLeft: 'auto'}} />
                    </Pressable>

                    <Pressable style={styles.menuItem} onPress={() => handleNavigate('/add-menu-item')}>
                        <View style={styles.menuIconBox}>
                            <Ionicons name="cube-outline" size={22} color="#38bdf8" />
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
                            <Ionicons name="time-outline" size={22} color="#38bdf8" />
                        </View>
                        <Text style={styles.menuItemText}>Order History</Text>
                        <Ionicons name="chevron-forward" size={20} color="#64748b" style={{marginLeft: 'auto'}} />
                    </Pressable>
                </>
            )}
            
            <View style={styles.divider} />
            
            <Pressable style={[styles.menuItem, styles.signOutItem]} onPress={handleSignOut}>
                <View style={[styles.menuIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <Ionicons name="log-out-outline" size={22} color="#ef4444" />
                </View>
                <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Sign Out</Text>
            </Pressable>
        </View>
    );

    return (
        <View style={styles.container}>
            <WebScrollbarStyles />
            <View style={styles.header}>
                 <View style={styles.logoContainer}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="settings" size={24} color="#38bdf8" />
                    </View>
                    <Text style={styles.pageHeaderTitle}>Settings</Text>
                 </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {renderProfileContent()}
                {!isLargeScreen && renderMobileMenu()}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    
    // Header
    header: {
        paddingHorizontal: 24,
        paddingVertical: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        zIndex: 10,
    },
    logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    iconCircle: {
        width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(56, 189, 248, 0.1)',
        justifyContent: 'center', alignItems: 'center'
    },
    pageHeaderTitle: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },

    scrollContent: {
        padding: 24,
        alignItems: 'center',
        paddingBottom: 120, // Extra padding for mobile nav
    },
    
    // Profile Card
    profileCard: {
        width: '100%',
        maxWidth: 800,
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
        marginBottom: 32,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
        paddingBottom: 24,
    },
    avatarLarge: {
        width: 88, height: 88,
        backgroundColor: '#0f172a',
        borderRadius: 44,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2,
        borderColor: '#38bdf8',
        shadowColor: "#38bdf8",
        shadowOpacity: 0.3,
        shadowRadius: 15,
    },
    profileInfo: { marginLeft: 24 },
    displayTitle: { fontSize: 28, fontWeight: '800', color: '#f8fafc', marginBottom: 8 },
    badge: {
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        paddingHorizontal: 12, paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1, borderColor: '#38bdf8',
        alignSelf: 'flex-start'
    },
    badgeText: { color: '#38bdf8', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
    
    // Details Grid
    detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    detailItem: {
        backgroundColor: '#0f172a',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1, borderColor: '#334155',
        flexDirection: 'row', alignItems: 'center',
    },
    detailIconContainer: {
        width: 48, height: 48, borderRadius: 12,
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        justifyContent: 'center', alignItems: 'center',
        marginRight: 16,
    },
    detailLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 4, fontWeight: '700', textTransform: 'uppercase' },
    detailValue: { fontSize: 16, color: '#f8fafc', fontWeight: '700' },
    
    // Mobile Menu Styling
    mobileMenuContainer: { width: '100%', maxWidth: 800 },
    sectionTitle: {
        fontSize: 14, fontWeight: '700', color: '#64748b',
        marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1,
        marginLeft: 8,
    },
    menuItem: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#1e293b',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1, borderColor: '#334155',
    },
    menuIconBox: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        justifyContent: 'center', alignItems: 'center',
        marginRight: 16,
    },
    menuItemText: { fontSize: 16, fontWeight: '600', color: '#f8fafc' },
    
    divider: { height: 1, backgroundColor: '#334155', marginVertical: 20 },
    
    signOutItem: {
        borderColor: 'rgba(239, 68, 68, 0.3)',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
    },
});
