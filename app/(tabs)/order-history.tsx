import { useRouter } from 'expo-router';
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable, ActivityIndicator, Alert, Modal, Platform, LayoutAnimation, UIManager, useWindowDimensions, KeyboardAvoidingView } from 'react-native';
import { database, auth } from '../../services/firebase';
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

interface OrderSection {
    title: string;
    data: Order[];
    total: number;
}

// Web-specific scrollbar styles
const WebScrollbarStyles = () => {
    if (Platform.OS !== 'web') return null;
    return (
        <style type="text/css">
            {`
            ::-webkit-scrollbar { width: 8px; height: 8px; }
            ::-webkit-scrollbar-track { background: #0f172a; }
            ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
            ::-webkit-scrollbar-thumb:hover { background: #475569; }
            `}
        </style>
    );
};

export default function OrderHistoryScreen() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserRole, setCurrentUserRole] = useState('');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

    const { width } = useWindowDimensions();
    const isMobile = width < 768;

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

    const sections = useMemo(() => {
        const grouped: OrderSection[] = [];
        orders.forEach(order => {
             const dateObj = new Date(order.date);
             const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
             
             let lastGroup = grouped[grouped.length - 1];
             if (lastGroup && lastGroup.title === dateStr) {
                 lastGroup.data.push(order);
                 lastGroup.total += order.total;
             } else {
                 grouped.push({ title: dateStr, data: [order], total: order.total });
             }
        });
        return grouped;
    }, [orders]);

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
            if (expandedOrderId === orderToDelete.id) setExpandedOrderId(null);
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
                    style={({ pressed }) => [styles.orderItemHeader, { opacity: pressed ? 0.8 : 1 }]} 
                    onPress={() => toggleExpand(item.id)}
                >
                    <View style={styles.headerRow}>
                        <View style={styles.iconBox}>
                            <Ionicons name="receipt" size={24} color="#38bdf8" />
                        </View>
                        <View style={styles.headerInfo}>
                            <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
                            <Text style={styles.orderMeta}>
                                {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {item.customerName || 'Walk-in'}
                            </Text>
                        </View>
                        <View style={styles.headerRight}>
                            <Text style={styles.orderTotal}>PKR {item.total.toFixed(0)}</Text>
                            <Ionicons 
                                name={isExpanded ? "chevron-up" : "chevron-down"} 
                                size={16} 
                                color="#64748b" 
                                style={{ marginTop: 4, alignSelf: 'flex-end' }} 
                            />
                        </View>
                    </View>
                </Pressable>

                {isExpanded && (
                    <View style={styles.orderDetails}>
                        <View style={styles.separator} />
                        <Text style={styles.detailsHeader}>Order Items</Text>
                        {item.items.map((detail, index) => (
                            <View key={detail.id + index} style={styles.itemDetail}>
                                <Text style={styles.itemName}>
                                    <Text style={styles.itemQuantity}>{detail.quantity}x </Text>
                                    {detail.name}
                                </Text>
                                <Text style={styles.itemPrice}>PKR {(detail.price * detail.quantity).toFixed(0)}</Text>
                            </View>
                        ))}
                        
                        {currentUserRole === 'superadmin' && (
                            <View style={styles.actionRow}>
                                <Pressable style={styles.deleteButton} onPress={() => confirmDelete(item)}>
                                    <Ionicons name="trash-outline" size={18} color="#f8fafc" />
                                    <Text style={styles.deleteButtonText}>Delete Order</Text>
                                </Pressable>
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    const renderSectionHeader = ({ section: { title, total } }: { section: { title: string, total: number } }) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionDate}>{title}</Text>
            <View style={styles.sectionTotalBadge}>
                <Text style={styles.sectionTotalLabel}>Day Total</Text>
                <Text style={styles.sectionTotalValue}>PKR {total.toFixed(0)}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <WebScrollbarStyles />
            <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                    <Ionicons name="time" size={28} color="#38bdf8" style={{marginRight: 12}} />
                    <Text style={styles.title}>Order History</Text>
                </View>
                {/* On Desktop back button is not needed if sidebar exists, but useful on mobile */}
                {isMobile && (
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="close" size={24} color="#94a3b8" />
                    </Pressable>
                )}
            </View>
            
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#38bdf8" /></View>
            ) : (
                <SectionList
                    sections={sections}
                    renderItem={renderOrderItem}
                    renderSectionHeader={renderSectionHeader}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.listContent, isMobile && { paddingBottom: 120 }]}
                    stickySectionHeadersEnabled={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="documents-outline" size={64} color="#334155" />
                            <Text style={styles.emptyText}>No past orders found.</Text>
                        </View>
                    }
                />
            )}

            {/* Confirmation Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={confirmModalVisible}
                onRequestClose={() => setConfirmModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.confirmModalContent}>
                        <View style={styles.modalIconCircle}>
                            <Ionicons name="alert" size={32} color="#ef4444" />
                        </View>
                        <Text style={styles.confirmTitle}>Delete Order?</Text>
                        
                        {orderToDelete && (
                            <View style={styles.confirmDetailsCard}>
                                <Text style={styles.confirmInfoText}>
                                    Are you sure you want to delete order <Text style={{fontWeight: 'bold', color: '#f8fafc'}}>#{orderToDelete.orderNumber}</Text>?
                                </Text>
                                <Text style={styles.confirmWarning}>This action cannot be undone.</Text>
                            </View>
                        )}

                        <View style={styles.confirmButtonContainer}>
                            <Pressable style={[styles.confirmButton, styles.cancelButton]} onPress={() => setConfirmModalVisible(false)}>
                                <Text style={styles.confirmButtonText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={[styles.confirmButton, styles.deleteConfirmButton]} onPress={performDelete}>
                                <Text style={[styles.confirmButtonText, { color: '#fee2e2' }]}>Delete</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    
    // Header
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 24, 
        paddingVertical: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderBottomWidth: 1, 
        borderBottomColor: 'rgba(255,255,255,0.05)',
        zIndex: 10,
    },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
    backButton: { padding: 8, borderRadius: 20, backgroundColor: '#1e293b' },
    
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
    listContent: { padding: 20 },
    emptyContainer: { alignItems: 'center', marginTop: 60, opacity: 0.7 },
    emptyText: { color: '#94a3b8', fontSize: 18, marginTop: 16, fontWeight: '600' },
    
    // Section Header
    sectionHeader: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginTop: 24, 
        marginBottom: 12, 
        paddingHorizontal: 8 
    },
    sectionDate: { fontSize: 14, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
    sectionTotalBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(56, 189, 248, 0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    sectionTotalLabel: { fontSize: 12, color: '#94a3b8', marginRight: 6, fontWeight: '600' },
    sectionTotalValue: { fontSize: 14, fontWeight: '800', color: '#38bdf8' },

    // Order Item Card
    orderItemContainer: { 
        backgroundColor: '#1e293b', 
        borderRadius: 20, 
        marginBottom: 12, 
        borderWidth: 1, 
        borderColor: '#334155', 
        overflow: 'hidden',
        ...Platform.select({
            web: { boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
            default: { elevation: 3 }
        }),
    },
    orderItemHeader: { padding: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    iconBox: {
        width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'center', alignItems: 'center', marginRight: 16
    },
    headerInfo: { flex: 1 },
    orderNumber: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 2 },
    orderMeta: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
    headerRight: { alignItems: 'flex-end', justifyContent: 'center' },
    orderTotal: { fontSize: 16, fontWeight: '800', color: '#38bdf8' },
    
    // Expanded Details
    orderDetails: { backgroundColor: '#162032', padding: 20, borderTopWidth: 1, borderTopColor: '#334155' },
    separator: { height: 1, backgroundColor: '#334155', marginBottom: 16 },
    detailsHeader: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    
    itemDetail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, alignItems: 'center' },
    itemName: { color: '#cbd5e1', fontSize: 15, flex: 1, paddingRight: 16 },
    itemQuantity: { color: '#38bdf8', fontWeight: '700' },
    itemPrice: { color: '#f8fafc', fontSize: 15, fontWeight: '600' },
    
    actionRow: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#334155', alignItems: 'flex-end' },
    deleteButton: { flexDirection: 'row', backgroundColor: 'rgba(239, 68, 68, 0.9)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
    deleteButtonText: { color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 8 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    confirmModalContent: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
    modalIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(239, 68, 68, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    confirmTitle: { fontSize: 22, fontWeight: '800', color: '#f8fafc', marginBottom: 12 },
    confirmDetailsCard: { width: '100%', alignItems: 'center', marginBottom: 24 },
    confirmInfoText: { color: '#cbd5e1', fontSize: 16, textAlign: 'center', marginBottom: 8, lineHeight: 22 },
    confirmWarning: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
    
    confirmButtonContainer: { flexDirection: 'row', width: '100%', gap: 12 },
    confirmButton: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    cancelButton: { backgroundColor: '#334155' },
    deleteConfirmButton: { backgroundColor: '#be123c' },
    confirmButtonText: { color: '#f8fafc', fontWeight: '700', fontSize: 16 },
});
