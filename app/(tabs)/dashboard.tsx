import { useLocalSearchParams, useRouter } from 'expo-router';
import { onValue, ref as dbRef } from 'firebase/database';
import React, { useEffect, useState, useMemo, memo, useRef, useCallback } from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
    Pressable,
    FlatList,
    NativeSyntheticEvent,
    NativeScrollEvent
} from 'react-native';
import { Image } from 'expo-image';
import Animated, { 
    FadeOut, 
    SlideInDown, 
    FadeIn, 
    useSharedValue, 
    useAnimatedStyle, 
    withSpring, 
    withTiming,
    interpolate,
    Extrapolation
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { database } from '../../services/firebase';
import { Ionicons } from '@expo/vector-icons';

// --- Types ---
interface MenuItem {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    categoryId: string;
}

interface Category {
    id: string;
    name: string;
}

const MENU_CACHE_KEY = 'cafe_menu_cache';

const WebScrollbarStyles = () => {
    if (Platform.OS !== 'web') return null;
    return (
        <style type="text/css">
            {`
            ::-webkit-scrollbar { width: 10px; height: 10px; }
            ::-webkit-scrollbar-track { background: #0f172a; }
            ::-webkit-scrollbar-thumb { background: #334155; border-radius: 5px; border: 2px solid #0f172a; }
            ::-webkit-scrollbar-thumb:hover { background: #475569; }
            .category-scroll-container::-webkit-scrollbar { height: 6px; }
            .category-scroll-container::-webkit-scrollbar-thumb { background: #38bdf8; border-radius: 10px; }
            `}
        </style>
    );
};

const MenuRow = memo(({ items, categories, onAdd, numColumns }: any) => {
    const itemWidth = `${100 / numColumns}%`;
    return (
        <View style={styles.gridRow}>
            {items.map((item: any) => (
                <View key={item.id} style={[styles.cardContainer, { width: itemWidth }]}>
                    <View style={styles.card}>
                        <View style={styles.imageWrapper}>
                            <Image source={item.imageUrl} style={styles.cardImage} contentFit="cover" transition={200} cachePolicy="disk" />
                            <View style={styles.gradientOverlay} />
                            <View style={styles.priceTag}><Text style={styles.priceText}>PKR {item.price.toFixed(0)}</Text></View>
                        </View>
                        <View style={styles.cardContent}>
                            <View>
                                <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.cardCategory}>{categories.find((c: any) => c.id === item.categoryId)?.name || 'General'}</Text>
                            </View>
                            <Pressable style={({pressed}) => [styles.addBtn, pressed && { opacity: 0.8 }]} onPress={() => onAdd(item)}>
                                <Text style={styles.addBtnText}>Add</Text>
                                <Ionicons name="add-circle" size={20} color="#0f172a" />
                            </Pressable>
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );
});

const MobileItem = memo(({ item, categories, onAdd }: any) => (
    <View style={styles.mobileItemContainer}>
        <View style={styles.mobileCard}>
            <Image source={item.imageUrl} style={styles.mobileImage} contentFit="cover" transition={200} cachePolicy="disk" />
            <View style={styles.mobileContent}>
                <View style={styles.mobileInfo}>
                    <Text style={styles.mobileTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.mobileCategory}>{categories.find((c: any) => c.id === item.categoryId)?.name || 'General'}</Text>
                </View>
                <View style={styles.mobileFooter}>
                    <Text style={styles.mobilePrice}>PKR {item.price.toFixed(0)}</Text>
                    <Pressable style={({pressed}) => [styles.mobileAddBtn, pressed && { opacity: 0.8 }]} onPress={() => onAdd(item)}>
                        <Ionicons name="add" size={20} color="#0f172a" />
                    </Pressable>
                </View>
            </View>
        </View>
    </View>
));

export default function DashboardScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { userData, cart, setCart, clearCart } = useAuth();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const flatListRef = useRef<FlatList>(null);
    const searchInputRef = useRef<TextInput>(null);
    
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState<boolean>(true);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isSearchHovered, setIsSearchHovered] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    const expansionProgress = useSharedValue(1);

    const isMobile = width < 768;
    const numColumns = isMobile ? 1 : width >= 1400 ? 4 : 3; 

    useEffect(() => {
        if (Platform.OS === 'web') {
            try {
                const cached = localStorage.getItem(MENU_CACHE_KEY);
                if (cached) {
                    const { items, cats } = JSON.parse(cached);
                    setMenuItems(items);
                    setCategories(cats);
                    setLoading(false);
                }
            } catch (e) { console.warn("Cache load failed", e); }
        }

        const categoriesRef = dbRef(database, 'categories');
        const menuItemsRef = dbRef(database, 'menu_items');

        const unsubCat = onValue(categoriesRef, (catSnap) => {
            const freshCats = catSnap.exists() ? Object.keys(catSnap.val()).map(k => ({ id: k, ...catSnap.val()[k] })) : [];
            setCategories(freshCats);
            
            const unsubMenu = onValue(menuItemsRef, (menuSnap) => {
                const freshItems = menuSnap.exists() ? Object.keys(menuSnap.val()).map(k => ({ id: k, ...menuSnap.val()[k] })) : [];
                setMenuItems(freshItems);
                setLoading(false);
                
                if (Platform.OS === 'web') {
                    localStorage.setItem(MENU_CACHE_KEY, JSON.stringify({ items: freshItems, cats: freshCats }));
                }
            });
            return unsubMenu;
        });

        return unsubCat;
    }, []);

    useEffect(() => {
        const shouldExpand = !isScrolled || isSearchHovered || isSearchFocused;
        expansionProgress.value = withSpring(shouldExpand ? 1 : 0, {
            damping: 18,
            stiffness: 120
        });
    }, [isScrolled, isSearchHovered, isSearchFocused]);

    useEffect(() => {
        if (params.clearCart === 'true') {
            clearCart();
            router.setParams({ clearCart: '' });
            setIsCartOpen(false);
        }
    }, [params.clearCart]);

    const { displayData, jumpOffsets } = useMemo(() => {
        const filtered = menuItems.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
        let rows: any[] = [];
        let offsets: Record<string, number> = {};

        categories.forEach((cat) => {
            const items = filtered.filter(i => i.categoryId === cat.id);
            if (items.length > 0) {
                offsets[cat.id] = rows.length;
                rows.push({ type: 'header', name: cat.name, id: cat.id });
                
                if (isMobile) {
                    items.forEach(item => rows.push({ type: 'item', data: item }));
                } else {
                    for (let i = 0; i < items.length; i += numColumns) {
                        rows.push({ type: 'row', data: items.slice(i, i + numColumns) });
                    }
                }
            }
        });
        return { displayData: rows, jumpOffsets: offsets };
    }, [menuItems, categories, searchQuery, isMobile, numColumns]);

    const scrollToCategory = (catId: string) => {
        const index = jumpOffsets[catId];
        if (index !== undefined) {
            flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
        }
    };

    const scrollToTop = () => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    };

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        setShowScrollTop(offsetY > 400);
        setIsScrolled(offsetY > 80);
    };

    const addToCart = useCallback((item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { ...item, quantity: 1 }];
        });
        if (!isMobile) setIsCartOpen(true); 
    }, [setCart, isMobile]);

    const updateQuantity = useCallback((itemId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === itemId) return { ...item, quantity: Math.max(0, item.quantity + delta) };
            return item;
        }).filter(i => i.quantity > 0));
    }, [setCart]);

    const renderHeader = () => (
        <View style={[styles.headerSection, isMobile && styles.headerSectionMobile]}>
            <View style={[styles.titleRow, isMobile && { marginBottom: 12 }]}>
                <View style={styles.logoContainer}>
                     <View style={styles.logoIconContainer}><Image source={require('../../assets/images/ic.png')} style={styles.logoImage} contentFit="contain" /></View>
                    <View>
                        <Text style={styles.welcomeText}>Welcome back,</Text>
                        <Text style={styles.brandText}>{userData?.username || 'Guest'}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.categoryContainer}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={Platform.OS === 'web'} 
                    contentContainerStyle={styles.categoryScroll} 
                    className="category-scroll-container"
                >
                    {categories.filter(c => jumpOffsets[c.id] !== undefined).map((cat) => (
                        <Pressable key={cat.id} onPress={() => scrollToCategory(cat.id)} style={styles.catPill}>
                            <Text style={styles.catText}>{cat.name}</Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>
        </View>
    );

    // --- ENHANCED MORPHING SEARCH ---
    const animatedPillStyle = useAnimatedStyle(() => {
        const fullWidth = Math.min(width * 0.9, 600);
        const iconWidth = 56;
        
        return {
            width: interpolate(expansionProgress.value, [0, 1], [iconWidth, fullWidth], Extrapolation.CLAMP),
            borderRadius: interpolate(expansionProgress.value, [0, 1], [28, 16], Extrapolation.CLAMP),
            paddingHorizontal: interpolate(expansionProgress.value, [0, 1], [0, 20], Extrapolation.CLAMP), // No padding when icon
            justifyContent: expansionProgress.value < 0.5 ? 'center' : 'flex-start', // Perfect center for icon
            borderColor: isSearchFocused ? '#38bdf8' : '#334155',
            backgroundColor: '#1e293b',
            boxShadow: isSearchFocused 
                ? '0 0 25px rgba(56, 189, 248, 0.2)' 
                : expansionProgress.value === 0 
                    ? '0 4px 10px rgba(0,0,0,0.3)' 
                    : '0 10px 20px rgba(0,0,0,0.4)',
        } as any;
    });

    const animatedInputStyle = useAnimatedStyle(() => ({
        opacity: interpolate(expansionProgress.value, [0, 0.7, 1], [0, 0, 1]), // Fade in later
        width: expansionProgress.value > 0.1 ? 'auto' : 0,
        marginLeft: interpolate(expansionProgress.value, [0, 1], [0, 12], Extrapolation.CLAMP),
    }));

    const renderStickySearch = () => (
        <View 
            style={[styles.stickySearchContainer, { top: isMobile ? insets.top + 5 : 20 }]}
            onMouseEnter={() => !isMobile && setIsSearchHovered(true)}
            onMouseLeave={() => !isMobile && setIsSearchHovered(false)}
        >
            <Animated.View style={[styles.searchPill, animatedPillStyle]}>
                <Ionicons 
                    name="search" 
                    size={24} 
                    color={isSearchFocused || expansionProgress.value < 0.5 ? "#38bdf8" : "#64748b"} 
                />
                <Animated.View style={[styles.inputWrapper, animatedInputStyle]}>
                    <TextInput 
                        ref={searchInputRef}
                        placeholder="Search delicious food..." 
                        placeholderTextColor="#64748b" 
                        style={styles.searchInput} 
                        value={searchQuery} 
                        onChangeText={setSearchQuery}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setIsSearchFocused(false)}
                    />
                </Animated.View>
            </Animated.View>
        </View>
    );

    return (
        <View style={[styles.page, { paddingTop: isMobile ? insets.top : 0 }]}>
            <WebScrollbarStyles />
            <View style={{ flex: 1 }} onStartShouldSetResponder={() => { if(isCartOpen) setIsCartOpen(false); return false; }}>
                {loading && menuItems.length === 0 ? (
                    <View style={styles.center}><ActivityIndicator size="large" color="#38bdf8" /></View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={displayData}
                        keyExtractor={(item, index) => item.id || `row-${index}`}
                        renderItem={({ item }) => {
                            if (item.type === 'header') return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{item.name}</Text><View style={styles.sectionLine} /></View>;
                            if (item.type === 'row') return <MenuRow items={item.data} categories={categories} onAdd={addToCart} numColumns={numColumns} />;
                            return <MobileItem item={item.data} categories={categories} onAdd={addToCart} />;
                        }}
                        ListHeaderComponent={renderHeader}
                        contentContainerStyle={[styles.gridContent, { paddingTop: 80 }, isMobile && { paddingBottom: 140 }]}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        windowSize={11}
                        maxToRenderPerBatch={10}
                        initialNumToRender={10}
                        removeClippedSubviews={false}
                        ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="fast-food-outline" size={48} color="#334155" /><Text style={styles.emptyText}>No items found</Text></View>}
                    />
                )}
            </View>

            {/* HOVER MORPHING SEARCH */}
            {renderStickySearch()}

            {/* BACK TO TOP FAB */}
            {showScrollTop && (
                <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.scrollTopFab}>
                    <TouchableOpacity onPress={scrollToTop} style={styles.fabIconBtn}>
                        <Ionicons name="chevron-up" size={24} color="#0f172a" />
                    </TouchableOpacity>
                </Animated.View>
            )}

            {cart.length > 0 && (
                <>
                    {isCartOpen && (
                        <Animated.View entering={SlideInDown.springify().damping(20)} exiting={FadeOut.duration(200)} style={[styles.miniCartContainer, isMobile && { bottom: 120, right: 20 }]}>
                            <View style={styles.miniCartHeader}><Text style={styles.miniCartTitle}>Current Order</Text><Pressable onPress={() => setIsCartOpen(false)}><Ionicons name="close-circle" size={24} color="#94a3b8" /></Pressable></View>
                            <FlatList data={cart} renderItem={({item}) => (
                                <View style={styles.miniCartItem}>
                                    <View style={{flex: 1}}><Text style={styles.miniItemName}>{item.name}</Text><Text style={styles.miniItemPrice}>PKR {(item.price * item.quantity).toFixed(0)}</Text></View>
                                    <View style={styles.qtyControls}>
                                        <TouchableOpacity onPress={() => updateQuantity(item.id, -1)} style={styles.qtyBtn}><Ionicons name="remove" size={12} color="white" /></TouchableOpacity>
                                        <Text style={styles.qtyText}>{item.quantity}</Text>
                                        <TouchableOpacity onPress={() => updateQuantity(item.id, 1)} style={styles.qtyBtn}><Ionicons name="add" size={12} color="white" /></TouchableOpacity>
                                    </View>
                                </View>
                            )} keyExtractor={i => i.id} style={styles.miniCartScroll} />
                            <View style={styles.miniCartFooter}>
                                <View style={styles.miniTotalRow}><Text style={styles.miniTotalLabel}>Total</Text><Text style={styles.miniTotalValue}>PKR {((cart.reduce((a,b)=>a+(b.price*b.quantity), 0))).toFixed(0)}</Text></View>
                                <Pressable style={styles.checkoutBtn} onPress={() => router.push('/checkout')}><Text style={styles.checkoutBtnText}>Checkout</Text><Ionicons name="arrow-forward" size={16} color="#0f172a" /></Pressable>
                            </View>
                        </Animated.View>
                    )}
                    <Pressable style={[styles.cartFab, isMobile ? { bottom: 110, right: 20 } : { bottom: 30, right: 30 }, isCartOpen && { opacity: 0 } ]} onPress={() => setIsCartOpen(true)}>
                        <View style={styles.fabBadge}><Text style={styles.fabBadgeText}>{cart.reduce((a,b)=>a+b.quantity, 0)}</Text></View>
                        <Ionicons name="cart" size={24} color="#0f172a" />
                    </Pressable>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: '#0f172a' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerSection: { padding: 24, paddingBottom: 10 },
    headerSectionMobile: { padding: 16, paddingBottom: 10 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    logoContainer: { flexDirection: 'row', alignItems: 'center' },
    logoIconContainer: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#334155' },
    logoImage: { width: 24, height: 24 },
    welcomeText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
    brandText: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },

    stickySearchContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 100,
        alignItems: 'center',
        pointerEvents: 'box-none' as any,
    },
    searchPill: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        borderWidth: 1,
        borderColor: '#334155',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
        overflow: 'hidden',
    },
    inputWrapper: {
        flex: 1,
    },
    searchInput: { flex: 1, color: '#f8fafc', fontSize: 16, height: '100%', outlineStyle: 'none' } as any,
    
    categoryContainer: { width: '100%', marginTop: 10 },
    categoryScroll: { gap: 10, paddingBottom: 10 },
    catPill: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
    catText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },

    sectionHeader: { width: '100%', paddingHorizontal: 16, marginTop: 40, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
    sectionTitle: { fontSize: 22, fontWeight: '900', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: 1.5 },
    sectionLine: { flex: 1, height: 1, backgroundColor: '#334155' },

    gridContent: { padding: 16, paddingBottom: 80 }, 
    gridRow: { flexDirection: 'row', width: '100%', justifyContent: 'flex-start' },
    cardContainer: { padding: 8 },
    card: { backgroundColor: '#1e293b', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#334155', height: '100%' },
    imageWrapper: { height: 160, width: '100%', position: 'relative', backgroundColor: '#0f172a' },
    cardImage: { width: '100%', height: '100%' },
    gradientOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: 'rgba(0,0,0,0.3)' },
    priceTag: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(15, 23, 42, 0.9)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#38bdf8' },
    priceText: { color: '#38bdf8', fontWeight: '700', fontSize: 12 },
    cardContent: { padding: 16, justifyContent: 'space-between', flex: 1, gap: 12 },
    cardTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
    cardCategory: { color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#38bdf8', paddingVertical: 10, borderRadius: 12, gap: 8, marginTop: 'auto' },
    addBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
    
    mobileItemContainer: { width: '100%', paddingHorizontal: 4, marginBottom: 12 },
    mobileCard: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 20, borderWidth: 1, borderColor: '#334155', overflow: 'hidden', height: 100 },
    mobileImage: { width: 100, height: '100%', backgroundColor: '#0f172a' },
    mobileContent: { flex: 1, padding: 12, justifyContent: 'space-between' },
    mobileInfo: { gap: 4 },
    mobileTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
    mobileCategory: { color: '#94a3b8', fontSize: 12, textTransform: 'uppercase' },
    mobileFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    mobilePrice: { color: '#38bdf8', fontSize: 15, fontWeight: '700' },
    mobileAddBtn: { backgroundColor: '#38bdf8', width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    
    // FABs
    scrollTopFab: { position: 'absolute', bottom: 40, right: 30, zIndex: 100 },
    fabIconBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#38bdf8', justifyContent: 'center', alignItems: 'center', shadowColor: "#38bdf8", shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },

    cartFab: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: '#38bdf8', justifyContent: 'center', alignItems: 'center', shadowColor: "#38bdf8", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8, zIndex: 50 },
    fabBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0f172a' },
    fabBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    
    miniCartContainer: { position: 'absolute', bottom: 90, right: 30, width: 320, maxHeight: 400, backgroundColor: '#1e293b', borderRadius: 24, borderWidth: 1, borderColor: '#334155', zIndex: 60, overflow: 'hidden', padding: 16 },
    miniCartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
    miniCartTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
    miniCartScroll: { maxHeight: 240 },
    miniCartItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    miniItemName: { color: '#cbd5e1', fontSize: 13, fontWeight: '500' },
    miniItemPrice: { color: '#94a3b8', fontSize: 11 },
    qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 8, padding: 2 },
    qtyBtn: { padding: 4, backgroundColor: '#334155', borderRadius: 6 },
    qtyText: { color: '#f8fafc', paddingHorizontal: 8, fontSize: 12, fontWeight: '700' },
    miniCartFooter: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' },
    miniTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    miniTotalLabel: { color: '#94a3b8' },
    miniTotalValue: { color: '#38bdf8', fontSize: 18, fontWeight: '800' },
    checkoutBtn: { backgroundColor: '#38bdf8', borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    checkoutBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
    emptyContainer: { width: '100%', alignItems: 'center', marginTop: 40 },
    emptyText: { color: '#94a3b8', marginTop: 12, fontSize: 16 },
});
