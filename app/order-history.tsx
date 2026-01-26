import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, Modal, Platform, LayoutAnimation, UIManager } from 'react-native';
import { database, auth } from '../lib/firebaseConfig';
import { ref, onValue, off, remove } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

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
    
    // Track expanded order ID
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    // Confirmation Modal State
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

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

    const toggleExpand = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedOrderId(prevId => prevId === id ? null : id);
    };

    const confirmDelete = (order: Order) => {
        if (currentUserRole !== 'superadmin') {
            const msg = "Only superadmins can delete orders.";
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert("Permission Denied", msg);
            return;
        }
        setOrderToDelete(order);
        setConfirmModalVisible(true);
    };

    const performDelete = async () => {
        if (!orderToDelete) return;
        
        try {
            await remove(ref(database, `orders/${orderToDelete.id}`));
            setConfirmModalVisible(false);
            setOrderToDelete(null);
            // If the deleted order was expanded, collapse it (though it will disappear from list)
            if (expandedOrderId === orderToDelete.id) {
                setExpandedOrderId(null);
            }
        } catch (error: any) {
            console.error("Delete error:", error);
            if (Platform.OS === 'web') window.alert(error.message);
            else Alert.alert("Error", error.message);
        }
    };

    const renderOrderItem = ({ item }: { item: Order }) => {
        const isExpanded = expandedOrderId === item.id;

        return (
            <View style={styles.orderItemContainer}>
                <Pressable 
                    style={({ pressed }) => [styles.orderItemHeader, { opacity: pressed ? 0.7 : 1 }]} 
                    onPress={() => toggleExpand(item.id)}
                >
                    <View style={styles.headerTop}>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Ionicons name={isExpanded ? "chevron-down" : "chevron-forward"} size={20} color="#94a3b8" style={{marginRight: 10}} />
                            <Text style={styles.orderTitle}>Order #{item.orderNumber}</Text>
                        </View>
                        <Text style={styles.orderTotal}>PKR {item.total.toFixed(2)}</Text>
                    </View>
                    <View style={styles.headerBottom}>
                        <Text style={styles.orderInfo}>{item.customerName || 'Walk-in'} • {item.orderType}</Text>
                        <Text style={styles.orderDate}>{new Date(item.date).toLocaleString()}</Text>
                    </View>
                </Pressable>

                {isExpanded && (
                    <View style={styles.orderDetails}>
                        <View style={styles.separator} />
                        {item.items.map((detail, index) => (
                            <View key={detail.id + index} style={styles.itemDetail}>
                                <Text style={styles.itemName}>{detail.name} <Text style={styles.itemQuantity}>x{detail.quantity}</Text></Text>
                                <Text style={styles.itemPrice}>PKR {(detail.price * detail.quantity).toFixed(2)}</Text>
                            </View>
                        ))}
                        
                        {currentUserRole === 'superadmin' && (
                            <View style={styles.actionRow}>
                                <Pressable style={styles.inlineDeleteButton} onPress={() => confirmDelete(item)}>
                                    <Ionicons name="trash-outline" size={18} color="#f8fafc" />
                                    <Text style={styles.inlineDeleteText}>Delete Order</Text>
                                </Pressable>
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    const renderConfirmationModal = () => {
        return (
            <Modal
                animationType="fade"
                transparent={true}
                visible={confirmModalVisible}
                onRequestClose={() => setConfirmModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.confirmModalContent}>
                        <Ionicons name="alert-circle-outline" size={50} color="#ef4444" style={{ marginBottom: 10 }} />
                        <Text style={styles.confirmTitle}>Delete Order?</Text>
                        
                        {orderToDelete && (
                            <View style={styles.confirmDetails}>
                                <Text style={styles.confirmText}><Text style={styles.confirmLabel}>Order #:</Text> {orderToDelete.orderNumber}</Text>
                                <Text style={styles.confirmText}><Text style={styles.confirmLabel}>Customer:</Text> {orderToDelete.customerName || 'Walk-in'}</Text>
                                <Text style={styles.confirmText}><Text style={styles.confirmLabel}>Date:</Text> {new Date(orderToDelete.date).toLocaleString()}</Text>
                                <Text style={styles.confirmText}><Text style={styles.confirmLabel}>Total:</Text> PKR {orderToDelete.total.toFixed(2)}</Text>
                            </View>
                        )}

                        <Text style={styles.confirmWarning}>This action cannot be undone.</Text>

                        <View style={styles.confirmButtonContainer}>
                            <Pressable style={[styles.confirmButton, styles.cancelButton]} onPress={() => setConfirmModalVisible(false)}>
                                <Text style={styles.confirmButtonText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={[styles.confirmButton, styles.deleteConfirmButton]} onPress={performDelete}>
                                <Text style={[styles.confirmButtonText, { color: '#0f172a' }]}>Delete</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }

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
            {renderConfirmationModal()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 15, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
    title: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc' },
    backButton: { padding: 5 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: '#94a3b8', textAlign: 'center', marginTop: 50, fontSize: 16 },
    
    // Order Item Styles
    orderItemContainer: { backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
    orderItemHeader: { padding: 20 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    headerBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    orderTitle: { fontSize: 18, fontWeight: 'bold', color: '#f1f5f9' },
    orderTotal: { fontSize: 18, fontWeight: 'bold', color: '#38bdf8' },
    orderInfo: { fontSize: 14, color: '#94a3b8' },
    orderDate: { fontSize: 13, color: '#64748b' },
    
    // Expanded Details
    orderDetails: { backgroundColor: '#1e293b', paddingHorizontal: 20, paddingBottom: 20 },
    separator: { height: 1, backgroundColor: '#334155', marginBottom: 15 },
    itemDetail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    itemName: { color: '#cbd5e1', fontSize: 15 },
    itemQuantity: { color: '#94a3b8', fontSize: 13 },
    itemPrice: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
    
    actionRow: { marginTop: 20, flexDirection: 'row', justifyContent: 'flex-end' },
    inlineDeleteButton: { flexDirection: 'row', backgroundColor: '#be123c', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
    inlineDeleteText: { color: '#f8fafc', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },

    // Confirmation Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    confirmModalContent: { backgroundColor: '#1e293b', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
    confirmTitle: { fontSize: 20, fontWeight: 'bold', color: '#f8fafc', marginBottom: 15 },
    confirmDetails: { width: '100%', backgroundColor: '#0f172a', padding: 15, borderRadius: 8, marginBottom: 15, borderLeftWidth: 3, borderLeftColor: '#ef4444' },
    confirmText: { color: '#cbd5e1', fontSize: 14, marginBottom: 5 },
    confirmLabel: { fontWeight: 'bold', color: '#94a3b8' },
    confirmWarning: { color: '#ef4444', fontSize: 14, marginBottom: 20, fontStyle: 'italic' },
    confirmButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 15 },
    confirmButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    cancelButton: { backgroundColor: '#334155' },
    deleteConfirmButton: { backgroundColor: '#ef4444' },
    confirmButtonText: { color: '#f8fafc', fontWeight: 'bold', fontSize: 16 },
});
