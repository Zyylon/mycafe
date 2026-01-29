import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
    Easing,
    Extrapolation,
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
    FadeIn,
    FadeOut,
    withSpring
} from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';

const ANIM_DURATION = 400;
const EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

export default function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const { userData, cart } = useAuth();
    const { width } = useWindowDimensions();

    const userRole = userData?.role;
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Dynamic Dimensions
    const dims = useMemo(() => {
        if (width > 2500) { 
            return { expanded: 360, collapsed: 100, icon: 28, text: 18, header: 16, itemHeight: 64 };
        } else if (width < 1400) { 
            return { expanded: 240, collapsed: 72, icon: 20, text: 13, header: 11, itemHeight: 48 };
        } else {
            return { expanded: 280, collapsed: 84, icon: 24, text: 14, header: 13, itemHeight: 52 };
        }
    }, [width]);

    const sidebarWidth = useSharedValue(dims.expanded);
    const contentOpacity = useSharedValue(1); 
    const creditsHeight = useSharedValue(20); 
    const rotation = useSharedValue(0);

    useEffect(() => {
        const targetWidth = isCollapsed ? dims.collapsed : dims.expanded;
        sidebarWidth.value = withSpring(targetWidth, { damping: 20, stiffness: 90 });
    }, [width, dims, isCollapsed]);

    const handleSignOut = () => { auth.signOut(); };
    const handleNavigate = (path: string) => { router.push(path as any); };

    const isActive = (path: string) => {
        const normalize = (p: string) => p.replace(/\/\([^)]+\)/g, '');
        const current = normalize(pathname);
        const target = normalize(path);
        return current === target || current.startsWith(target + '/');
    };
    
    const toggleSidebar = () => {
        const nextState = !isCollapsed;
        setIsCollapsed(nextState);
        rotation.value = withSpring(nextState ? 180 : 0, { damping: 15 });

        if (nextState) {
            contentOpacity.value = withTiming(0, { duration: 150 });
            creditsHeight.value = withTiming(0, { duration: 200 }); 
        } else {
            contentOpacity.value = withDelay(150, withTiming(1, { duration: 250 }));
            creditsHeight.value = withDelay(200, withTiming(20, { duration: 200 })); 
        }
    };

    const animatedSidebarStyle = useAnimatedStyle(() => ({ width: sidebarWidth.value }));

    const animatedContentStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
        transform: [{ translateX: interpolate(contentOpacity.value, [0, 1], [-20, 0]) }]
    }));

    const animatedToggleStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }]
    }));

    const animatedCreditsStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
        height: creditsHeight.value,
        marginTop: interpolate(contentOpacity.value, [0, 1], [0, 16])
    }));

    const SectionHeader = ({ icon, label }: { icon: any, label: string }) => {
        const whiteIconStyle = useAnimatedStyle(() => ({
            opacity: interpolate(sidebarWidth.value, [dims.collapsed, dims.expanded], [1, 0], Extrapolation.CLAMP),
            transform: [{ scale: interpolate(sidebarWidth.value, [dims.collapsed, dims.expanded], [1.1, 0.8], Extrapolation.CLAMP) }] 
        }));
        return (
            <View style={styles.sectionHeaderContainer}>
                <View style={[styles.fixedIconColumn, { width: dims.collapsed - 32, height: dims.itemHeight }]}>
                    <Animated.View style={whiteIconStyle}>
                        <Ionicons name={icon} size={dims.icon} color="#38bdf8" />
                    </Animated.View>
                </View>
                <Animated.View style={[animatedContentStyle, styles.labelContainer]}>
                    <Text style={{ fontWeight: '800', color: '#64748b', letterSpacing: 1, fontSize: dims.header }}>{label}</Text>
                </Animated.View>
            </View>
        );
    };

    const HoverableMenuItem = ({ path, icon, label, isSignOut = false, onPress, showBadge = false, badgeCount = 0 }: any) => {
        const active = !isSignOut && isActive(path);
        const hoverVal = useSharedValue(0);

        const animatedHoverStyle = useAnimatedStyle(() => {
            const bgColor = isSignOut 
                ? interpolateColor(hoverVal.value, [0, 1], ['rgba(239, 68, 68, 0.05)', 'rgba(239, 68, 68, 0.15)'])
                : active 
                    ? '#38bdf8' 
                    : interpolateColor(hoverVal.value, [0, 1], ['transparent', 'rgba(56, 189, 248, 0.08)']);
            
            const scale = interpolate(hoverVal.value, [0, 1], [1, 1.02]);
            const shadowOpacity = active ? withSpring(0.4) : withSpring(0);
            const shadowRadius = active ? withSpring(12) : withSpring(0);

            // FIX: Morphing logic to ensure a perfect circle when collapsed
            const itemWidth = interpolate(sidebarWidth.value, [dims.collapsed, dims.expanded], [dims.itemHeight, dims.expanded - 32], Extrapolation.CLAMP);
            const borderRadius = dims.itemHeight / 2;

            return { 
                backgroundColor: bgColor, 
                transform: [{ scale }],
                width: itemWidth,
                height: dims.itemHeight,
                borderRadius: borderRadius,
                shadowColor: '#38bdf8',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: shadowOpacity,
                shadowRadius: shadowRadius,
                alignSelf: 'center' as any
            };
        });

        const iconName = active ? icon : (icon.endsWith('-outline') ? icon : icon + '-outline');
        const iconColor = isSignOut ? "#ef4444" : active ? "#0f172a" : "#94a3b8"; 
        const baseTextStyle = { fontSize: dims.text, fontWeight: '600' as const };
        const activeTextStyle = { fontWeight: '700' as const, color: '#0f172a' };
        const textStyle = isSignOut 
            ? { ...baseTextStyle, color: '#ef4444' }
            : [ { ...baseTextStyle, color: '#94a3b8' }, active && activeTextStyle ];

        return (
            <Pressable 
                onPress={onPress || (() => handleNavigate(path))}
                onHoverIn={() => { hoverVal.value = withTiming(1, { duration: 200 }); }}
                onHoverOut={() => { hoverVal.value = withTiming(0, { duration: 200 }); }}
                style={styles.pressableWrapper}
            >
                <Animated.View style={[styles.sideItem, animatedHoverStyle]}>
                    <View style={[styles.fixedIconColumn, { width: dims.itemHeight, height: dims.itemHeight }]}>
                        <Ionicons name={iconName} size={dims.icon} color={iconColor} />
                        {showBadge && badgeCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{badgeCount}</Text>
                            </View>
                        )}
                    </View>
                    <Animated.View style={[styles.labelContainer, animatedContentStyle]}>
                        <Text style={textStyle} numberOfLines={1}>{label}</Text>
                    </Animated.View>
                </Animated.View>
            </Pressable>
        );
    };

    const renderHomeSlot = () => {
        const isCheckoutActive = pathname === '/checkout';
        const hasCartItems = cart.length > 0;
        const showCheckout = isCheckoutActive || (pathname !== '/dashboard' && hasCartItems);

        if (showCheckout) {
            return (
                <Animated.View key="checkout" entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)}>
                    <HoverableMenuItem 
                        path="/checkout" 
                        icon="cart" 
                        label="Checkout" 
                        showBadge={hasCartItems} 
                        badgeCount={cart.reduce((a, b) => a + b.quantity, 0)} 
                    />
                </Animated.View>
            );
        }

        return (
            <Animated.View key="menu" entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)}>
                <HoverableMenuItem path="/dashboard" icon="restaurant" label="Menu Catalog" />
            </Animated.View>
        );
    };

    return (
        <View style={styles.sidebarWrapper}>
            <Animated.View style={[styles.sidebar, animatedSidebarStyle]}>
                 <View style={styles.headerContainer}>
                    <View style={[styles.fixedIconColumn, { width: dims.collapsed - 32, height: 48 }]}>
                        <Pressable onPress={toggleSidebar} style={styles.toggleBtn}>
                            <Animated.View style={animatedToggleStyle}>
                                <Ionicons name="chevron-back" size={24} color="#f8fafc" />
                            </Animated.View>
                        </Pressable>
                    </View>
                 </View>

                <View style={styles.menuContainer}>
                    <SectionHeader icon="home" label="HOME" />
                    {renderHomeSlot()}

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

                <View style={styles.sidebarFooter}>
                    <HoverableMenuItem path="/settings" icon="settings" label="Settings" />
                    <HoverableMenuItem path="sign-out" icon="log-out" label="Sign Out" isSignOut={true} onPress={handleSignOut} />
                    
                    <Animated.View style={[styles.creditsContainer, animatedCreditsStyle]}>
                        <Text style={styles.creditsText}>Designed by Infinity Crafters</Text>
                    </Animated.View>
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    sidebarWrapper: { height: '100%', padding: 24, backgroundColor: '#0f172a' },
    sidebar: { backgroundColor: '#1e293b', paddingVertical: 24, paddingHorizontal: 16, justifyContent: 'space-between', height: '100%', borderRadius: 32, borderWidth: 1, borderColor: '#334155', shadowColor: "#000", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.3, shadowRadius: 16, overflow: 'hidden' },
    headerContainer: { marginBottom: 32, width: '100%', height: 48, flexDirection: 'row', alignItems: 'center' },
    toggleBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
    menuContainer: { flex: 1, width: '100%' },
    sectionHeaderContainer: { height: 40, flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 12 },
    adminSpacer: { height: 24, width: '100%' },
    pressableWrapper: { marginBottom: 6, width: '100%' },
    sideItem: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
    fixedIconColumn: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
    labelContainer: { overflow: 'hidden', justifyContent: 'center' },
    sidebarFooter: { width: '100%', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 16 },
    creditsContainer: { paddingLeft: 12, overflow: 'hidden' },
    creditsText: { fontSize: 10, color: '#64748b', fontWeight: '500', fontStyle: 'italic' },
    badge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1e293b' },
    badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' }
});
