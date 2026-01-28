import { useLocalSearchParams, useRouter } from 'expo-router';
import { onValue, ref } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { database } from '../../services/firebase';

// --- Type Definitions ---
interface MenuItem {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    categoryId: string;
}

interface CartItem extends MenuItem {
    quantity: number;
}

interface Category {
    id: string;
    name: string;
}

interface MenuSection {
    title: string;
    data: MenuItem[];
}

// Web-specific scrollbar styles
const WebScrollbarStyles = () => {
    if (Platform.OS !== 'web') return null;
    return (
        <style type="text/css">
            {`
            ::-webkit-scrollbar {
                width: 10px;
                height: 10px;
            }
            ::-webkit-scrollbar-track {
                background: #0f172a; 
            }
            ::-webkit-scrollbar-thumb {
                background: #334155; 
                border-radius: 5px;
                border: 2px solid #0f172a;
            }
            ::-webkit-scrollbar-thumb:hover {
                background: #475569; 
            }
            /* Firefox */
            * {
                scrollbar-width: thin;
                scrollbar-color: #334155 #0f172a;
            }
            `}
        </style>
    );
};

export default function DashboardScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { userData } = useAuth();
    const [menuSections, setMenuSections] = useState<MenuSection[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    
    // Grid Logic
    let numColumns = 2;
    if (width > 600) numColumns = 3;
    if (width > 1100) numColumns = 4;
    if (width > 1500) numColumns = 5;

    const userName = userData?.username;

    useEffect(() => {
        const categoriesRef = ref(database, 'categories');
        const menuItemsRef = ref(database, 'menu_items');

        onValue(categoriesRef, (catSnapshot) => {
            const categories: Category[] = catSnapshot.exists() ? Object.keys(catSnapshot.val()).map(key => ({ id: key, ...catSnapshot.val()[key] })) : [];
            
            onValue(menuItemsRef, (menuSnapshot) => {
                const menuItems: MenuItem[] = menuSnapshot.exists() ? Object.keys(menuSnapshot.val()).map(key => ({ id: key, ...menuSnapshot.val()[key] })) : [];
                
                const sections = categories
                    .map(category => ({
                        title: category.name,
                        data: menuItems.filter(item => item.categoryId === category.id)
                    }))
                    .filter(section => section.data.length > 0);

                setMenuSections(sections);
                setLoading(false);
            }, () => setLoading(false));
        }, () => setLoading(false));
    }, []);

    useEffect(() => {
        if (params.clearCart === 'true') {
            setCart([]);
            router.setParams({ clearCart: '' });
        }
    }, [params.clearCart]);

    const addToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            return existing ? prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { ...item, quantity: 1 }];
        });
    };

    const updateCartQuantity = (itemId: string, change: number) => {
        setCart(current => {
            const item = current.find(i => i.id === itemId);
            if (item && item.quantity + change > 0) {
                return current.map(i => i.id === itemId ? { ...i, quantity: i.quantity + change } : i);
            }
            return current.filter(i => i.id !== itemId);
        });
    };

    const calculateTotal = () => cart.reduce((total, item) => total + item.price * item.quantity, 0);

    const proceedToCheckout = () => {
        if (cart.length === 0) {
            Alert.alert("Empty Cart", "Please add items to your order.");
            return;
        }
        
        router.push({
            pathname: '/checkout',
            params: { 
                cart: JSON.stringify(cart), 
                total: calculateTotal().toString() 
            }
        });
    };

    const renderFloatingCart = () => (
        <View style={styles.floatingCartWrapper}>
            <View style={styles.floatingCartContainer}>
                <View style={styles.cartHeaderContainer}>
                    <Text style={styles.cartTitle}>Order Summary</Text>
                    <View style={styles.cartBadge}>
                        <Text style={styles.cartBadgeText}>{cart.reduce((acc, item) => acc + item.quantity, 0)}</Text>
                    </View>
                </View>
                
                <FlatList
                    data={cart}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={true}
                    indicatorStyle="white"
                    style={{flex: 1}}
                    renderItem={({ item }) => (
                        <View style={styles.cartItem}>
                            <Image source={{ uri: item.imageUrl }} style={styles.cartItemImage} />
                            <View style={styles.cartItemDetails}>
                                <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.cartItemPrice}>PKR {item.price.toFixed(0)}</Text>
                            </View>
                            <View style={styles.quantityControl}>
                                <TouchableOpacity onPress={() => updateCartQuantity(item.id, -1)} style={styles.quantityButton}>
                                    <Text style={styles.quantityButtonText}>−</Text>
                                </TouchableOpacity>
                                <Text style={styles.quantityText}>{item.quantity}</Text>
                                <TouchableOpacity onPress={() => updateCartQuantity(item.id, 1)} style={styles.quantityButton}>
                                    <Text style={styles.quantityButtonText}>+</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyCartContainer}>
                            <Text style={styles.emptyCartEmoji}>🛒</Text>
                            <Text style={styles.emptyCartText}>Cart is empty</Text>
                        </View>
                    }
                />
                
                {cart.length > 0 && (
                    <View style={styles.footer}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Total</Text>
                            <Text style={styles.totalAmount}>PKR {calculateTotal().toFixed(0)}</Text>
                        </View>
                        <TouchableOpacity 
                            style={styles.placeOrderButton} 
                            onPress={proceedToCheckout} 
                            activeOpacity={0.8}
                        >
                            <Text style={styles.placeOrderButtonText}>Checkout</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );

    function RenderMenuItem({ item }: { item: MenuItem }) {
        return (
            <View style={[styles.itemCardContainer, { width: `${100 / numColumns}%` }]}>
                <View style={styles.itemCard}>
                    <View style={styles.imageContainer}>
                        <Image source={{ uri: item.imageUrl || 'https://via.placeholder.com/200' }} style={styles.itemImage} />
                        <View style={styles.gradientOverlay} />
                        <TouchableOpacity style={styles.addButton} onPress={() => addToCart(item)} activeOpacity={0.8}>
                            <Text style={styles.addButtonIcon}>+</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.itemContent}>
                        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                        <View style={styles.priceTag}>
                            <Text style={styles.itemPrice}>PKR {item.price.toFixed(0)}</Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    }
    
    return (
        <View style={styles.container}>
            <WebScrollbarStyles />
            <View style={styles.header}>
                <View style={styles.logoContainer}>
                    <View style={styles.logoIconContainer}>
                            <Image source={require('../../assets/images/ic.png')} style={styles.logoImage} />
                    </View>
                    <Text style={styles.logoText}>Infinity Crafters</Text>
                </View>
                <View style={styles.userProfilePill}>
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>{userName ? userName.charAt(0).toUpperCase() : 'U'}</Text>
                    </View>
                    <Text style={styles.userNameText}>{userName || 'Guest'}</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#38bdf8" />
                    <Text style={styles.loadingText}>Loading Menu...</Text>
                </View>
            ) : (
                <View style={styles.mainContent}>
                    <ScrollView 
                        style={styles.menuContainer} 
                        contentContainerStyle={styles.menuContentContainer}
                        showsVerticalScrollIndicator={true}
                        indicatorStyle="white"
                    >
                        <View style={styles.heroSection}>
                            <Text style={styles.heroTitle}>Delicious Food,</Text>
                            <Text style={styles.heroSubtitle}>Delivered To You.</Text>
                        </View>
                        
                        {menuSections.map(section => (
                            <View key={section.title} style={styles.sectionContainer}>
                                <Text style={styles.sectionHeader}>{section.title}</Text>
                                <View style={styles.gridContainer}>
                                    {section.data.map(item => (
                                        <RenderMenuItem key={item.id} item={item} />
                                    ))}
                                </View>
                            </View>
                        ))}
                        <View style={styles.bottomSpacer} />
                    </ScrollView>
                    
                    {/* Floating Cart for Web */}
                    {isWeb && renderFloatingCart()}
                </View>
            )}
            
            {/* Mobile FAB */}
            {!isWeb && cart.length > 0 && (
                <View style={styles.fabContainer}>
                    <TouchableOpacity style={styles.mobileCartFab} onPress={proceedToCheckout} activeOpacity={0.9}>
                        <View style={styles.fabCountBadge}>
                            <Text style={styles.fabCountText}>{cart.reduce((a, b) => a + b.quantity, 0)}</Text>
                        </View>
                        <Text style={styles.mobileCartText}>View Cart</Text>
                        <Text style={styles.mobileCartTotal}>PKR {calculateTotal().toFixed(0)}</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 16, color: '#94a3b8', fontSize: 16 },
    
    // Header
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 24, 
        paddingVertical: 16, 
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        zIndex: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    logoContainer: { flexDirection: 'row', alignItems: 'center' },
    logoIconContainer: {
        width: 40, height: 40, borderRadius: 12, backgroundColor: '#1e293b',
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
        borderWidth: 1, borderColor: '#334155'
    },
    logoImage: { width: 24, height: 24, resizeMode: 'contain' },
    logoText: { fontSize: 20, fontWeight: '700', color: '#f8fafc', letterSpacing: 0.5 },
    pageHeaderTitle: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
    userProfilePill: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b',
        paddingVertical: 6, paddingHorizontal: 12, borderRadius: 30,
        borderWidth: 1, borderColor: '#334155'
    },
    avatarPlaceholder: {
        width: 28, height: 28, borderRadius: 14, backgroundColor: '#38bdf8',
        justifyContent: 'center', alignItems: 'center', marginRight: 10
    },
    avatarText: { color: '#0f172a', fontWeight: 'bold', fontSize: 14 },
    userNameText: { fontSize: 14, fontWeight: '600', color: '#e2e8f0' },

    // Main Layout
    mainContent: { flex: 1, flexDirection: 'row', position: 'relative' },
    menuContainer: { flex: 1 },
    menuContentContainer: { paddingBottom: 100, paddingRight: Platform.OS === 'web' ? 400 : 0 }, // Add padding for floating cart
    
    // Hero
    heroSection: { paddingHorizontal: 32, paddingVertical: 40 },
    heroTitle: { fontSize: 32, fontWeight: '800', color: '#f8fafc', lineHeight: 40 },
    heroSubtitle: { fontSize: 32, fontWeight: '800', color: '#38bdf8', lineHeight: 40 },

    // Sections
    sectionContainer: { marginBottom: 32, paddingHorizontal: 24 },
    sectionHeader: { fontSize: 22, fontWeight: '700', color: '#f1f5f9', marginBottom: 16, paddingLeft: 8 },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap' },

    // Item Card
    itemCardContainer: { padding: 8 },
    itemCard: {
        backgroundColor: '#1e293b',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#334155',
        height: '100%',
        ...Platform.select({
            web: { 
                transition: 'transform 0.2s',
                cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
            },
            default: { elevation: 4 }
        }),
    },
    imageContainer: { height: 160, backgroundColor: '#0f172a', position: 'relative' },
    itemImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    gradientOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: 'rgba(0,0,0,0.2)' },
    addButton: {
        position: 'absolute', bottom: 12, right: 12,
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#38bdf8',
        justifyContent: 'center', alignItems: 'center',
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8,
    },
    addButtonIcon: { fontSize: 24, color: '#0f172a', fontWeight: '600', marginTop: -2 },
    itemContent: { padding: 16, justifyContent: 'space-between', flex: 1 },
    itemName: { fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 8, lineHeight: 22 },
    priceTag: { alignSelf: 'flex-start', backgroundColor: 'rgba(56, 189, 248, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    itemPrice: { fontSize: 14, fontWeight: '700', color: '#38bdf8' },

    // Floating Cart (Web)
    floatingCartWrapper: {
        position: 'absolute',
        top: 24,
        right: 24,
        bottom: 24,
        width: 380,
        pointerEvents: 'box-none', // Allow clicking through if we wanted, but here we want to capture clicks
    },
    floatingCartContainer: {
        flex: 1,
        backgroundColor: '#1e293b',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#38bdf8', // Highlight border
        shadowColor: "#38bdf8",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    cartHeaderContainer: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(30, 41, 59, 0.98)'
    },
    cartTitle: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },
    cartBadge: { backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    cartBadgeText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
    
    cartItem: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
    cartItemImage: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#0f172a' },
    cartItemDetails: { flex: 1, marginLeft: 12, justifyContent: 'center' },
    cartItemName: { fontSize: 14, fontWeight: '600', color: '#f1f5f9', marginBottom: 4 },
    cartItemPrice: { fontSize: 13, color: '#94a3b8' },
    
    quantityControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 10, padding: 2 },
    quantityButton: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#1e293b' },
    quantityButtonText: { color: '#f8fafc', fontSize: 16, fontWeight: '600', marginTop: -2 },
    quantityText: { width: 20, textAlign: 'center', color: '#f1f5f9', fontWeight: '600', fontSize: 13 },
    
    emptyCartContainer: { padding: 40, alignItems: 'center', justifyContent: 'center', opacity: 0.6, flex: 1 },
    emptyCartEmoji: { fontSize: 40, marginBottom: 12 },
    emptyCartText: { color: '#f1f5f9', fontSize: 16, fontWeight: '600' },

    footer: { 
        padding: 20, 
        backgroundColor: '#1e293b',
        borderTopWidth: 1, 
        borderTopColor: '#334155'
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 },
    totalLabel: { fontSize: 16, color: '#94a3b8' },
    totalAmount: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
    
    placeOrderButton: { 
        backgroundColor: '#38bdf8', 
        paddingVertical: 14, 
        borderRadius: 16, 
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        shadowColor: "#38bdf8", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6
    },
    placeOrderButtonText: { color: '#0f172a', fontWeight: '800', fontSize: 16 },
    disabledButton: { backgroundColor: '#334155', opacity: 0.5 },
    
    // Mobile Floating Cart
    fabContainer: { position: 'absolute', bottom: 24, left: 24, right: 24, alignItems: 'center' },
    mobileCartFab: {
        backgroundColor: '#38bdf8',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 30,
        width: '100%',
        maxWidth: 500,
        justifyContent: 'space-between',
        shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },
    fabCountBadge: { backgroundColor: '#0f172a', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    fabCountText: { color: '#38bdf8', fontWeight: 'bold' },
    mobileCartText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
    mobileCartTotal: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
    
    bottomSpacer: { height: 100 }
});
