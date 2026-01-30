import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { onValue, ref, update } from 'firebase/database';
import React, { useEffect, useState, useMemo } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    View,
    Pressable
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { database } from '../../services/firebase';

interface MenuItem {
    id: string;
    name: string;
    price: number;
    isKitchenItem: boolean;
}

interface OrderItem extends MenuItem {
    quantity: number;
    status: 'pending' | 'prepared' | 'served';
}

interface OngoingOrder {
    id: string;
    orderNumber: string;
    items: OrderItem[];
}

export default function EditOrderScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { userData } = useAuth();
    
    const [order, setOrder] = useState<OngoingOrder | null>(null);
    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [updatedItems, setUpdatedItems] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        const orderRef = ref(database, `ongoing_orders/${id}`);
        const menuRef = ref(database, 'menu_items');

        const unsubOrder = onValue(orderRef, (snapshot) => {
            if (snapshot.exists()) {
                const orderData = { id: snapshot.key, ...snapshot.val() };
                setOrder(orderData);
                setUpdatedItems(orderData.items);
            } else {
                setOrder(null);
            }
            setLoading(false);
        });

        const unsubMenu = onValue(menuRef, (snapshot) => {
            const menuData = snapshot.val() || {};
            const menuList = Object.keys(menuData).map(key => ({ id: key, ...menuData[key] }));
            setMenu(menuList);
        });

        return () => {
            unsubOrder();
            unsubMenu();
        };
    }, [id]);

    const addToOrder = (menuItem: MenuItem) => {
        setUpdatedItems(prevItems => {
            const existingItemIndex = prevItems.findIndex(item => item.id === menuItem.id);
            if (existingItemIndex > -1) {
                // Item exists, increment quantity
                return prevItems.map((item, index) => 
                    index === existingItemIndex ? { ...item, quantity: item.quantity + 1 } : item
                );
            } else {
                // New item, add to list
                return [...prevItems, { ...menuItem, quantity: 1, status: 'pending' }];
            }
        });
    };

    const handleSaveChanges = async () => {
        if (!order) return;
        setLoading(true);
        try {
            const newTotal = updatedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            const updates: any = {};
            updates[`/ongoing_orders/${order.id}/items`] = updatedItems;
            updates[`/ongoing_orders/${order.id}/total`] = newTotal;

            await update(ref(database), updates);
            router.back();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color="#38bdf8" /></View>;
    }

    if (!order) {
        return <View style={[styles.container, styles.center]}><Text style={styles.emptyText}>Order not found.</Text></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Edit Order #{order.orderNumber}</Text>
            </View>

            <View style={styles.columns}>
                {/* Current Items Column */}
                <View style={styles.column}>
                    <Text style={styles.columnHeader}>Current Items</Text>
                    <FlatList
                        data={updatedItems}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <View style={styles.orderItem}>
                                <Text style={styles.itemName}>{item.quantity}x {item.name}</Text>
                                <Text style={styles.itemStatus}>{item.status}</Text>
                            </View>
                        )}
                    />
                </View>

                {/* Menu Column */}
                <View style={styles.column}>
                    <Text style={styles.columnHeader}>Add More Items</Text>
                    <FlatList
                        data={menu}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.menuItem} onPress={() => addToOrder(item)}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                <Text style={styles.itemPrice}>PKR {item.price}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </View>

            <View style={styles.footer}>
                <Pressable style={styles.cancelButton} onPress={() => router.back()}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={handleSaveChanges}>
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { padding: 24, borderBottomWidth: 1, borderBottomColor: '#334155' },
    title: { color: '#f8fafc', fontSize: 24, fontWeight: '800' },
    columns: { flexDirection: 'row', flex: 1 },
    column: { flex: 1, borderRightWidth: 1, borderRightColor: '#334155' },
    columnHeader: { color: '#9ca3af', fontSize: 16, fontWeight: '700', padding: 16, backgroundColor: '#1e293b' },
    
    orderItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    itemName: { color: '#f3f4f6', fontSize: 16 },
    itemStatus: { color: '#6ee7b7', textTransform: 'capitalize' },
    
    menuItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    itemPrice: { color: '#9ca3af' },

    footer: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#334155', padding: 16, gap: 16 },
    cancelButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: '#374151' },
    cancelButtonText: { color: '#f8fafc', fontWeight: '700' },
    saveButton: { flex: 2, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: '#38bdf8' },
    saveButtonText: { color: '#0f172a', fontWeight: '800' },
    emptyText: { color: '#9ca3af' }
});
