import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, FlatList, Alert, Platform, Image, ScrollView } from 'react-native';
import { database } from '../../lib/firebaseConfig';
import { ref, onValue } from 'firebase/database';

// --- Type Definitions ---
interface MenuItem {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
}

interface CartItem extends MenuItem {
    quantity: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch menu items from Firebase
  useEffect(() => {
    const menuItemsRef = ref(database, 'menu_items');
    const unsubscribe = onValue(menuItemsRef, (snapshot) => {
      const menuList = snapshot.exists() 
        ? Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })) 
        : [];
      setMenuItems(menuList);
      setLoading(false);
    }, (error) => {
        console.error(error);
        setLoading(false);
        Alert.alert("Error", "Failed to load the menu.");
    });
    return () => unsubscribe();
  }, []);

  // Effect to clear the cart after a successful order
  useEffect(() => {
    if (params.clearCart === 'true') {
      setCart([]);
      router.setParams({ clearCart: '' });
    }
  }, [params.clearCart, router]);

  // --- Cart Management ---
  const addToCart = (item: MenuItem) => {
    setCart(prevCart => {
        const existingItem = prevCart.find(cartItem => cartItem.id === item.id);
        if (existingItem) {
            return prevCart.map(cartItem => 
                cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
            );
        } else {
            return [...prevCart, { ...item, quantity: 1 }];
        }
    });
  };

  const updateCartQuantity = (itemId: string, change: number) => {
    setCart(currentCart => {
      const itemInCart = currentCart.find(item => item.id === itemId);
      if (itemInCart) {
        const newQuantity = itemInCart.quantity + change;
        if (newQuantity > 0) {
          return currentCart.map(item =>
            item.id === itemId ? { ...item, quantity: newQuantity } : item
          );
        } else {
          return currentCart.filter(item => item.id !== itemId);
        }
      }
      return currentCart;
    });
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const proceedToCheckout = () => {
    if (cart.length === 0) {
        Alert.alert("Empty Cart", "Please add items to the order first.");
        return;
    }
    router.push({
        pathname: '/checkout',
        params: { cart: JSON.stringify(cart), total: calculateTotal() }
    });
  };

  const isWeb = Platform.OS === 'web';

  const renderMenuItem = (item: MenuItem) => (
    <TouchableOpacity key={item.id} style={isWeb ? styles.itemCardWeb : styles.itemCard} onPress={() => addToCart(item)}>
        <Image source={{ uri: item.imageUrl || 'https://via.placeholder.com/150' }} style={styles.itemImage}/>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemPrice}>PKR {item.price.toFixed(2)}</Text>
    </TouchableOpacity>
  );

  const renderCart = () => (
    <View style={isWeb ? styles.cartContainerWeb : styles.cartContainer}>
        <Text style={styles.cartTitle}>Current Order</Text>
        <FlatList
            data={cart}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
                <View style={styles.cartItem}>
                    <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.quantityControl}>
                        <TouchableOpacity onPress={() => updateCartQuantity(item.id, -1)} style={styles.quantityButton}>
                            <Text style={styles.quantityButtonText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{item.quantity}</Text>
                        <TouchableOpacity onPress={() => updateCartQuantity(item.id, 1)} style={styles.quantityButton}>
                            <Text style={styles.quantityButtonText}>+</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.cartItemPrice}>PKR {(item.price * item.quantity).toFixed(2)}</Text>
                </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyCartText}>Cart is empty.</Text>}
        />
        <View style={styles.footer}>
            <Text style={styles.totalText}>Total: PKR {calculateTotal().toFixed(2)}</Text>
            <TouchableOpacity style={[styles.placeOrderButton, cart.length === 0 && styles.disabledButton]} onPress={proceedToCheckout} disabled={cart.length === 0}>
                <Text style={styles.placeOrderButtonText}>Place Order ({cart.reduce((sum, i) => sum + i.quantity, 0)})</Text>
            </TouchableOpacity>
        </View>
    </View>
  )
  
  return (
    <View style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Staff Ordering</Text>
            <TouchableOpacity onPress={() => router.replace('/')}>
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
        </View>

        {isWeb ? (
            <View style={styles.webLayout}>
                <ScrollView style={styles.menuScrollView}>
                    <View style={styles.webMenuContainer}>
                        {menuItems.map(item => renderMenuItem(item))}
                    </View>
                </ScrollView>
                {renderCart()}
            </View>
        ) : (
            <>
                <FlatList
                    data={menuItems}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.listContainer}
                    renderItem={({ item }) => renderMenuItem(item)}
                    ListHeaderComponent={loading ? <Text>Loading Menu...</Text> : null}
                    ListEmptyComponent={<Text style={styles.emptyText}>No menu items available.</Text>}
                />
                {renderCart()}
            </>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { backgroundColor: '#1e293b', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 50, paddingBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
    listContainer: { padding: 10 },
    itemCard: { flex: 1, margin: 8, backgroundColor: '#fff', borderRadius: 12, padding: 15, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
    itemImage: { width: 100, height: 100, borderRadius: 10, marginBottom: 10 },
    itemName: { fontSize: 16, fontWeight: '600', color: '#334155', textAlign: 'center' },
    itemPrice: { fontSize: 15, fontWeight: 'bold', color: '#0ea5e9', marginTop: 5 },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#64748b' },
    
    // Cart Styles (Mobile)
    cartContainer: { 
        backgroundColor: '#ffffff', 
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20, 
        maxHeight: '45%'
    },
    cartTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 15 },
    cartItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#e2e8f0' },
    cartItemName: { fontSize: 16, color: '#334155', flex: 1, marginRight: 10 },
    quantityControl: { flexDirection: 'row', alignItems: 'center' },
    quantityButton: { backgroundColor: '#e2e8f0', borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
    quantityButtonText: { color: '#334155', fontWeight: 'bold', fontSize: 18 },
    quantityText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginHorizontal: 15 },
    cartItemPrice: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', minWidth: 70, textAlign: 'right' },
    emptyCartText: { textAlign: 'center', color: '#64748b', paddingVertical: 20 },

    // Footer Styles
    footer: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingTop: 15, 
        borderTopWidth: 1, 
        borderColor: '#e2e8f0' 
    },
    totalText: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    placeOrderButton: { backgroundColor: '#10b981', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
    placeOrderButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    disabledButton: { backgroundColor: '#9ca3af' },

    // Web-specific styles
    webLayout: {
      flexDirection: 'row',
      flex: 1,
    },
    menuScrollView: {
        flex: 1,
    },
    webMenuContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        padding: 10,
    },
    itemCardWeb: {
        margin: 10,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        alignItems: 'center',
        width: 180, // Fixed width for a grid-like appearance
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        transition: 'transform 0.2s',
    },
    cartContainerWeb: {
        width: 380, // Fixed width for the cart sidebar
        backgroundColor: '#ffffff',
        padding: 20,
        borderLeftWidth: 1,
        borderColor: '#e2e8f0'
    },
});
