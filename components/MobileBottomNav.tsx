import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { 
    FadeIn, 
    FadeOut, 
    SlideInDown, 
    SlideOutDown, 
    useAnimatedStyle, 
    useSharedValue, 
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';

// --- Configuration ---
const BAR_HEIGHT = 72;
const DOCK_MARGIN_BOTTOM = 24;
const ICON_SIZE = 26;

// Sub-Menu Data Structure
const MENUS = {
    HOME: [
        { label: 'Menu Catalog', icon: 'restaurant', route: '/dashboard' },
    ],
    ADMIN: [
        { label: 'Order History', icon: 'time', route: '/order-history' },
        { label: 'Manage Users', icon: 'people', route: '/manage-users' },
        { label: 'Inventory', icon: 'cube', route: '/add-menu-item' },
        { label: 'Create User', icon: 'person-add', route: '/create-user' },
    ],
    SETTINGS: [
        { label: 'Profile', icon: 'person', route: '/settings' },
        { label: 'Sign Out', icon: 'log-out', route: 'sign-out', isDestructive: true },
    ]
};

export default function MobileBottomNav() {
    const router = useRouter();
    const pathname = usePathname();
    const { userData, cart } = useAuth();
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const { width } = useWindowDimensions();

    const isAdmin = userData?.role === 'admin' || userData?.role === 'superadmin';
    
    // Determine if the first slot is "Home" or "Cart"
    const isCartSlot = (pathname === '/checkout' || (pathname !== '/dashboard' && cart.length > 0));

    const isRouteActive = (category: string) => {
        if (category === 'HOME') return pathname === '/dashboard' || pathname === '/checkout';
        if (category === 'ADMIN') return ['/order-history', '/manage-users', '/add-menu-item', '/create-user'].some(p => pathname.includes(p));
        if (category === 'SETTINGS') return pathname.includes('/settings');
        return false;
    };

    const handlePressItem = (route: string) => {
        if (route === 'sign-out') {
            auth.signOut();
        } else {
            router.push(route as any);
        }
        setActiveCategory(null);
    };

    const toggleMenu = (category: string) => {
        // IF CART SLOT IS ACTIVE AND CLICKED, GO DIRECTLY TO CHECKOUT
        if (category === 'HOME' && isCartSlot) {
            router.push('/checkout');
            setActiveCategory(null);
            return;
        }

        if (activeCategory === category) {
            setActiveCategory(null);
        } else {
            setActiveCategory(category);
        }
    };

    const dockWidth = Math.min(width * 0.9, 380);

    return (
        <>
            {activeCategory && (
                <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.backdrop}>
                    <Pressable style={styles.backdropPressable} onPress={() => setActiveCategory(null)} />
                </Animated.View>
            )}

            <View style={[styles.floatingBarContainer, { width: dockWidth, left: (width - dockWidth) / 2 }]}>
                {activeCategory && (
                    <View style={styles.popupContainer}>
                        {activeCategory === 'HOME' && <MenuList items={MENUS.HOME} onItemPress={handlePressItem} />}
                        {activeCategory === 'ADMIN' && <MenuList items={MENUS.ADMIN} onItemPress={handlePressItem} />}
                        {activeCategory === 'SETTINGS' && <MenuList items={MENUS.SETTINGS} onItemPress={handlePressItem} />}
                    </View>
                )}

                <View style={styles.iconRow}>
                    <NavIcon 
                        icon={ isCartSlot ? "cart" : "restaurant" } 
                        label={ isCartSlot ? "Checkout" : "Home" } 
                        isMenuOpen={activeCategory === 'HOME'}
                        isRouteActive={isRouteActive('HOME')}
                        onPress={() => toggleMenu('HOME')} 
                        showBadge={cart.length > 0}
                        badgeCount={cart.reduce((a, b) => a + b.quantity, 0)}
                    />
                    
                    {isAdmin && (
                        <NavIcon 
                            icon="shield-checkmark" 
                            label="Admin" 
                            isMenuOpen={activeCategory === 'ADMIN'}
                            isRouteActive={isRouteActive('ADMIN')}
                            onPress={() => toggleMenu('ADMIN')} 
                        />
                    )}

                    <NavIcon 
                        icon="settings" 
                        label="Settings" 
                        isMenuOpen={activeCategory === 'SETTINGS'}
                        isRouteActive={isRouteActive('SETTINGS')}
                        onPress={() => toggleMenu('SETTINGS')} 
                    />
                </View>
            </View>
        </>
    );
}

const NavIcon = ({ icon, label, isMenuOpen, isRouteActive, onPress, showBadge, badgeCount }: any) => {
    const scale = useSharedValue(1);
    const glowScale = useSharedValue(0);

    useEffect(() => {
        scale.value = withSpring(isMenuOpen ? 1.15 : 1, { damping: 12 });
        glowScale.value = withSpring(isRouteActive && !isMenuOpen ? 1 : 0);
    }, [isMenuOpen, isRouteActive]);

    const animatedBubbleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        backgroundColor: isMenuOpen ? '#38bdf8' : 'transparent',
    }));

    const animatedGlowStyle = useAnimatedStyle(() => ({
        opacity: glowScale.value * 0.4,
        transform: [{ scale: glowScale.value }]
    }));

    return (
        <Pressable onPress={onPress} style={styles.navIconContainer}>
            <View style={styles.iconWrapper}>
                <Animated.View style={[styles.glowRing, animatedGlowStyle]} />
                <Animated.View style={[styles.iconBubble, animatedBubbleStyle]}>
                    <Ionicons 
                        name={isMenuOpen || isRouteActive ? icon : `${icon}-outline`} 
                        size={ICON_SIZE} 
                        color={isMenuOpen ? '#0f172a' : (isRouteActive ? '#38bdf8' : '#94a3b8')} 
                    />
                </Animated.View>
                {showBadge && !isMenuOpen && (
                    <View style={styles.miniBadge}><Text style={styles.miniBadgeText}>{badgeCount}</Text></View>
                )}
            </View>
            {!isMenuOpen && (
                <Text style={[styles.navLabel, isRouteActive && styles.navLabelActive]}>{label}</Text>
            )}
        </Pressable>
    );
};

const MenuList = ({ items, onItemPress }: any) => {
    return (
        <View style={styles.menuListWrapper}>
            {items.map((item: any, index: number) => (
                <Animated.View key={item.label} entering={SlideInDown.delay(index * 60).springify().damping(16).stiffness(150)} exiting={SlideOutDown.duration(150)}>
                    <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed, item.isDestructive && styles.menuItemDestructive]} onPress={() => onItemPress(item.route)}>
                        <View style={[styles.menuIconBox, item.isDestructive && { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                            <Ionicons name={item.icon} size={22} color={item.isDestructive ? '#ef4444' : '#38bdf8'} />
                        </View>
                        <Text style={[styles.menuText, item.isDestructive && { color: '#ef4444' }]}>{item.label}</Text>
                        <Ionicons name="chevron-forward" size={18} color="#475569" style={{ marginLeft: 'auto' }} />
                    </Pressable>
                </Animated.View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 90, ...Platform.select({ web: { backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' } }) },
    backdropPressable: { flex: 1 },
    floatingBarContainer: { position: 'absolute', bottom: DOCK_MARGIN_BOTTOM, height: BAR_HEIGHT, backgroundColor: '#1e293b', borderRadius: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 12, borderWidth: 1, borderColor: '#334155' },
    iconRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-evenly', alignItems: 'center' },
    navIconContainer: { alignItems: 'center', justifyContent: 'center', height: '100%', width: 64 },
    iconWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
    iconBubble: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 2, zIndex: 2 },
    glowRing: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: '#38bdf8', zIndex: 1, shadowColor: '#38bdf8', shadowOpacity: 0.8, shadowRadius: 20 },
    navLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', marginTop: 2 },
    navLabelActive: { color: '#38bdf8' },
    miniBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#1e293b', zIndex: 5 },
    miniBadgeText: { color: 'white', fontSize: 9, fontWeight: 'bold' },
    popupContainer: { position: 'absolute', bottom: BAR_HEIGHT + 16, left: 0, right: 0, alignItems: 'center' },
    menuListWrapper: { width: 240, gap: 8 },
    menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, borderColor: '#334155', width: '100%', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6, marginBottom: 4 },
    menuItemPressed: { backgroundColor: '#334155', transform: [{ scale: 0.98 }] },
    menuItemDestructive: { borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.08)' },
    menuIconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(15, 23, 42, 0.6)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    menuText: { color: '#f8fafc', fontSize: 15, fontWeight: '600', letterSpacing: 0.3 }
});
