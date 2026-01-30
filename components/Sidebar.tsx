import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, Platform, useWindowDimensions } from 'react-native';
import Animated, { 
    FadeIn, 
    FadeOut, 
    ZoomIn, 
    ZoomOut,
    SlideInLeft,
    useAnimatedStyle, 
    useSharedValue, 
    withSpring, 
    withTiming,
    Layout
} from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';

// --- Configuration ---
const RAIL_WIDTH = 68;
const ICON_SIZE = 24;
const MENU_OFFSET = 96; 

export default function Sidebar() {
    // 1. Hooks (Always at top)
    const router = useRouter();
    const pathname = usePathname();
    const { userData } = useAuth();
    
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<{ y: number, anchor: 'top' | 'bottom' } | null>(null);
    const layoutMap = useRef<Record<string, number>>({});

    const role = userData?.role || 'staff';
    const isAdmin = role === 'admin' || role === 'superadmin';
    const isStaff = role === 'staff';
    const isKitchen = role === 'kitchen';

    // 2. Menu Logic
    const MENUS = useMemo(() => {
        const homeItems = [{ label: 'Catalog', icon: 'grid', route: '/dashboard' }];
        
        if (isAdmin || isStaff) {
            homeItems.push({ label: 'Ongoing Orders', icon: 'hourglass', route: '/ongoing-orders' });
        }
        
        if (isAdmin) {
            homeItems.push({ label: 'Kitchen Display', icon: 'tv', route: '/kitchen' });
        }

        return {
            HOME: homeItems,
            ADMIN: isAdmin ? [
                { label: 'History', icon: 'time', route: '/order-history' },
                { label: 'Users', icon: 'people', route: '/manage-users' },
                { label: 'Inventory', icon: 'cube', route: '/add-menu-item' },
                { label: 'Add User', icon: 'person-add', route: '/create-user' },
            ] : [],
            SETTINGS: [{ label: 'My Profile', icon: 'person', route: '/settings' }]
        };
    }, [role, isAdmin, isStaff]);

    const handlePressItem = (route: string) => {
        router.push(route as any);
        setActiveCategory(null);
    };

    const toggleMenu = (category: string, anchor: 'top' | 'bottom') => {
        if (activeCategory === category) {
            setActiveCategory(null);
            return;
        }
        
        const yPos = layoutMap.current[category] || 0;
        const finalY = anchor === 'top' 
            ? yPos + 24 + 12 
            : 80;

        setMenuAnchor({ y: finalY, anchor });
        setActiveCategory(category);
    };

    const captureLayout = (category: string, event: any) => {
        layoutMap.current[category] = event.nativeEvent.layout.y;
    };

    const isRouteActive = (category: string) => {
        const items = MENUS[category as keyof typeof MENUS];
        return items?.some(i => pathname.includes(i.route));
    };

    // 3. LOGIC FIX: Only hide sidebar if the USER ROLE is 'kitchen'.
    // Admins viewing the kitchen page will still see the sidebar.
    if (isKitchen) {
        return null;
    }

    return (
        <>
            {/* Backdrop */}
            {activeCategory && (
                <Pressable style={styles.backdrop} onPress={() => setActiveCategory(null)} />
            )}

            <View style={styles.sidebarWrapper}>
                
                {/* --- Top Rail --- */}
                <View style={styles.railPill}>
                    <View onLayout={(e) => captureLayout('HOME', e)} style={{zIndex: 20}}>
                        <NavIcon 
                            icon="restaurant" 
                            label="Menu"
                            isActive={activeCategory === 'HOME' || isRouteActive('HOME')} 
                            onPress={() => toggleMenu('HOME', 'top')} 
                            isMenuOpen={activeCategory !== null}
                        />
                    </View>
                    
                    {isAdmin && (
                        <View onLayout={(e) => captureLayout('ADMIN', e)} style={{zIndex: 20}}>
                            <NavIcon 
                                icon="shield-checkmark" 
                                label="Admin"
                                isActive={activeCategory === 'ADMIN' || isRouteActive('ADMIN')} 
                                onPress={() => toggleMenu('ADMIN', 'top')} 
                                isMenuOpen={activeCategory !== null}
                            />
                        </View>
                    )}
                </View>

                {/* --- Bottom Rail --- */}
                <View style={styles.railPill}>
                    <View onLayout={(e) => captureLayout('SETTINGS', e)} style={{zIndex: 20}}>
                        <NavIcon 
                            icon="settings" 
                            label="Settings"
                            isActive={activeCategory === 'SETTINGS' || isRouteActive('SETTINGS')} 
                            onPress={() => toggleMenu('SETTINGS', 'bottom')} 
                            isMenuOpen={activeCategory !== null}
                        />
                    </View>
                    
                    <View style={{zIndex: 20}}>
                        <NavIcon 
                            icon="log-out" 
                            label="Exit"
                            isActive={false}
                            isDestructive
                            onPress={() => auth.signOut()} 
                            isMenuOpen={activeCategory !== null}
                        />
                    </View>
                </View>

                {/* --- Floating Menus --- */}
                {activeCategory && menuAnchor && (
                    <View style={[
                        styles.flyoutContainer,
                        {
                            top: menuAnchor.anchor === 'top' ? menuAnchor.y : undefined,
                            bottom: menuAnchor.anchor === 'bottom' ? menuAnchor.y : undefined,
                        }
                    ]}>
                        <FlyoutGroup 
                            items={MENUS[activeCategory as keyof typeof MENUS]} 
                            onItemPress={handlePressItem} 
                        />
                    </View>
                )}
            </View>
        </>
    );
}

// --- Sub Components ---

const NavIcon = ({ icon, label, isActive, onPress, badge, isDestructive, isMenuOpen }: any) => {
    const [isHovered, setIsHovered] = useState(false);
    
    const scale = useSharedValue(1);
    const bgOpacity = useSharedValue(0);

    useEffect(() => {
        scale.value = withSpring(isActive ? 1.15 : (isHovered ? 1.05 : 1));
        bgOpacity.value = withTiming(isActive ? 1 : (isHovered ? 0.2 : 0), { duration: 250 });
    }, [isActive, isHovered]);

    const animatedBubble = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        backgroundColor: isActive ? '#38bdf8' : `rgba(56, 189, 248, ${bgOpacity.value})`,
        borderRadius: 20,
    }));

    return (
        <View style={styles.iconWrapper}>
            <Pressable 
                onPress={onPress} 
                onHoverIn={() => setIsHovered(true)}
                onHoverOut={() => setIsHovered(false)}
                style={styles.iconBtn}
            >
                <Animated.View style={[styles.iconBubble, animatedBubble]}>
                    <Ionicons 
                        name={isActive ? icon : `${icon}-outline`} 
                        size={ICON_SIZE} 
                        color={isActive ? '#0f172a' : (isDestructive ? '#ef4444' : (isHovered ? '#f8fafc' : '#94a3b8'))} 
                    />
                    {badge > 0 && (
                        <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
                    )}
                </Animated.View>
            </Pressable>

            {/* Tooltip: Always on top (zIndex 9999) */}
            {isHovered && (
                <Animated.View entering={ZoomIn.duration(150)} exiting={ZoomOut.duration(150)} style={styles.tooltip}>
                    <Text style={styles.tooltipText}>{label}</Text>
                </Animated.View>
            )}
        </View>
    );
};

const FlyoutGroup = ({ items = [], onItemPress }: any) => {
    if (!items || items.length === 0) return null;

    return (
        <View style={styles.flyoutColumn}>
            {items.map((item: any, index: number) => (
                <Animated.View 
                    key={item.label} 
                    entering={SlideInLeft.delay(index * 40).springify().damping(14)} 
                    exiting={FadeOut.duration(150)}
                    layout={Layout.springify()}
                >
                    <Pressable 
                        style={({pressed}) => [styles.floatingRow, pressed && styles.floatingRowPressed]} 
                        onPress={() => onItemPress(item.route)}
                    >
                        <View style={[styles.rowIcon, item.isDestructive && {backgroundColor:'rgba(239,68,68,0.15)'}]}>
                            <Ionicons name={item.icon} size={20} color={item.isDestructive ? '#ef4444' : '#38bdf8'} />
                        </View>
                        <Text style={[styles.rowText, item.isDestructive && {color:'#ef4444'}]}>{item.label}</Text>
                    </Pressable>
                </Animated.View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 40, backgroundColor: 'transparent' },
    
    sidebarWrapper: { 
        height: '100%', 
        width: 100, 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingVertical: 24, 
        zIndex: 50 
    },

    railPill: {
        width: RAIL_WIDTH,
        backgroundColor: '#1e293b',
        borderRadius: 100, 
        paddingVertical: 12,
        alignItems: 'center',
        gap: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#334155',
        zIndex: 60
    },

    iconWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center', zIndex: 70 },
    iconBtn: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
    iconBubble: { 
        width: 44, height: 44, borderRadius: 22,
        alignItems: 'center', justifyContent: 'center',
    },
    
    badge: { 
        position: 'absolute', top: -4, right: -4, 
        backgroundColor: '#ef4444', 
        minWidth: 18, height: 18, borderRadius: 9, 
        alignItems: 'center', justifyContent: 'center', 
        borderWidth: 2, borderColor: '#1e293b' 
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

    tooltip: {
        position: 'absolute',
        left: 80, 
        backgroundColor: '#0f172a',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334155',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 99,
        zIndex: 9999, // Guaranteed on top
        minWidth: 90,
        alignItems: 'center'
    },
    tooltipText: { color: '#f8fafc', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 } as any,

    flyoutContainer: { 
        position: 'absolute',
        left: MENU_OFFSET, 
        zIndex: 80 
    },
    flyoutColumn: {
        gap: 8,
        minWidth: 200,
    },

    floatingRow: { 
        flexDirection: 'row', alignItems: 'center', 
        backgroundColor: '#1e293b',
        paddingVertical: 12, paddingHorizontal: 16, 
        borderRadius: 16, 
        borderWidth: 1, borderColor: '#334155',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6
    },
    floatingRowPressed: { backgroundColor: '#334155', transform: [{scale: 0.98}] },
    
    rowIcon: { 
        width: 32, height: 32, borderRadius: 10, 
        backgroundColor: 'rgba(56, 189, 248, 0.1)', 
        alignItems: 'center', justifyContent: 'center', 
        marginRight: 14 
    },
    rowText: { color: '#f8fafc', fontWeight: '600', fontSize: 14, letterSpacing: 0.25 }
});