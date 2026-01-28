import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { off, onValue, ref, remove } from 'firebase/database';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SectionList,
    StyleSheet,
    Text,
    View
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeOut,
    LinearTransition
} from 'react-native-reanimated';
import { auth, database } from '../../services/firebase';

// --- Interfaces ---
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
            ::-webkit-scrollbar { width: 10px; height: 10px; }
            ::-webkit-scrollbar-track { background: #0f172a; }
            ::-webkit-scrollbar-thumb { background: #334155; border-radius: 5px; border: 2px solid #0f172a; }
            ::-webkit-scrollbar-thumb:hover { background: #475569; }
            * { scrollbar-width: thin; scrollbar-color: #334155 #0f172a; }
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
            setTimeout(() => setLoading(false), 300);
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
            Alert.alert("Error", error.message);
        }
    };

    // --- RENDERERS ---

    const renderOrderItem = ({ item, index }: { item: Order, index: number }) => {
        const isExpanded = expandedOrderId === item.id;
        // Format Date Time once
        const dateObj = new Date(item.date);
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

        return (
            <Animated.View 
                entering={FadeInDown.delay(index * 50).duration(300)}
                layout={LinearTransition.springify().damping(16)}
                style={styles.orderItemContainer}
            >
                <Pressable 
                    style={({ pressed }) => [styles.orderItemHeader, { opacity: pressed ? 0.7 : 1 }]} 
                    onPress={() => toggleExpand(item.id)}
                >
                    <View style={styles.headerRow}>
                        {/* 1. Fixed Icon */}
                        <View style={styles.iconContainer}>
                            <Ionicons name="receipt-outline" size={24} color="#38bdf8" />
                        </View>

                        {/* 2. Order Info (ID & Date) */}
                        <View style={styles.headerInfo}>
                            <Text style={styles.orderTitle}>Order #{item.orderNumber}</Text>
                            <Text style={styles.orderSubInfo}>{dateStr} • {timeStr}</Text>
                        </View>

                        {/* 3. Price & Arrow */}
                        <View style={styles.headerRight}>
                             <Text style={styles.orderTotal}>PKR {item.total.toFixed(0)}</Text>
                             <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#64748b" style={{ marginTop: 4 }} />
                        </View>
                    </View>
                </Pressable>

                {isExpanded && (
                    <Animated.View 
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(150)}
                        style={styles.orderDetails}
                    >
                        <View style={styles.separator} />
                        
                        {/* Moved Details: Customer & Type */}
                        <View style={styles.metaRow}>
                            <View style={styles.metaItem}>
                                <Text style={styles.metaLabel}>CUSTOMER</Text>
                                <Text style={styles.metaValue}>{item.customerName || 'Walk-in'}</Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Text style={styles.metaLabel}>TYPE</Text>
                                <View style={styles.typeBadge}>
                                    <Text style={styles.typeBadgeText}>{item.orderType}</Text>
                                </View>
                            </View>
                        </View>

                        <Text style={styles.detailsHeader}>Order Items</Text>
                        {item.items.map((detail, i) => (
                            <View key={detail.id + i} style={styles.itemDetail}>
                                <Text style={styles.itemName} numberOfLines={1}>
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
                    </Animated.View>
                )}
            </Animated.View>
        );
    };

    const renderSectionHeader = ({ section: { title, total } }: { section: { title: string, total: number } }) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionDate}>{title}</Text>
            <View style={styles.sectionTotalContainer}>
                <Text style={styles.sectionTotalLabel}>Daily Total:</Text>
                <Text style={styles.sectionTotalValue}>PKR {total.toFixed(0)}</Text>
            </View>
        </View>
    );

    const renderConfirmationModal = () => (
        <Modal animationType="fade" transparent={true} visible={confirmModalVisible} onRequestClose={() => setConfirmModalVisible(false)}>
            <View style={styles.modalOverlay}>
                <View style={styles.confirmModalContent}>
                    <Ionicons name="alert-circle-outline" size={50} color="#ef4444" style={{ marginBottom: 16 }} />
                    <Text style={styles.confirmTitle}>Delete Order?</Text>
                    
                    {orderToDelete && (
                        <View style={styles.confirmDetailsCard}>
                            <View style={styles.confirmRow}>
                                <Text style={styles.confirmLabel}>Order #</Text>
                                <Text style={styles.confirmValue}>{orderToDelete.orderNumber}</Text>
                            </View>
                            <View style={styles.confirmRow}>
                                <Text style={styles.confirmLabel}>Customer</Text>
                                <Text style={styles.confirmValue}>{orderToDelete.customerName || 'Walk-in'}</Text>
                            </View>
                            <View style={styles.confirmRow}>
                                <Text style={styles.confirmLabel}>Total</Text>
                                <Text style={[styles.confirmValue, { color: '#38bdf8' }]}>PKR {orderToDelete.total.toFixed(0)}</Text>
                            </View>
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

    return (
        <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#0f172a' }}>
            <WebScrollbarStyles />
             <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Order History</Text>
                    <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}>
                        <Ionicons name="close-outline" size={28} color="#94a3b8" />
                    </Pressable>
                </View>
                
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color="#38bdf8" />
                        <Text style={styles.loadingText}>Loading Orders...</Text>
                    </View>
                ) : (
                    <SectionList
                        sections={sections}
                        renderItem={renderOrderItem}
                        renderSectionHeader={renderSectionHeader}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        stickySectionHeadersEnabled={false}
                        ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>No past orders found.</Text></View>}
                    />
                )}
                {renderConfirmationModal()}
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    
    // Header
    header: { 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
        paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 50 : 24, paddingBottom: 24,
        backgroundColor: 'rgba(15, 23, 42, 0.95)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', zIndex: 10,
    },
    title: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
    backButton: { padding: 8, borderRadius: 20, backgroundColor: '#1e293b' },
    
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
    loadingText: { color: '#64748b', marginTop: 16, fontSize: 16, fontWeight: '500' },
    emptyText: { color: '#94a3b8', fontSize: 16 },
    listContent: { padding: 24, paddingBottom: 50 },
    
    // Section Header
    sectionHeader: { 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
        marginTop: 24, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#334155' 
    },
    sectionDate: { fontSize: 16, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
    sectionTotalContainer: { flexDirection: 'row', alignItems: 'baseline' },
    sectionTotalLabel: { fontSize: 12, color: '#64748b', marginRight: 8, fontWeight: '600' },
    sectionTotalValue: { fontSize: 16, fontWeight: '700', color: '#38bdf8' },

    // Order Item Card
    orderItemContainer: { 
        backgroundColor: '#1e293b', borderRadius: 20, marginBottom: 12, 
        borderWidth: 1, borderColor: '#334155', overflow: 'hidden',
        ...Platform.select({ web: { boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }, default: { elevation: 4 } }),
    },
    orderItemHeader: { padding: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    
    // 1. Icon Fixed
    iconContainer: { 
        width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(56, 189, 248, 0.1)', 
        justifyContent: 'center', alignItems: 'center', marginRight: 16 
    },
    // 2. Middle Info
    headerInfo: { flex: 1, justifyContent: 'center' },
    orderTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
    orderSubInfo: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
    
    // 3. Right Price
    headerRight: { alignItems: 'flex-end', justifyContent: 'center' },
    orderTotal: { fontSize: 16, fontWeight: '700', color: '#38bdf8' },
    
    // Expanded Details
    orderDetails: { backgroundColor: '#162032', paddingHorizontal: 20, paddingBottom: 20, paddingTop: 0 },
    separator: { height: 1, backgroundColor: '#334155', marginBottom: 16 },
    
    // Meta Row (Customer & Type)
    metaRow: { flexDirection: 'row', marginBottom: 20, justifyContent: 'space-between' },
    metaItem: { flex: 1 },
    metaLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 4, letterSpacing: 0.5 },
    metaValue: { fontSize: 15, fontWeight: '600', color: '#e2e8f0' },
    typeBadge: { backgroundColor: '#334155', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    typeBadgeText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },

    detailsHeader: { fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    itemDetail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, alignItems: 'center' },
    itemName: { color: '#cbd5e1', fontSize: 15, flex: 1, paddingRight: 16 },
    itemQuantity: { color: '#38bdf8', fontWeight: '700' },
    itemPrice: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
    
    actionRow: { marginTop: 24, flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#334155' },
    deleteButton: { flexDirection: 'row', backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
    deleteButtonText: { color: '#ef4444', fontWeight: '700', fontSize: 13, marginLeft: 8 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' },
    confirmModalContent: { backgroundColor: '#1e293b', borderRadius: 24, padding: 32, width: '90%', maxWidth: 400, borderWidth: 1, borderColor: '#ef4444', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
    confirmTitle: { fontSize: 22, fontWeight: '800', color: '#f8fafc', marginBottom: 20 },
    confirmDetailsCard: { width: '100%', backgroundColor: '#0f172a', padding: 20, borderRadius: 16, marginBottom: 20 },
    confirmRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    confirmLabel: { fontWeight: '600', color: '#94a3b8' },
    confirmValue: { fontWeight: '700', color: '#f1f5f9' },
    confirmWarning: { color: '#ef4444', fontSize: 14, marginBottom: 24, fontStyle: 'italic', fontWeight: '600' },
    confirmButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 16 },
    confirmButton: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    cancelButton: { backgroundColor: '#334155' },
    deleteConfirmButton: { backgroundColor: '#ef4444' },
    confirmButtonText: { color: '#f8fafc', fontWeight: '800', fontSize: 16 },
});