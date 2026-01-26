import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    StyleSheet, Text, TouchableOpacity, View, Alert,
    Platform, Image, ScrollView, ActivityIndicator, FlatList
} from 'react-native';
import { database } from '../../lib/firebaseConfig';
import { ref, onValue } from 'firebase/database';
import { useAuth } from '../../context/AuthContext';

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

export default function DashboardScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { userData } = useAuth();
    const [menuSections, setMenuSections] = useState<MenuSection[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

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

    const isWeb = Platform.OS === 'web';

    const renderCart = () => (
        <View style={styles.cartContainer}>
            <Text style={styles.cartTitle}>Your Order</Text>
            <FlatList
                data={cart}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <View style={styles.cartItem}>
                        <Image source={{ uri: item.imageUrl }} style={styles.cartItemImage} />
                        <View style={styles.cartItemDetails}>
                            <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.cartItemPrice}>PKR {item.price.toFixed(2)}</Text>
                        </View>
                        <View style={styles.quantityControl}>
                            <TouchableOpacity onPress={() => updateCartQuantity(item.id, -1)} style={styles.quantityButton}><Text style={styles.quantityButtonText}>-</Text></TouchableOpacity>
                            <Text style={styles.quantityText}>{item.quantity}</Text>
                            <TouchableOpacity onPress={() => updateCartQuantity(item.id, 1)} style={styles.quantityButton}><Text style={styles.quantityButtonText}>+</Text></TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyCartText}>Your cart is empty.</Text>}
            />
            <View style={styles.footer}>
                <View style={styles.totalContainer}>
                    <Text style={styles.totalText}>Total</Text>
                    <Text style={styles.totalAmount}>PKR {calculateTotal().toFixed(2)}</Text>
                </View>
                <TouchableOpacity style={[styles.placeOrderButton, cart.length === 0 && styles.disabledButton]} onPress={proceedToCheckout} disabled={cart.length === 0}>
                    <Text style={styles.placeOrderButtonText}>Place Order</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    function RenderMenuItem({ item }: { item: MenuItem }) {
        return (
            <View style={styles.itemCardContainer}>
                <View style={styles.itemCard}>
                    <Image source={{ uri: item.imageUrl || 'https://via.placeholder.com/200' }} style={styles.itemImage} />
                    <TouchableOpacity style={styles.addToCartButton} onPress={() => addToCart(item)}>
                        <Text style={{color: '#fff', fontSize: 18}}>+</Text>
                    </TouchableOpacity>
                    <View style={styles.itemDetails}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.itemPrice}>PKR {item.price.toFixed(2)}</Text>
                    </View>
                </View>
            </View>
        );
    }
    
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.logoContainer}>
                    <View style={styles.logoPlaceholder} />
                    <Text style={styles.logo}>Zylina Studio</Text>
                </View>
                <View style={styles.userActions}>
                    <Text style={styles.userNameText}>Welcome, {userName}</Text>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#E53E3E" style={{ flex: 1 }} />
            ) : (
                <View style={styles.mainContent}>
                    <ScrollView style={styles.menuContainer}>
                        <View style={styles.heroSection}>
                            <Text style={styles.pageTitle}>{"It's not just Food, It's an Experience."}</Text>
                        </View>
                        
                        {menuSections.map(section => (
                            <View key={section.title} style={styles.sectionContainer}>
                                <Text style={styles.sectionHeader}>{section.title}</Text>
                                <FlatList
                                    data={section.data}
                                    renderItem={({item}) => <RenderMenuItem item={item} />}
                                    keyExtractor={(item) => item.id}
                                    numColumns={isWeb ? 4 : 2}
                                    scrollEnabled={false}
                                    contentContainerStyle={{ paddingHorizontal: 5 }}
                                />
                            </View>
                        ))}
                    </ScrollView>
                    {isWeb && renderCart()}
                </View>
            )}
            
            {!isWeb && cart.length > 0 && (
                <TouchableOpacity style={styles.mobileCartButton} onPress={proceedToCheckout}>
                    <Text style={styles.mobileCartText}>View Order ({cart.length}) - PKR {calculateTotal().toFixed(2)}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1A202C' },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 40, 
        paddingVertical: 20, 
        backgroundColor: '#2D3748',
        borderBottomWidth: 1,
        borderBottomColor: '#4A5568',
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoPlaceholder: {
        width: 30,
        height: 30,
        backgroundColor: '#E53E3E',
        marginRight: 10,
        borderRadius: 5,
    },
    logo: { fontSize: 22, fontWeight: 'bold', color: '#E2E8F0' },
    userActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userNameText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#E2E8F0',
        marginRight: 15,
    },
    mainContent: { flex: 1, flexDirection: 'row' },
    menuContainer: { flex: 1 },
    heroSection: {
        paddingHorizontal: 40,
        paddingVertical: 30,
    },
    pageTitle: { fontSize: 42, fontWeight: 'bold', color: '#E2E8F0', lineHeight: 52 },
    sectionContainer: {
        marginBottom: 20,
    },
    sectionHeader: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#E2E8F0',
        paddingHorizontal: 40,
        marginBottom: 15,
    },
    itemCardContainer: { 
        flex: 1/4, 
        padding: 15,
        minWidth: 200,
    },
    itemCard: { 
        backgroundColor: '#2D3748', 
        borderRadius: 20, 
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 20,
        paddingTop: 150, 
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        elevation: 3,
        position: 'relative',
    },
    itemImage: { 
        width: 120, 
        height: 120, 
        borderRadius: 60, 
        position: 'absolute',
        top: 20, 
        borderWidth: 4,
        borderColor: '#2D3748',
    },
    itemDetails: { alignItems: 'center', paddingTop: 120 },
    itemName: { fontSize: 18, fontWeight: '600', color: '#E2E8F0', textAlign: 'center', marginBottom: 8 },
    itemPrice: { fontSize: 16, fontWeight: 'bold', color: '#E53E3E' },
    addToCartButton: { 
        position: 'absolute', 
        top: 20, 
        right: 20, 
        backgroundColor: '#4A5568', 
        borderRadius: 20, 
        width: 40, 
        height: 40, 
        justifyContent: 'center', 
        alignItems: 'center',
        zIndex: 2,
    },
    cartContainer: { width: 380, backgroundColor: '#2D3748', padding: 25, borderLeftWidth: 1, borderLeftColor: '#4A5568' },
    cartTitle: { fontSize: 24, fontWeight: 'bold', color: '#E2E8F0', marginBottom: 20 },
    cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#4A5568' },
    cartItemImage: { width: 50, height: 50, borderRadius: 10 },
    cartItemDetails: { flex: 1, marginLeft: 15 },
    cartItemName: { fontSize: 16, fontWeight: '500', color: '#E2E8F0' },
    cartItemPrice: { fontSize: 14, color: '#A0AEC0' },
    quantityControl: { flexDirection: 'row', alignItems: 'center' },
    quantityButton: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: '#4A5568', borderRadius: 8 },
    quantityButtonText: { fontSize: 18, color: '#E2E8F0', fontWeight: 'bold' },
    quantityText: { fontSize: 16, fontWeight: '600', color: '#E2E8F0', marginHorizontal: 10 },
    emptyCartText: { textAlign: 'center', color: '#A0AEC0', paddingVertical: 40, fontSize: 16 },
    footer: { borderTopWidth: 1, borderColor: '#4A5568', paddingTop: 20, marginTop: 'auto' },
    totalContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    totalText: { fontSize: 18, color: '#A0AEC0' },
    totalAmount: { fontSize: 22, fontWeight: 'bold', color: '#E2E8F0' },
    placeOrderButton: { backgroundColor: '#E53E3E', padding: 18, borderRadius: 15, alignItems: 'center' },
    placeOrderButtonText: { color: '#1A202C', fontWeight: 'bold', fontSize: 18 },
    disabledButton: { backgroundColor: '#718096' },
    mobileCartButton: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: '#E53E3E',
        padding: 15,
        borderRadius: 15,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 10px 15px rgba(0, 0, 0, 0.2)',
        elevation: 5,
    },
    mobileCartText: {
        color: '#1A202C',
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 10,
    },
});
