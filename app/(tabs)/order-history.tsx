import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { off, onValue, ref, remove, update } from 'firebase/database';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    LayoutAnimation,
    Modal,
    Platform,
    Pressable,
    SectionList,
    StyleSheet,
    Text,
    TextInput,
    UIManager,
    View,
    useWindowDimensions
} from 'react-native';
import { auth, database } from '../../services/firebase';

// Enable LayoutAnimation
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
    status?: string; // 'active', 'served', 'completed'
    items: OrderItemDetail[];
    source: 'history' | 'ongoing'; // To know which DB node to update
}

interface OrderSection {
    title: string;
    data: Order[];
    total: number;
}

const WebScrollbarStyles = () => {
    if (Platform.OS !== 'web') return null;
    return (
        <style type="text/css">
            {`
            ::-webkit-scrollbar { width: 8px; }
            ::-webkit-scrollbar-track { background: #0f172a; }
            ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
            `}
        </style>
    );
};

export default function OrderHistoryScreen() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserRole, setCurrentUserRole] = useState('');
    
    // UI State
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    
    // Edit/Delete Modal State
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [editItems, setEditItems] = useState<OrderItemDetail[]>([]);

    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    useEffect(() => {
        const authUnsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                const userRoleRef = ref(database, `users/${user.uid}/role`);
                onValue(userRoleRef, (snapshot) => {
                    const role = snapshot.val();
                    setCurrentUserRole(role);
                    if (['admin', 'superadmin', 'staff', 'kitchen'].includes(role)) {
                        fetchAllOrders();
                    } else {
                        setLoading(false);
                        Alert.alert('Access Denied', 'Permission denied.');
                        router.back();
                    }
                }, { onlyOnce: true });
            } else {
                router.replace('/');
            }
        });
        return () => authUnsubscribe();
    }, []);

    const fetchAllOrders = () => {
        const historyRef = ref(database, 'orders');
        const ongoingRef = ref(database, 'ongoing_orders');

        // We listen to both nodes
        let historyData: Order[] = [];
        let ongoingData: Order[] = [];

        const updateState = () => {
            // Merge and Sort (Newest First)
            const combined = [...ongoingData, ...historyData].sort((a, b) => b.date - a.date);
            setOrders(combined);
            setLoading(false);
        };

        const historyListener = onValue(historyRef, (snapshot) => {
            const data = snapshot.val();
            historyData = data ? Object.keys(data).map(key => ({ ...data[key], id: key, source: 'history', status: 'completed' })) : [];
            updateState();
        });

        const ongoingListener = onValue(ongoingRef, (snapshot) => {
            const data = snapshot.val();
            ongoingData = data ? Object.keys(data).map(key => ({ 
                ...data[key], 
                id: key, 
                source: 'ongoing',
                // Default to 'active' if status is missing in DB
                status: data[key].status || 'active' 
            })) : [];
            updateState();
        });

        return () => {
            off(historyRef, 'value', historyListener);
            off(ongoingRef, 'value', ongoingListener);
        };
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

    // --- DELETE Logic ---
    const confirmDelete = (order: Order) => {
        if (currentUserRole !== 'superadmin') return Alert.alert("Permission Denied", "Only Superadmins can delete orders.");
        setSelectedOrder(order);
        setConfirmModalVisible(true);
    };

    const performDelete = async () => {
        if (!selectedOrder) return;
        try {
            // Determine correct path based on source
            const node = selectedOrder.source === 'ongoing' ? 'ongoing_orders' : 'orders';
            await remove(ref(database, `${node}/${selectedOrder.id}`));
            
            setConfirmModalVisible(false);
            setSelectedOrder(null);
        } catch (error: any) {
            Alert.alert("Error", error.message);
        }
    };

    // --- EDIT Logic ---
    const openEditModal = (order: Order) => {
        // Prevent editing Completed orders if not superadmin (optional policy)
        if (order.source === 'history' && currentUserRole !== 'superadmin') {
             return Alert.alert("Restricted", "Only Superadmins can edit completed history.");
        }
        setSelectedOrder(order);
        setEditItems(JSON.parse(JSON.stringify(order.items)));
        setEditModalVisible(true);
    };

    const handleItemChange = (index: number, field: keyof OrderItemDetail, value: string) => {
        const updated = [...editItems];
        if (field === 'quantity' || field === 'price') {
            updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
        } else {
            // @ts-ignore
            updated[index][field] = value;
        }
        setEditItems(updated);
    };

    const saveChanges = async () => {
        if (!selectedOrder) return;
        const newTotal = editItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        try {
            const node = selectedOrder.source === 'ongoing' ? 'ongoing_orders' : 'orders';
            await update(ref(database, `${node}/${selectedOrder.id}`), {
                items: editItems,
                total: newTotal
            });
            setEditModalVisible(false);
            Alert.alert("Success", "Order updated successfully.");
        } catch (e: any) {
            Alert.alert("Error", e.message);
        }
    };

    const getStatusColor = (status: string | undefined) => {
        if (status === 'completed') return '#38bdf8'; // Blue
        if (status === 'served') return '#10b981'; // Green
        return '#f59e0b'; // Orange (Active/Kitchen)
    };

    const getStatusText = (status: string | undefined) => {
        if (status === 'completed') return 'PAID';
        if (status === 'served') return 'SERVED';
        return 'KITCHEN';
    };

    const renderOrderItem = ({ item }: { item: Order }) => {
        const isExpanded = expandedOrderId === item.id;
        const badgeColor = getStatusColor(item.status);

        return (
            <View style={styles.orderItemContainer}>
                <Pressable style={({ pressed }) => [styles.orderItemHeader, { opacity: pressed ? 0.8 : 1 }]} onPress={() => toggleExpand(item.id)}>
                    <View style={styles.headerRow}>
                        <View style={[styles.iconBox, { backgroundColor: badgeColor + '20' }]}>
                            <Ionicons name="receipt" size={24} color={badgeColor} />
                        </View>
                        <View style={styles.headerInfo}>
                            <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
                            <Text style={styles.orderMeta}>{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {item.customerName || 'Walk-in'}</Text>
                        </View>
                        <View style={styles.headerRight}>
                            <Text style={styles.orderTotal}>PKR {item.total.toFixed(0)}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: badgeColor }]}>
                                <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
                            </View>
                        </View>
                    </View>
                </Pressable>

                {isExpanded && (
                    <View style={styles.orderDetails}>
                        <View style={styles.separator} />
                        <Text style={styles.detailsHeader}>Order Items</Text>
                        {item.items.map((detail, index) => (
                            <View key={detail.id + index} style={styles.itemDetail}>
                                <Text style={styles.itemName}><Text style={styles.itemQuantity}>{detail.quantity}x </Text>{detail.name}</Text>
                                <Text style={styles.itemPrice}>PKR {(detail.price * detail.quantity).toFixed(0)}</Text>
                            </View>
                        ))}
                        
                        <View style={styles.actionRow}>
                            <Pressable style={styles.editButton} onPress={() => openEditModal(item)}>
                                <Ionicons name="pencil" size={16} color="#0f172a" />
                                <Text style={styles.editButtonText}>Edit</Text>
                            </Pressable>
                            
                            {currentUserRole === 'superadmin' && (
                                <Pressable style={styles.deleteButton} onPress={() => confirmDelete(item)}>
                                    <Ionicons name="trash-outline" size={16} color="#f8fafc" />
                                </Pressable>
                            )}
                        </View>
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
                    <Text style={styles.title}>All Orders</Text>
                </View>
                {isMobile && <Pressable onPress={() => router.back()} style={styles.backButton}><Ionicons name="close" size={24} color="#94a3b8" /></Pressable>}
            </View>
            
            {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#38bdf8" /></View> : (
                <SectionList
                    sections={sections}
                    renderItem={renderOrderItem}
                    renderSectionHeader={renderSectionHeader}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.listContent, isMobile && { paddingBottom: 120 }]}
                    stickySectionHeadersEnabled={false}
                    ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="documents-outline" size={64} color="#334155" /><Text style={styles.emptyText}>No orders found.</Text></View>}
                />
            )}

            {/* Edit Modal */}
            <Modal animationType="slide" transparent={true} visible={editModalVisible} onRequestClose={() => setEditModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.editModalContent}>
                        <Text style={styles.modalTitle}>Edit Order #{selectedOrder?.orderNumber}</Text>
                        <View style={{maxHeight: 400}}>
                            <SectionList 
                                sections={[{ title: 'Items', data: editItems }]}
                                renderItem={({ item, index }) => (
                                    <View style={styles.editItemRow}>
                                        <Text style={styles.editItemName}>{item.name}</Text>
                                        <View style={{flexDirection:'row', gap:10}}>
                                            <TextInput 
                                                style={styles.editInput} 
                                                value={String(item.quantity)} 
                                                keyboardType="numeric"
                                                onChangeText={(val) => handleItemChange(index, 'quantity', val)}
                                            />
                                            <TextInput 
                                                style={styles.editInput} 
                                                value={String(item.price)} 
                                                keyboardType="numeric"
                                                onChangeText={(val) => handleItemChange(index, 'price', val)}
                                            />
                                        </View>
                                    </View>
                                )}
                                keyExtractor={(item, index) => String(index)}
                            />
                        </View>
                        <View style={styles.modalBtnRow}>
                            <Pressable style={styles.modalCancel} onPress={() => setEditModalVisible(false)}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
                            <Pressable style={styles.modalSave} onPress={saveChanges}><Text style={styles.modalSaveText}>Save Changes</Text></Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal animationType="fade" transparent={true} visible={confirmModalVisible} onRequestClose={() => setConfirmModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.confirmModalContent}>
                        <View style={styles.modalIconCircle}><Ionicons name="alert" size={32} color="#ef4444" /></View>
                        <Text style={styles.confirmTitle}>Delete Order?</Text>
                        {selectedOrder && (
                            <View style={styles.confirmDetailsCard}>
                                <Text style={styles.confirmInfoText}>Delete order <Text style={{fontWeight: 'bold', color: '#f8fafc'}}>#{selectedOrder.orderNumber}</Text>?</Text>
                                <Text style={styles.confirmWarning}>This is permanent.</Text>
                            </View>
                        )}
                        <View style={styles.confirmButtonContainer}>
                            <Pressable style={[styles.confirmButton, styles.cancelButton]} onPress={() => setConfirmModalVisible(false)}><Text style={styles.confirmButtonText}>Cancel</Text></Pressable>
                            <Pressable style={[styles.confirmButton, styles.deleteConfirmButton]} onPress={performDelete}><Text style={[styles.confirmButtonText, { color: '#fee2e2' }]}>Delete</Text></Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, backgroundColor: 'rgba(15, 23, 42, 0.95)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', zIndex: 10 },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
    backButton: { padding: 8, borderRadius: 20, backgroundColor: '#1e293b' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
    listContent: { padding: 20 },
    emptyContainer: { alignItems: 'center', marginTop: 60, opacity: 0.7 },
    emptyText: { color: '#94a3b8', fontSize: 18, marginTop: 16, fontWeight: '600' },
    
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12, paddingHorizontal: 8 },
    sectionDate: { fontSize: 14, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
    sectionTotalBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(56, 189, 248, 0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    sectionTotalLabel: { fontSize: 12, color: '#94a3b8', marginRight: 6, fontWeight: '600' },
    sectionTotalValue: { fontSize: 14, fontWeight: '800', color: '#38bdf8' },

    orderItemContainer: { backgroundColor: '#1e293b', borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
    orderItemHeader: { padding: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    headerInfo: { flex: 1 },
    orderNumber: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 2 },
    orderMeta: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
    headerRight: { alignItems: 'flex-end', justifyContent: 'center' },
    orderTotal: { fontSize: 16, fontWeight: '800', color: '#38bdf8' },
    statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
    statusText: { color: '#0f172a', fontSize: 10, fontWeight: '800' },

    orderDetails: { backgroundColor: '#162032', padding: 20, borderTopWidth: 1, borderTopColor: '#334155' },
    separator: { height: 1, backgroundColor: '#334155', marginBottom: 16 },
    detailsHeader: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    itemDetail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, alignItems: 'center' },
    itemName: { color: '#cbd5e1', fontSize: 15, flex: 1, paddingRight: 16 },
    itemQuantity: { color: '#38bdf8', fontWeight: '700' },
    itemPrice: { color: '#f8fafc', fontSize: 15, fontWeight: '600' },
    
    actionRow: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#334155', flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    editButton: { flexDirection: 'row', backgroundColor: '#38bdf8', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', gap: 8 },
    editButtonText: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
    deleteButton: { backgroundColor: 'rgba(239, 68, 68, 0.2)', padding: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    
    // Edit Modal
    editModalContent: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, width: '100%', maxWidth: 500, borderWidth: 1, borderColor: '#334155' },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#f8fafc', marginBottom: 20, textAlign: 'center' },
    editItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
    editItemName: { color: '#f8fafc', fontSize: 16, flex: 1 },
    editInput: { backgroundColor: '#0f172a', color: '#f8fafc', padding: 8, borderRadius: 8, width: 80, textAlign: 'center', borderWidth: 1, borderColor: '#334155' },
    modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
    modalCancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#334155', alignItems: 'center' },
    modalCancelText: { color: '#f8fafc', fontWeight: '700' },
    modalSave: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#38bdf8', alignItems: 'center' },
    modalSaveText: { color: '#0f172a', fontWeight: '700' },

    // Confirm Modal
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