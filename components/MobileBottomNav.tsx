import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useState, useEffect, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';

const BAR_HEIGHT = 72;
const DOCK_MARGIN_BOTTOM = 24;
const ICON_SIZE = 26;

export default function MobileBottomNav() {
    const router = useRouter();
    const pathname = usePathname();
    const { userData, cart } = useAuth();
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const { width } = useWindowDimensions();

    const role = userData?.role || 'staff';
    const isAdmin = role === 'admin' || role === 'superadmin';
    const isKitchen = role === 'kitchen';
    const isStaff = role === 'staff';

    // --- Dynamic Menus ---
    const MENUS = useMemo(() => {
        const home = [{ label: 'Menu Catalog', icon: 'restaurant', route: '/dashboard' }];
        if (isAdmin || isStaff) home.push({ label: 'Ongoing Orders', icon: 'hourglass', route: '/ongoing-orders' });
        if (isAdmin || isKitchen) home.push({ label: 'Kitchen Display', icon: 'tv', route: '/kitchen' });

        return {
            HOME: home,
            ADMIN: [
                { label: 'Order History', icon: 'time', route: '/order-history' },
                { label: 'Manage Users', icon: 'people', route: '/manage-users' },
                { label: 'Inventory', icon: 'cube', route: '/add-menu-item' },
                { label: 'Create User', icon: 'person-add', route: '/create-user' },
            ],
            SETTINGS: [
                { label: 'Settings', icon: 'settings', route: '/settings' },
                { label: 'Sign Out', icon: 'log-out', route: 'sign-out', isDestructive: true },
            ]
        };
    }, [role]);

    const isCartSlot = (pathname === '/checkout' || (pathname !== '/dashboard' && cart.length > 0));

    const handlePressItem = (route: string) => {
        if (route === 'sign-out') auth.signOut();
        else router.push(route as any);
        setActiveCategory(null);
    };

    const toggleMenu = (category: string) => {
        if (category === 'HOME' && isCartSlot) {
            router.push('/checkout');
            setActiveCategory(null);
            return;
        }
        setActiveCategory(prev => prev === category ? null : category);
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
                        <MenuList items={MENUS[activeCategory as keyof typeof MENUS]} onItemPress={handlePressItem} />
                    </View>
                )}

                <View style={styles.iconRow}>
                    <NavIcon 
                        icon={isCartSlot ? "cart" : "grid"} 
                        label={isCartSlot ? "Checkout" : "Menu"} 
                        isActive={activeCategory === 'HOME'}
                        onPress={() => toggleMenu('HOME')} 
                        badge={cart.reduce((a, b) => a + b.quantity, 0)}
                    />
                    
                    {isAdmin && (
                        <NavIcon 
                            icon="shield-checkmark" 
                            label="Admin" 
                            isActive={activeCategory === 'ADMIN'}
                            onPress={() => toggleMenu('ADMIN')} 
                        />
                    )}

                    <NavIcon 
                        icon="settings" 
                        label="System" 
                        isActive={activeCategory === 'SETTINGS'}
                        onPress={() => toggleMenu('SETTINGS')} 
                    />
                </View>
            </View>
        </>
    );
}

const NavIcon = ({ icon, label, isActive, onPress, badge }: any) => {
    const scale = useSharedValue(1);
    useEffect(() => { scale.value = withSpring(isActive ? 1.15 : 1); }, [isActive]);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], backgroundColor: isActive ? '#38bdf8' : 'transparent' }));

    return (
        <Pressable onPress={onPress} style={styles.navIconContainer}>
            <View style={styles.iconWrapper}>
                <Animated.View style={[styles.iconBubble, animStyle]}>
                    <Ionicons name={isActive ? icon : `${icon}-outline`} size={ICON_SIZE} color={isActive ? '#0f172a' : '#94a3b8'} />
                </Animated.View>
                {badge > 0 && !isActive && <View style={styles.miniBadge}><Text style={styles.miniBadgeText}>{badge}</Text></View>}
            </View>
            {!isActive && <Text style={styles.navLabel}>{label}</Text>}
        </Pressable>
    );
};

const MenuList = ({ items, onItemPress }: any) => (
    <View style={styles.menuListWrapper}>
        {items.map((item: any, i: number) => (
            <Animated.View key={item.label} entering={SlideInDown.delay(i * 50).springify()}>
                <Pressable style={[styles.menuItem, item.isDestructive && styles.menuItemDestructive]} onPress={() => onItemPress(item.route)}>
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

const styles = StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 90 },
    backdropPressable: { flex: 1 },
    floatingBarContainer: { position: 'absolute', bottom: DOCK_MARGIN_BOTTOM, height: BAR_HEIGHT, backgroundColor: '#1e293b', borderRadius: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 12, borderWidth: 1, borderColor: '#334155' },
    iconRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-evenly', alignItems: 'center' },
    navIconContainer: { alignItems: 'center', justifyContent: 'center', height: '100%', width: 64 },
    iconWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
    iconBubble: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    navLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
    miniBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#1e293b' },
    miniBadgeText: { color: 'white', fontSize: 9, fontWeight: 'bold' },
    popupContainer: { position: 'absolute', bottom: BAR_HEIGHT + 16, left: 0, right: 0, alignItems: 'center' },
    menuListWrapper: { width: 240, gap: 8 },
    menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, borderColor: '#334155', width: '100%', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 },
    menuItemDestructive: { borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.08)' },
    menuIconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(15, 23, 42, 0.6)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    menuText: { color: '#f8fafc', fontSize: 15, fontWeight: '600' }
});