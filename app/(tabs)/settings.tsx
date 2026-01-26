import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../lib/firebaseConfig';

const { width: windowWidth } = Dimensions.get('window');
const isLargeScreen = windowWidth > 768;

export default function SettingsScreen() {
    const router = useRouter();
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

    const renderSidebar = () => (
        <View style={[styles.sidebar, !isLargeScreen && styles.sidebarMobile]}>
            <View>
                <Text style={styles.sidebarHeader}>Management</Text>
                
                <Pressable style={styles.sideItem} onPress={() => handleNavigate('/(tabs)/settings')}>
                    <Ionicons name="person-outline" size={20} color="#38bdf8" />
                    <Text style={[styles.sideItemText, { color: '#38bdf8' }]}>My Profile</Text>
                </Pressable>

                {isAdmin && (
                    <>
                        <Pressable style={styles.sideItem} onPress={() => handleNavigate('/create-user')}>
                            <Ionicons name="person-add-outline" size={20} color="#E2E8F0" />
                            <Text style={styles.sideItemText}>Create User</Text>
                        </Pressable>

                        <Pressable style={styles.sideItem} onPress={() => handleNavigate('/add-menu-item')}>
                            <Ionicons name="clipboard-outline" size={20} color="#E2E8F0" />
                            <Text style={styles.sideItemText}>Inventory & Menu</Text>
                        </Pressable>

                        <Pressable style={styles.sideItem} onPress={() => handleNavigate('/manage-users')}>
                            <Ionicons name="people-outline" size={20} color="#E2E8F0" />
                            <Text style={styles.sideItemText}>Manage Users</Text>
                        </Pressable>

                        <Pressable style={styles.sideItem} onPress={() => handleNavigate('/order-history')}>
                            <Ionicons name="receipt-outline" size={20} color="#E2E8F0" />
                            <Text style={styles.sideItemText}>Order History</Text>
                        </Pressable>
                    </>
                )}
            </View>

            <View style={styles.sidebarFooter}>
                <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
                    <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                    <Text style={styles.signOutText}>Sign Out</Text>
                </Pressable>
                <View style={styles.footerBranding}>
                    <Image source={require('../../assets/images/ic.png')} style={styles.footerLogo} />
                    <Text style={styles.footerCredit}>Designed By Infinity Crafters</Text>
                </View>
            </View>
        </View>
    );

    const renderProfileContent = () => (
        <View style={styles.contentArea}>
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
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Username</Text>
                        <Text style={styles.detailValue}>{userName}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Email Address</Text>
                        <Text style={styles.detailValue}>{userEmail}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Access Level</Text>
                        <Text style={styles.detailValue}>{userRole === 'superadmin' ? 'Full System Access' : userRole === 'admin' ? 'Administrative' : 'Staff'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Account Status</Text>
                        <Text style={[styles.detailValue, { color: '#10b981' }]}>Active</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={[styles.mainLayout, !isLargeScreen && styles.mainLayoutMobile]}>
                {renderSidebar()}
                {isLargeScreen && <View style={styles.verticalDivider} />}
                <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                    {renderProfileContent()}
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    mainLayout: {
        flex: 1,
        flexDirection: 'row',
    },
    mainLayoutMobile: {
        flexDirection: 'column',
    },
    // Sidebar Styles
    sidebar: {
        width: 280,
        backgroundColor: '#1e293b',
        padding: 24,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        justifyContent: 'space-between',
    },
    sidebarMobile: {
        width: '100%',
        paddingTop: 40,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
        justifyContent: 'flex-start',
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
        cursor: Platform.OS === 'web' ? 'pointer' : 'auto',
    },
    sideItemText: {
        color: '#E2E8F0',
        fontSize: 16,
        marginLeft: 12,
        fontWeight: '500',
    },
    sidebarFooter: {
        paddingTop: 20,
    },
    signOutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        marginBottom: 20,
    },
    signOutText: {
        color: '#ef4444',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 12,
    },
    footerBranding: {
        alignItems: 'center',
    },
    footerLogo: {
        width: 100,
        height: 100,
        resizeMode: 'contain',
        marginBottom: 0,
    },
    footerCredit: {
        fontSize: 12,
        color: '#64748b',
    },
    verticalDivider: {
        width: 1,
        backgroundColor: '#334155',
    },
    // Content Area Styles
    contentArea: {
        flex: 1,
        padding: 40,
        backgroundColor: '#0f172a',
    },
    profileCard: {
        width: '100%',
        maxWidth: 800,
        alignSelf: 'center',
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 40,
    },
    profileInfo: {
        marginLeft: 24,
    },
    displayTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#f8fafc',
        marginBottom: 8,
    },
    avatarLarge: {
        backgroundColor: '#1e293b',
        borderRadius: 60,
        padding: 4,
        borderWidth: 2,
        borderColor: '#38bdf8',
    },
    badge: {
        backgroundColor: '#334155',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#38bdf8',
    },
    badgeText: {
        color: '#38bdf8',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 20,
    },
    detailItem: {
        width: isLargeScreen ? '48%' : '100%',
        backgroundColor: '#1e293b',
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#334155',
    },
    detailLabel: {
        fontSize: 14,
        color: '#94a3b8',
        marginBottom: 8,
        fontWeight: '600',
    },
    detailValue: {
        fontSize: 18,
        color: '#f1f5f9',
        fontWeight: 'bold',
    },
});
