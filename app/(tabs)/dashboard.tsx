import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, onValue, push, ref as dbRef, runTransaction, set, update } from 'firebase/database';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
    Modal
} from 'react-native';
import Animated, {
    Extrapolation,
    FadeIn,
    FadeInDown,
    FadeOut,
    SlideInDown,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { database } from '../../services/firebase';

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
const LOGO_SOURCE = require('../../assets/images/ic.png');

// Web Scrollbar
const WebScrollbarStyles = () => {
    if (Platform.OS !== 'web') return null;
    return (
        <style type="text/css">
            {`
            ::-webkit-scrollbar { width: 8px; height: 8px; }
            ::-webkit-scrollbar-track { background: #0f172a; }
            ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
            ::-webkit-scrollbar-thumb:hover { background: #475569; }
            .category-scroll::-webkit-scrollbar { height: 4px; }
            .category-scroll::-webkit-scrollbar-thumb { background: #38bdf8; }
            `}
        </style>
    );
};

// --- Components ---
const MobileItem = memo(({ item, categories, onAdd, index }: any) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(400)} style={styles.mobileItemContainer}>
        <View style={styles.mobileCard}>
            <Image source={item.imageUrl} style={styles.mobileImage} contentFit="cover" transition={300} cachePolicy="disk" />
            <View style={styles.mobileContent}>
                <View style={styles.mobileInfo}>
                    <Text style={styles.mobileTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.mobileCategory}>{categories.find((c: any) => c.id === item.categoryId)?.name || 'General'}</Text>
                </View>
                <View style={styles.mobileFooter}>
                    <Text style={styles.mobilePrice}>PKR {item.price.toFixed(0)}</Text>
                    <Pressable style={({pressed}) => [styles.mobileAddBtn, pressed && { opacity: 0.8, transform: [{scale: 0.95}] }]} onPress={() => onAdd(item)}>
                        <Ionicons name="add" size={20} color="#0f172a" />
                    </Pressable>
                </View>
            </View>
        </View>
    </Animated.View>
));

const MenuRow = memo(({ items, categories, onAdd, numColumns, rowIndex }: any) => {
    const itemWidth = `${100 / numColumns}%`;
    return (
        <View style={styles.gridRow}>
            {items.map((item: any, colIndex: number) => (
                <Animated.View key={item.id} entering={FadeInDown.delay((rowIndex * 50) + (colIndex * 30)).duration(400)} style={[styles.cardContainer, { width: itemWidth }]}>
                    <View style={styles.card}>
                        <View style={styles.imageWrapper}>
                            <Image source={item.imageUrl} style={styles.cardImage} contentFit="cover" transition={300} cachePolicy="disk" />
                            <View style={styles.gradientOverlay} />
                            <View style={styles.priceTag}><Text style={styles.priceText}>PKR {item.price.toFixed(0)}</Text></View>
                        </View>
                        <View style={styles.cardContent}>
                            <View>
                                <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.cardCategory}>{categories.find((c: any) => c.id === item.categoryId)?.name || 'General'}</Text>
                            </View>
                            <Pressable style={({pressed}) => [styles.addBtn, pressed && { opacity: 0.8, transform: [{scale: 0.96}] }]} onPress={() => onAdd(item)}>
                                <Text style={styles.addBtnText}>Add</Text>
                                <Ionicons name="add-circle" size={20} color="#0f172a" />
                            </Pressable>
                        </View>
                    </View>
                </Animated.View>
            ))}
        </View>
    );
});

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
    const [isSending, setIsSending] = useState(false);
    
    // --- Edit Mode ---
    const isEditMode = params.mode === 'edit';
    const [existingOrder, setExistingOrder] = useState<any>(null);

    // --- Modal State ---
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [orderType, setOrderType] = useState<'Dine-in' | 'Take Away'>('Dine-in');
    const [customerName, setCustomerName] = useState('');

    // --- Animation States ---
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isSearchHovered, setIsSearchHovered] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);

    const expansionProgress = useSharedValue(1);
    const isMobile = width < 768;
    const numColumns = isMobile ? 1 : width >= 1400 ? 4 : 3; 

    // 1. Fetch Data
    useEffect(() => {
        const categoriesRef = dbRef(database, 'categories');
        const menuItemsRef = dbRef(database, 'menu_items');
        
        const unsubCat = onValue(categoriesRef, (catSnap) => {
            const freshCats = catSnap.exists() ? Object.keys(catSnap.val()).map(k => ({ id: k, ...catSnap.val()[k] })) : [];
            setCategories(freshCats);
            const unsubMenu = onValue(menuItemsRef, (menuSnap) => {
                const freshItems = menuSnap.exists() ? Object.keys(menuSnap.val()).map(k => ({ id: k, ...menuSnap.val()[k] })) : [];
                setMenuItems(freshItems);
                setLoading(false);
            });
            return unsubMenu;
        });
        return unsubCat;
    }, []);

    // 2. Edit Mode Fetch
    useEffect(() => {
        if (isEditMode && params.orderId) {
            const orderRef = dbRef(database, `ongoing_orders/${params.orderId}`);
            get(orderRef).then((snapshot) => {
                if (snapshot.exists()) {
                    setExistingOrder(snapshot.val());
                    setIsCartOpen(true);
                } else {
                    Alert.alert("Error", "Order not found");
                    router.back();
                }
            });
        }
    }, [isEditMode, params.orderId]);

    // 3. Animation Logic
    useEffect(() => {
        const shouldExpand = !isScrolled || isSearchHovered || isSearchFocused;
        expansionProgress.value = withSpring(shouldExpand ? 1 : 0, { damping: 15, stiffness: 120 });
    }, [isScrolled, isSearchHovered, isSearchFocused]);

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
                    items.forEach((item, idx) => rows.push({ type: 'item', data: item, index: idx }));
                } else {
                    for (let i = 0; i < items.length; i += numColumns) {
                        rows.push({ type: 'row', data: items.slice(i, i + numColumns), index: i });
                    }
                }
            }
        });
        return { displayData: rows, jumpOffsets: offsets };
    }, [menuItems, categories, searchQuery, isMobile, numColumns]);

    const scrollToCategory = (catId: string) => { const index = jumpOffsets[catId]; if (index !== undefined) flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 }); };
    const scrollToTop = () => { flatListRef.current?.scrollToOffset({ offset: 0, animated: true }); };
    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => { const offsetY = event.nativeEvent.contentOffset.y; setShowScrollTop(offsetY > 400); setIsScrolled(offsetY > 80); };

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

    // --- Order Logic ---
    const initiateOrder = () => { isEditMode ? handleUpdateOrder() : setShowConfirmModal(true); };

    const handleUpdateOrder = async () => {
        if (!existingOrder) return;
        setIsSending(true);
        try {
            const newItemsTagged = cart.map((item: any) => ({ ...item, isAddedLater: true, status: 'pending' }));
            const updatedItems = [...(existingOrder.items || []), ...newItemsTagged];
            const additionalTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const newTotal = (existingOrder.total || 0) + additionalTotal;

            await update(dbRef(database, `ongoing_orders/${existingOrder.id}`), { items: updatedItems, total: newTotal });
            clearCart();
            setIsCartOpen(false);
            router.replace('/(tabs)/ongoing-orders');
        } catch (e: any) { Alert.alert("Update Failed", e.message); } finally { setIsSending(false); }
    };

    const confirmSendToKitchen = async () => {
        setIsSending(true);
        try {
            const orderCounterRef = dbRef(database, 'counters/orders');
            const transactionResult = await runTransaction(orderCounterRef, (currentCount) => (currentCount || 100) + 1);
            const newOrderNumber = transactionResult.snapshot.val();

            const itemsWithStatus = cart.map((item: any) => ({ ...item, status: 'pending', isKitchenItem: true }));
            const newOrderRef = push(dbRef(database, 'ongoing_orders'));
            const orderData = {
                id: newOrderRef.key!,
                orderNumber: String(newOrderNumber),
                date: Date.now(),
                items: itemsWithStatus,
                total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
                customerName: customerName || (orderType === 'Take Away' ? 'Walk-in' : 'Guest'),
                orderType,
                paymentMethod: 'Pending',
                staffName: userData?.username || 'Staff',
                status: 'active'
            };

            await set(newOrderRef, orderData);
            setIsSending(false);
            setShowConfirmModal(false);
            setCustomerName('');
            setIsCartOpen(false);
            clearCart();
            router.push('/(tabs)/ongoing-orders');
        } catch (error: any) { setIsSending(false); Alert.alert("Error", error.message); }
    };

    // --- FIXED SEARCH STYLES & ANIMATION ---
    const animatedPillStyle = useAnimatedStyle(() => {
        const fullWidth = Math.min(width * 0.9, 600);
        const iconWidth = 56; // Fixed icon width
        return {
            width: interpolate(expansionProgress.value, [0, 1], [iconWidth, fullWidth], Extrapolation.CLAMP),
            borderRadius: interpolate(expansionProgress.value, [0, 1], [28, 16], Extrapolation.CLAMP),
            // NO paddingHorizontal animation. We rely on fixed layout structure.
            borderColor: isSearchFocused ? '#38bdf8' : '#334155',
            backgroundColor: '#1e293b',
            boxShadow: isSearchFocused ? '0 0 25px rgba(56, 189, 248, 0.2)' : '0 10px 20px rgba(0,0,0,0.4)',
        } as any;
    });

    const animatedInputStyle = useAnimatedStyle(() => ({
        opacity: interpolate(expansionProgress.value, [0, 0.5, 1], [0, 0, 1]),
    }));

    const renderStickySearch = () => (
        <View 
            style={[styles.stickySearchContainer, { top: isMobile ? insets.top + 10 : 24 }]}
            onMouseEnter={() => Platform.OS === 'web' && setIsSearchHovered(true)} 
            onMouseLeave={() => Platform.OS === 'web' && setIsSearchHovered(false)}
        >
            <Animated.View style={[styles.searchPill, animatedPillStyle]}>
                {/* 1. Fixed Icon Container */}
                <Pressable onPress={() => searchInputRef.current?.focus()} style={styles.searchIconArea}>
                    <Ionicons 
                        name="search" 
                        size={24} 
                        color={isSearchFocused || expansionProgress.value < 0.5 ? "#38bdf8" : "#64748b"} 
                    />
                </Pressable>
                
                {/* 2. Fluid Input Container */}
                <Animated.View style={[styles.inputWrapper, animatedInputStyle]}>
                    <TextInput 
                        ref={searchInputRef}
                        placeholder="Search menu..." 
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

    const renderHeader = () => (
        <View style={[styles.headerSection, isMobile && styles.headerSectionMobile]}>
            <View style={styles.titleRow}>
                <View style={styles.logoContainer}>
                     <View style={styles.logoIconContainer}><Image source={LOGO_SOURCE} style={styles.logoImage} contentFit="contain" cachePolicy="memory-disk" /></View>
                    <View><Text style={styles.welcomeText}>Welcome back,</Text><Text style={styles.brandText}>{userData?.username || 'Guest'}</Text></View>
                </View>
            </View>
            <View style={styles.categoryContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'} contentContainerStyle={styles.categoryScroll} className="category-scroll">
                    {categories.filter(c => jumpOffsets[c.id] !== undefined).map((cat) => (
                        <Pressable key={cat.id} onPress={() => scrollToCategory(cat.id)} style={({pressed}) => [styles.catPill, pressed && { opacity: 0.7 }]}><Text style={styles.catText}>{cat.name}</Text></Pressable>
                    ))}
                </ScrollView>
            </View>
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
                            if (item.type === 'row') return <MenuRow items={item.data} categories={categories} onAdd={addToCart} numColumns={numColumns} rowIndex={item.index} />;
                            return <MobileItem item={item.data} categories={categories} onAdd={addToCart} index={item.index} />;
                        }}
                        ListHeaderComponent={renderHeader}
                        contentContainerStyle={[styles.gridContent, { paddingTop: 80 }, isMobile && { paddingBottom: 140 }]}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                    />
                )}
            </View>

            {renderStickySearch()}

            {showScrollTop && (
                <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.scrollTopFab}>
                    <TouchableOpacity onPress={scrollToTop} style={styles.fabIconBtn}><Ionicons name="chevron-up" size={24} color="#0f172a" /></TouchableOpacity>
                </Animated.View>
            )}

            {(cart.length > 0 || (isEditMode && existingOrder)) && (
                <>
                    {isCartOpen && (
                        <Animated.View entering={SlideInDown.springify().damping(20)} exiting={FadeOut.duration(200)} style={[styles.miniCartContainer, isMobile && { bottom: 100, right: 20, width: width - 40 }]}>
                            <View style={styles.miniCartHeader}>
                                <View>
                                    <Text style={styles.miniCartTitle}>{isEditMode ? 'Edit Order' : 'Current Order'}</Text>
                                    {isEditMode && existingOrder && <Text style={styles.orderIdBadge}>#{existingOrder.orderNumber}</Text>}
                                </View>
                                <Pressable onPress={() => { setIsCartOpen(false); if(isEditMode && cart.length === 0) router.back(); }}><Ionicons name="close-circle" size={24} color="#94a3b8" /></Pressable>
                            </View>
                            
                            <ScrollView style={styles.miniCartScroll}>
                                {/* LOCKED ITEMS */}
                                {isEditMode && existingOrder && (
                                    <View style={styles.lockedSection}>
                                        <Text style={styles.lockedHeader}>PREVIOUSLY ORDERED</Text>
                                        {existingOrder.items.map((item: any, idx: number) => (
                                            <View key={`prev-${idx}`} style={styles.lockedItem}>
                                                <View style={styles.lockedQtyBadge}><Text style={styles.lockedQtyText}>{item.quantity}</Text></View>
                                                <Text style={styles.lockedName} numberOfLines={1}>{item.name}</Text>
                                                <Text style={styles.lockedPrice}>{(item.price * item.quantity).toFixed(0)}</Text>
                                            </View>
                                        ))}
                                        <View style={styles.lockedDivider} />
                                    </View>
                                )}
                                {/* ACTIVE ITEMS */}
                                {cart.map((item) => (
                                    <View key={item.id} style={styles.miniCartItem}>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.miniItemName}>{item.name}</Text>
                                            <Text style={styles.miniItemPrice}>PKR {(item.price * item.quantity).toFixed(0)}</Text>
                                        </View>
                                        <View style={styles.qtyControls}>
                                            <TouchableOpacity onPress={() => updateQuantity(item.id, -1)} style={styles.qtyBtn}><Ionicons name="remove" size={12} color="white" /></TouchableOpacity>
                                            <Text style={styles.qtyText}>{item.quantity}</Text>
                                            <TouchableOpacity onPress={() => updateQuantity(item.id, 1)} style={styles.qtyBtn}><Ionicons name="add" size={12} color="white" /></TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>

                            <View style={styles.miniCartFooter}>
                                <View style={styles.miniTotalRow}>
                                    <Text style={styles.miniTotalLabel}>{isEditMode ? 'Added Total' : 'Total'}</Text>
                                    <Text style={styles.miniTotalValue}>PKR {cart.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(0)}</Text>
                                </View>
                                <Pressable style={[styles.checkoutBtn, cart.length === 0 && {opacity: 0.5}]} onPress={initiateOrder} disabled={cart.length === 0}>
                                    {isSending ? <ActivityIndicator color="#0f172a" /> : (
                                        <><Text style={styles.checkoutBtnText}>{isEditMode ? 'Add to Order' : 'Send to Kitchen'}</Text><Ionicons name="arrow-forward" size={16} color="#0f172a" /></>
                                    )}
                                </Pressable>
                            </View>
                        </Animated.View>
                    )}
                    <Animated.View entering={FadeIn.duration(300)}>
                        <Pressable style={[styles.cartFab, isMobile ? { bottom: 100, right: 20 } : { bottom: 30, right: 30 }, isCartOpen && { opacity: 0 } ]} onPress={() => setIsCartOpen(true)}>
                            <View style={styles.fabBadge}><Text style={styles.fabBadgeText}>{cart.reduce((a,b)=>a+b.quantity, 0)}</Text></View>
                            <Ionicons name="cart" size={24} color="#0f172a" />
                        </Pressable>
                    </Animated.View>
                </>
            )}

            <Modal visible={showConfirmModal} transparent animationType="fade" onRequestClose={() => setShowConfirmModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.confirmModal}>
                        <Text style={styles.modalTitle}>Order Details</Text>
                        <View style={styles.typeSelector}>
                            <Pressable onPress={() => setOrderType('Dine-in')} style={[styles.typeOption, orderType==='Dine-in' && styles.typeOptionActive]}>
                                <Ionicons name="restaurant" size={20} color={orderType==='Dine-in' ? '#0f172a' : '#94a3b8'} />
                                <Text style={[styles.typeText, orderType==='Dine-in' && styles.typeTextActive]}>Dine-in</Text>
                            </Pressable>
                            <Pressable onPress={() => setOrderType('Take Away')} style={[styles.typeOption, orderType==='Take Away' && styles.typeOptionActive]}>
                                <Ionicons name="bag-handle" size={20} color={orderType==='Take Away' ? '#0f172a' : '#94a3b8'} />
                                <Text style={[styles.typeText, orderType==='Take Away' && styles.typeTextActive]}>Take Away</Text>
                            </Pressable>
                        </View>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="person" size={20} color="#64748b" style={{marginRight: 10}} />
                            <TextInput style={styles.modalInput} placeholder="Customer Name (Optional)" placeholderTextColor="#64748b" value={customerName} onChangeText={setCustomerName} />
                        </View>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowConfirmModal(false)}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.modalConfirm} onPress={confirmSendToKitchen} disabled={isSending}>
                                {isSending ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.modalConfirmText}>Confirm & Send</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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

    // Fixed Search Pill (Perfectly Centered & Aligned)
    stickySearchContainer: { position: 'absolute', left: 0, right: 0, zIndex: 100, alignItems: 'center', pointerEvents: 'box-none' as any },
    searchPill: { flexDirection: 'row', alignItems: 'center', height: 56, borderWidth: 1, borderColor: '#334155', shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10, overflow: 'hidden', backgroundColor: '#1e293b' },
    searchIconArea: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }, // Fixed width for icon ensures perfect center when collapsed
    inputWrapper: { flex: 1, height: '100%', justifyContent: 'center', paddingRight: 16 },
    searchInput: { flex: 1, color: '#f8fafc', fontSize: 16, height: '100%', paddingVertical: 0, ...Platform.select({ web: { outlineStyle: 'none' } }) },
    
    categoryContainer: { width: '100%', marginTop: 10 },
    categoryScroll: { gap: 10, paddingBottom: 10 },
    catPill: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
    catText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },

    gridContent: { padding: 16, paddingBottom: 80 }, 
    sectionHeader: { width: '100%', paddingHorizontal: 8, marginTop: 32, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
    sectionTitle: { fontSize: 20, fontWeight: '900', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: 1.2 },
    sectionLine: { flex: 1, height: 1, backgroundColor: '#334155' },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#64748b', marginTop: 10, fontSize: 16 },
    gridRow: { flexDirection: 'row', width: '100%', justifyContent: 'flex-start' },
    cardContainer: { padding: 8 },
    card: { backgroundColor: '#1e293b', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#334155', height: '100%', ...Platform.select({ web: { boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }, default: { elevation: 4 } }) },
    imageWrapper: { height: 160, width: '100%', position: 'relative', backgroundColor: '#0f172a' },
    cardImage: { width: '100%', height: '100%' },
    gradientOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: 'rgba(0,0,0,0.3)' },
    priceTag: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(15, 23, 42, 0.8)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backdropFilter: 'blur(4px)' },
    priceText: { color: '#38bdf8', fontWeight: '700', fontSize: 13 },
    cardContent: { padding: 16, justifyContent: 'space-between', flex: 1, gap: 12 },
    cardTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 16, marginBottom: 4 },
    cardCategory: { color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#38bdf8', borderRadius: 12, paddingVertical: 8, marginTop: 4 },
    addBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 14 },

    mobileItemContainer: { padding: 8, width: '100%' },
    mobileCard: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#334155', height: 100 },
    mobileImage: { width: 100, height: '100%' },
    mobileContent: { flex: 1, padding: 12, justifyContent: 'space-between' },
    mobileInfo: { gap: 4 },
    mobileTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 16 },
    mobileCategory: { color: '#64748b', fontSize: 12 },
    mobileFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    mobilePrice: { color: '#38bdf8', fontWeight: '700', fontSize: 15 },
    mobileAddBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#38bdf8', alignItems: 'center', justifyContent: 'center' },

    // FAB & Cart (Back to Top Moved Left)
    scrollTopFab: { position: 'absolute', bottom: 30, left: 30, zIndex: 90 },
    fabIconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#38bdf8', alignItems: 'center', justifyContent: 'center', shadowColor: "#38bdf8", shadowOpacity: 0.4, elevation: 6 },
    
    miniCartContainer: { position: 'absolute', bottom: 100, right: 30, width: 340, maxHeight: 450, backgroundColor: '#1e293b', borderRadius: 24, borderWidth: 1, borderColor: '#38bdf8', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
    miniCartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#334155', backgroundColor: '#1e293b' },
    miniCartTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 16 },
    orderIdBadge: { color: '#38bdf8', fontSize: 13, fontWeight: '700' },
    miniCartScroll: { maxHeight: 280 },
    miniCartItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#334155' },
    miniItemName: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
    miniItemPrice: { color: '#64748b', fontSize: 12 },
    qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0f172a', borderRadius: 8, padding: 4 },
    qtyBtn: { width: 20, height: 20, borderRadius: 6, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
    qtyText: { color: '#f8fafc', fontWeight: '700', fontSize: 12, width: 16, textAlign: 'center' },
    miniCartFooter: { padding: 16, backgroundColor: '#1e293b', borderTopWidth: 1, borderColor: '#334155' },
    miniTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    miniTotalLabel: { color: '#94a3b8' },
    miniTotalValue: { color: '#f8fafc', fontWeight: '700', fontSize: 16 },
    checkoutBtn: { backgroundColor: '#38bdf8', borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    checkoutBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
    cartFab: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: '#38bdf8', alignItems: 'center', justifyContent: 'center', shadowColor: "#38bdf8", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8, zIndex: 50 },
    fabBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0f172a' },
    fabBadgeText: { color: 'white', fontSize: 10, fontWeight: '700' },

    lockedSection: { backgroundColor: 'rgba(15, 23, 42, 0.5)', marginBottom: 8 },
    lockedHeader: { fontSize: 10, color: '#64748b', fontWeight: '800', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4, letterSpacing: 1 },
    lockedItem: { flexDirection: 'row', alignItems: 'center', padding: 10, opacity: 0.6 },
    lockedQtyBadge: { backgroundColor: '#334155', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    lockedQtyText: { color: '#cbd5e1', fontSize: 10, fontWeight: '700' },
    lockedName: { flex: 1, color: '#94a3b8', fontSize: 13, fontWeight: '500' },
    lockedPrice: { color: '#64748b', fontSize: 12, fontWeight: '600' },
    lockedDivider: { height: 1, backgroundColor: '#334155', marginHorizontal: 12, marginTop: 4, marginBottom: 8, borderStyle: 'dashed', borderWidth: 1 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    confirmModal: { width: '100%', maxWidth: 400, backgroundColor: '#1e293b', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#334155' },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 20, textAlign: 'center' },
    typeSelector: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    typeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', gap: 8 },
    typeOptionActive: { backgroundColor: '#38bdf8', borderColor: '#38bdf8' },
    typeText: { color: '#94a3b8', fontWeight: '600' },
    typeTextActive: { color: '#0f172a' },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 16, marginBottom: 24 },
    modalInput: { flex: 1, color: '#f8fafc', paddingVertical: 14, fontSize: 16 },
    modalActions: { flexDirection: 'row', gap: 12 },
    modalCancel: { flex: 1, padding: 14, alignItems: 'center', backgroundColor: '#334155', borderRadius: 12 },
    modalCancelText: { color: '#f8fafc', fontWeight: '700' },
    modalConfirm: { flex: 2, padding: 14, alignItems: 'center', backgroundColor: '#38bdf8', borderRadius: 12 },
    modalConfirmText: { color: '#0f172a', fontWeight: '700' },
});