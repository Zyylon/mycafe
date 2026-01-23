import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, Modal, Platform } from 'react-native';
import { database, auth } from '../lib/firebaseConfig';
import { ref, onValue, off, remove } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';

interface OrderItemDetail {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

interface Order {
    id: string;
    orderNumber: string;
    date: number;
    total: number;
    customerName: string;
    orderType: string;
    items: OrderItemDetail[];
}

export default function OrderHistoryScreen() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserRole, setCurrentUserRole] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    useEffect(() => {
        const authUnsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                const userRoleRef = ref(database, `users/${user.uid}/role`);
                const roleListener = onValue(userRoleRef, (snapshot) => {
                    const role = snapshot.val();
                    setCurrentUserRole(role);
                    if (role === 'admin' || role === 'superadmin') {
                        fetchOrders();
                    } else {
                        setLoading(false);
                        Alert.alert('Access Denied', 'You do not have permission to view this page.');
                        router.back();
                    }
                }, { onlyOnce: true });
                return () => off(userRoleRef, 'value', roleListener);
            } else {
                setLoading(false);
                router.replace('/');
            }
        });
        return () => authUnsubscribe();
    }, [router]);

    const fetchOrders = () => {
        const ordersRef = ref(database, 'orders');
        const listener = onValue(ordersRef, (snapshot) => {
            const data = snapshot.val();
            const ordersList: Order[] = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a, b) => b.date - a.date) : [];
            setOrders(ordersList);
            setLoading(false);
        });
        return () => off(ordersRef, 'value', listener);
    };

    const handleDelete = (orderId: string) => {
        if (currentUserRole !== 'superadmin') {
            return Alert.alert("Permission Denied", "Only superadmins can delete orders.");
        }
        Alert.alert("Confirm Deletion", "Permanently delete this order? This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        await remove(ref(database, `orders/${orderId}`));
                        Alert.alert("Success", "Order deleted.");
                        setSelectedOrder(null);
                    } catch (error: any) {
                        Alert.alert("Error", error.message);
                    }
                },
            },
        ]);
    };

    const renderOrderItem = ({ item }: { item: Order }) => (
        <Pressable style={({ pressed }) => [styles.orderItem, { opacity: pressed ? 0.7 : 1 }]} onPress={() => setSelectedOrder(item)}>
            <View style={styles.orderItemHeader}>
                <Text style={styles.orderTitle}>Order #{item.orderNumber}</Text>
                <Text style={styles.orderTotal}>PKR {item.total.toFixed(2)}</Text>
            </View>
            <View style={styles.orderItemFooter}>
                <Text style={styles.orderInfo}>{item.customerName || 'Walk-in'} - {item.orderType}</Text>
                <Text style={styles.orderDate}>{new Date(item.date).toLocaleString()}</Text>
            </View>
        </Pressable>
    );
    
    const renderOrderDetailsModal = () => {
        if (!selectedOrder) return null;
        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={!!selectedOrder}
                onRequestClose={() => setSelectedOrder(null)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Order #{selectedOrder.orderNumber}</Text>
                            <Pressable onPress={() => setSelectedOrder(null)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                                <Ionicons name="close-circle" size={28} color="#94a3b8" />
                            </Pressable>
                        </View>
                        <FlatList
                            data={selectedOrder.items}
                            keyExtractor={(item) => item.id + Math.random()}
                            renderItem={({ item }) => (
                                <View style={styles.itemDetail}>
                                    <Text style={styles.itemName}>{item.name} <Text style={styles.itemQuantity}>x{item.quantity}</Text></Text>
                                    <Text style={styles.itemPrice}>PKR {(item.price * item.quantity).toFixed(2)}</Text>
                                </View>
                            )}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        />
                        <View style={styles.modalFooter}>
                            <View style={styles.totalContainer}>
                                <Text style={styles.totalText}>Total</Text>
                                <Text style={styles.modalTotal}>PKR {selectedOrder.total.toFixed(2)}</Text>
                            </View>
                            {currentUserRole === 'superadmin' && (
                                <Pressable style={({ pressed }) => [styles.deleteButton, { opacity: pressed ? 0.7 : 1 }]} onPress={() => handleDelete(selectedOrder.id)}>
                                    <Ionicons name="trash-outline" size={20} color="#f1f5f9" />
                                    <Text style={styles.deleteButtonText}>Delete Order</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Order History</Text>
                <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}>
                    <Ionicons name="close-outline" size={28} color="#94a3b8" />
                </Pressable>
            </View>
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#38bdf8" /></View>
            ) : (
                <FlatList
                    data={orders}
                    renderItem={renderOrderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ padding: 20 }}
                    ListEmptyComponent={<Text style={styles.emptyText}>No past orders found.</Text>}
                />
            )}
            {renderOrderDetailsModal()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 15, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
    title: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc' },
    backButton: { padding: 5 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    orderItem: { backgroundColor: '#1e293b', padding: 20, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
    orderItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    orderTitle: { fontSize: 18, fontWeight: 'bold', color: '#f1f5f9' },
    orderTotal: { fontSize: 18, fontWeight: 'bold', color: '#38bdf8' },
    orderItemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    orderInfo: { fontSize: 14, color: '#94a3b8' },
    orderDate: { fontSize: 14, color: '#94a3b8' },
    emptyText: { color: '#94a3b8', textAlign: 'center', marginTop: 50, fontSize: 16 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: '80%', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, elevation: 5, borderTopWidth: 1, borderColor: '#334155' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 15, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#334155' },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc' },
    itemDetail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
    itemName: { color: '#f1f5f9', fontSize: 16, fontWeight: '500' },
    itemQuantity: { color: '#94a3b8', fontSize: 14 },
    itemPrice: { color: '#f1f5f9', fontSize: 16, fontWeight: 'bold' },
    modalFooter: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 15 },
    totalContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    totalText: { fontSize: 18, color: '#94a3b8', fontWeight: 'bold' },
    modalTotal: { fontSize: 24, fontWeight: 'bold', color: '#38bdf8' },
    deleteButton: { flexDirection: 'row', backgroundColor: '#be123c', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    deleteButtonText: { color: '#f1f5f9', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
});
