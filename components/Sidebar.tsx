import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
    Easing,
    Extrapolation,
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming
} from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';

// --- Configuration ---
const EXPANDED_WIDTH = 280;
const COLLAPSED_WIDTH = 90;
const ANIM_DURATION = 400;
const EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

export default function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const { userData } = useAuth();
    const userRole = userData?.role;
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';
    
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Shared Values
    const sidebarWidth = useSharedValue(EXPANDED_WIDTH);
    const contentOpacity = useSharedValue(1); 
    const creditsHeight = useSharedValue(20); 

    const handleSignOut = () => {
        auth.signOut();
    };

    const handleNavigate = (path: string) => {
        router.push(path as any);
    };

    const isActive = (path: string) => {
        const normalize = (p: string) => p.replace(/\/\([^)]+\)/g, '');
        const current = normalize(pathname);
        const target = normalize(path);
        return current === target || current.startsWith(target + '/');
    };
    
    const toggleSidebar = () => {
        const nextState = !isCollapsed;
        setIsCollapsed(nextState);
        
        if (nextState) {
            // COLLAPSING
            contentOpacity.value = withTiming(0, { duration: 150, easing: EASING });
            sidebarWidth.value = withDelay(50, withTiming(COLLAPSED_WIDTH, { duration: ANIM_DURATION, easing: EASING }));
            creditsHeight.value = withTiming(0, { duration: 200 }); 
        } else {
            // EXPANDING
            sidebarWidth.value = withTiming(EXPANDED_WIDTH, { duration: ANIM_DURATION, easing: EASING });
            contentOpacity.value = withDelay(150, withTiming(1, { duration: 250, easing: EASING }));
            creditsHeight.value = withDelay(200, withTiming(20, { duration: 200 })); 
        }
    };

    const animatedSidebarStyle = useAnimatedStyle(() => ({
        width: sidebarWidth.value,
    }));

    const animatedContentStyle = useAnimatedStyle(() => {
        const width = interpolate(contentOpacity.value, [0, 1], [0, 150], Extrapolation.CLAMP);
        return { opacity: contentOpacity.value, width: width };
    });

    const animatedCreditsStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
        height: creditsHeight.value,
        marginTop: interpolate(contentOpacity.value, [0, 1], [0, 16])
    }));

    // --- Components ---

    const SectionHeader = ({ icon, label }: { icon: any, label: string }) => {
        // Opacity 1 when Expanded (Width 280), 0 when Collapsed (Width 90)
        const grayIconStyle = useAnimatedStyle(() => ({
            opacity: interpolate(sidebarWidth.value, [COLLAPSED_WIDTH, EXPANDED_WIDTH], [0, 1]),
            position: 'absolute'
        }));

        // Opacity 1 when Collapsed, 0 when Expanded
        const whiteIconStyle = useAnimatedStyle(() => ({
            opacity: interpolate(sidebarWidth.value, [COLLAPSED_WIDTH, EXPANDED_WIDTH], [1, 0]),
            // Small scale effect for pop
            transform: [{ scale: interpolate(sidebarWidth.value, [COLLAPSED_WIDTH, EXPANDED_WIDTH], [1.1, 0.8]) }] 
        }));

        return (
            <View style={styles.sectionHeaderContainer}>
                <View style={styles.fixedIconColumn}>
                    {/* 1. Normal Gray Icon (Visible when expanded) */}
                    <Animated.View style={grayIconStyle}>
                        <Ionicons name={icon} size={22} color="#94a3b8" />
                    </Animated.View>

                    {/* 2. Glowing White Icon (Visible when collapsed) */}
                    <Animated.View style={whiteIconStyle}>
                        <Ionicons 
                            name={icon} 
                            size={22} 
                            color="#ffffff" 
                            style={{ 
                                textShadowColor: 'rgba(56, 189, 248, 0.8)', 
                                textShadowRadius: 10 
                            }} 
                        />
                    </Animated.View>
                </View>
                
                <Animated.View style={[animatedContentStyle, styles.labelContainer]}>
                    <Text style={styles.sidebarHeader} variant="labelLarge">{label}</Text>
                </Animated.View>
            </View>
        );
    };

    const HoverableMenuItem = ({ path, icon, label, isSignOut = false, onPress }: any) => {
        const active = !isSignOut && isActive(path);
        const hoverVal = useSharedValue(0);

        const animatedHoverStyle = useAnimatedStyle(() => {
            const bgColor = isSignOut 
                ? interpolateColor(hoverVal.value, [0, 1], ['rgba(239, 68, 68, 0.1)', 'rgba(239, 68, 68, 0.2)'])
                : active 
                    ? '#38bdf8' 
                    : interpolateColor(hoverVal.value, [0, 1], ['transparent', 'rgba(56, 189, 248, 0.1)']);

            const scale = interpolate(hoverVal.value, [0, 1], [1, 1.02]);
            return { backgroundColor: bgColor, transform: [{ scale }] };
        });

        const iconName = active ? icon : (icon.endsWith('-outline') ? icon : icon + '-outline');
        const iconColor = isSignOut ? "#ef4444" : active ? "#0f172a" : "#64748b"; 
        const textColor = isSignOut ? styles.signOutText : [styles.sideItemText, active && styles.sideItemTextActive];

        return (
            <Pressable 
                onPress={onPress || (() => handleNavigate(path))}
                onHoverIn={() => { hoverVal.value = withTiming(1, { duration: 200 }); }}
                onHoverOut={() => { hoverVal.value = withTiming(0, { duration: 200 }); }}
                style={styles.pressableWrapper}
            >
                <Animated.View style={[styles.sideItem, animatedHoverStyle]}>
                    <View style={styles.fixedIconColumn}>
                        <Ionicons name={iconName} size={20} color={iconColor} />
                    </View>
                    <Animated.View style={[styles.labelContainer, animatedContentStyle]}>
                        <Text style={textColor} numberOfLines={1} variant="bodyLarge">{label}</Text>
                    </Animated.View>
                </Animated.View>
            </Pressable>
        );
    };

    return (
        <View style={styles.sidebarWrapper}>
            <Animated.View style={[styles.sidebar, animatedSidebarStyle]}>
                 
                 {/* Header (Toggle) */}
                 <View style={styles.headerContainer}>
                    <View style={styles.fixedIconColumn}>
                        <Pressable 
                            onPress={toggleSidebar} 
                            style={({ pressed }) => [styles.toggleBtn, pressed && { opacity: 0.7 }]}
                        >
                            <Ionicons name={isCollapsed ? "menu" : "chevron-back"} size={20} color="#f8fafc" />
                        </Pressable>
                    </View>
                 </View>

                {/* Main Menu */}
                <View style={styles.menuContainer}>
                    
                    {/* HOME Section */}
                    <SectionHeader icon="home" label="HOME" />
                    <HoverableMenuItem path="/dashboard" icon="restaurant" label="Menu Catalog" />

                    {/* ADMIN Section */}
                    {isAdmin && (
                        <>
                            <View style={styles.adminSpacer} />
                            <SectionHeader icon="shield-checkmark" label="ADMIN" />

                            <HoverableMenuItem path="/create-user" icon="person-add" label="Create User" />
                            <HoverableMenuItem path="/add-menu-item" icon="cube" label="Inventory & Menu" />
                            <HoverableMenuItem path="/manage-users" icon="people" label="Manage Users" />
                            <HoverableMenuItem path="/order-history" icon="time" label="Order History" />
                        </>
                    )}
                </View>

                {/* Footer */}
                <View style={styles.sidebarFooter}>
                    <HoverableMenuItem path="/settings" icon="settings" label="Settings" />
                    
                    <HoverableMenuItem 
                        path="sign-out" 
                        icon="log-out" 
                        label="Sign Out" 
                        isSignOut={true} 
                        onPress={handleSignOut} 
                    />
                    
                    {/* Credits */}
                    <Animated.View style={[styles.creditsContainer, animatedCreditsStyle]}>
                        <Text style={styles.creditsText}>Designed by Infinity Crafters</Text>
                    </Animated.View>
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    sidebarWrapper: {
        height: '100%',
        padding: 24, 
        backgroundColor: '#0f172a',
    },
    sidebar: {
        backgroundColor: '#1e293b',
        paddingVertical: 24,
        paddingHorizontal: 16, 
        justifyContent: 'space-between',
        height: '100%',
        borderRadius: 24, 
        borderWidth: 1,
        borderColor: '#334155',
        shadowColor: "#000",
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        ...Platform.select({
            web: { boxShadow: '4px 0 24px rgba(0, 0, 0, 0.2)' },
            default: { elevation: 10 }
        }),
        overflow: 'hidden',
    },
    
    headerContainer: {
        marginBottom: 32,
        width: '100%',
        height: 40, 
        flexDirection: 'row',
        alignItems: 'center',
    },
    toggleBtn: {
        width: 36, 
        height: 36, 
        borderRadius: 10, 
        backgroundColor: '#334155', 
        justifyContent: 'center', 
        alignItems: 'center',
        ...Platform.select({ web: { cursor: 'pointer', transition: 'background-color 0.2s' } })
    },

    menuContainer: {
        flex: 1, 
        width: '100%',
    },
    
    sectionHeaderContainer: {
        height: 40, 
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        marginTop: 8,
    },
    sidebarHeader: {
        fontWeight: '800', 
        color: '#f1f5f9', 
        letterSpacing: 0.5,
        fontSize: 13, 
    },
    adminSpacer: {
        height: 32, 
        width: '100%',
    },

    pressableWrapper: {
        marginBottom: 4,
        width: '100%',
    },
    sideItem: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12, 
        width: '100%',
        height: 48,
        ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    
    // Fixed container for Icons to ensure they stack and align
    fixedIconColumn: {
        width: 58, 
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative', // Necessary for absolute children
    },
    
    labelContainer: {
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        justifyContent: 'center',
    },
    sideItemText: {
        color: '#94a3b8',
        fontWeight: '500', 
        fontSize: 14,
    },
    sideItemTextActive: {
        color: '#0f172a',
        fontWeight: '700',
    },
    
    sidebarFooter: {
        width: '100%',
        borderTopWidth: 1,
        borderTopColor: '#334155',
        paddingTop: 16,
    },
    signOutText: {
        color: '#ef4444',
        fontWeight: 'bold',
        fontSize: 14,
    },
    creditsContainer: {
        paddingLeft: 12,
        overflow: 'hidden', 
    },
    creditsText: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '500',
        fontStyle: 'italic',
    },
});