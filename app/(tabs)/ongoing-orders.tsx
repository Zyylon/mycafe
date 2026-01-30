import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onValue, ref, update } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import { database } from '../../services/firebase';

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

export default function OngoingOrdersScreen() {
    const router = useRouter();
    const { userData } = useAuth();
    
    // --- State ---
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'active' | 'served'>('active');

    const { width } = useWindowDimensions();
    const isLargeScreen = width > 900;

    // --- Data Fetching ---
    useEffect(() => {
        const ordersRef = ref(database, 'ongoing_orders');
        
        // Network timeout safety
        const timeoutId = setTimeout(() => {
            if (loading) setErrorMsg("Network timeout. Check your connection.");
        }, 10000);

        const unsubscribe = onValue(ordersRef, (snapshot) => {
            clearTimeout(timeoutId);
            try {
                const data = snapshot.val();
                const loadedOrders = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
                
                // Sort by time (Oldest active orders first usually makes sense for kitchen, but sticking to your date sort)
                loadedOrders.sort((a, b) => a.date - b.date);
                
                setOrders(loadedOrders);
                setLoading(false);
                setErrorMsg(null);
            } catch (err: any) {
                setErrorMsg("Failed to parse order data.");
                setLoading(false);
            }
        }, (error) => {
            clearTimeout(timeoutId);
            if (error.message.includes('permission')) {
                setErrorMsg("Access Denied: Permission issue.");
            } else {
                setErrorMsg(error.message);
            }
            setLoading(false);
        });

        return () => {
            unsubscribe();
            clearTimeout(timeoutId);
        };
    }, []);

    // --- Actions ---

    const markAsServed = async (orderId: string) => {
        try {
            await update(ref(database, `ongoing_orders/${orderId}`), { status: 'served' });
        } catch (e: any) {
            Alert.alert("Error", e.message);
        }
    };

    const handleComplete = (order: any) => {
        router.push({
            pathname: '/checkout',
            params: {
                mode: 'complete',
                orderId: order.id,
                orderNumber: order.orderNumber,
                cart: JSON.stringify(order.items),
                total: order.total.toString(),
                existingData: JSON.stringify(order)
            }
        });
    };

    // THIS IS THE NEW EDIT LOGIC (Redirects to Dashboard)
    const handleEditOrder = (order: any) => {
        router.push({
            pathname: '/dashboard',
            params: {
                orderId: order.id,
                mode: 'edit'
            }
        });
    };

    // --- Render Helpers ---

    const filteredOrders = orders.filter(o => 
        activeTab === 'active' ? o.status !== 'served' : o.status === 'served'
    );

    const renderCard = ({ item, index }: { item: any, index: number }) => {
        // Logic to split items into Original vs New Additions
        // If 'isAddedLater' property doesn't exist, it defaults to original.
        const originalItems = item.items ? item.items.filter((i: any) => !i.isAddedLater) : [];
        const newItems = item.items ? item.items.filter((i: any) => i.isAddedLater) : [];

        return (
            <Animated.View 
                entering={FadeInDown.delay(index * 50).duration(400)} 
                layout={LinearTransition.springify()}
                style={[styles.card, item.status === 'served' && styles.cardServed]}
            >
                {/* Header: Order # and Status */}
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.orderNum}>Order #{item.orderNumber}</Text>
                        <Text style={styles.timer}>
                            {new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </Text>
                    </View>
                    <View style={[styles.badge, item.status === 'served' ? styles.badgeServed : styles.badgePending]}>
                        <Text style={[styles.badgeText, item.status === 'served' ? {color: '#10b981'} : {color: '#f59e0b'}]}>
                            {item.status === 'served' ? 'READY' : 'PREPARING'}
                        </Text>
                    </View>
                </View>

                <View style={styles.separator} />

                <View style={styles.itemsList}>
                    {/* 1. RENDER ORIGINAL ITEMS */}
                    {originalItems.map((prod: any, i: number) => (
                        <View key={`orig-${i}`} style={styles.itemRow}>
                            <Text style={styles.itemQty}>{prod.quantity}x</Text>
                            <Text style={styles.itemName}>{prod.name}</Text>
                        </View>
                    ))}

                    {/* 2. RENDER NEW ADDITIONS (If Any) */}
                    {newItems.length > 0 && (
                        <View style={styles.newAdditionContainer}>
                            <View style={styles.newAdditionHeader}>
                                <Ionicons name="add-circle" size={14} color="#38bdf8" />
                                <Text style={styles.newAdditionTitle}>NEW ADDITION</Text>
                            </View>
                            {newItems.map((prod: any, i: number) => (
                                <View key={`new-${i}`} style={styles.itemRow}>
                                    <Text style={[styles.itemQty, {color: '#38bdf8'}]}>{prod.quantity}x</Text>
                                    <Text style={[styles.itemName, {color: '#f8fafc', fontWeight: '700'}]}>{prod.name}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* Footer: Details & Buttons */}
                <View style={styles.cardFooter}>
                    <View style={styles.metaInfo}>
                        <Text style={styles.metaText}>{item.orderType}</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.metaText}>{item.customerName || 'Guest'}</Text>
                    </View>

                    <View style={styles.actionRow}>
                        {/* EDIT BUTTON: Only if not served */}
                        {item.status !== 'served' && (
                            <TouchableOpacity style={styles.iconBtn} onPress={() => handleEditOrder(item)}>
                                <Ionicons name="pencil" size={20} color="#38bdf8" />
                            </TouchableOpacity>
                        )}

                        {/* SERVE BUTTON: Only if not served */}
                        {item.status !== 'served' && (
                            <TouchableOpacity style={styles.servedBtn} onPress={() => markAsServed(item.id)}>
                                <Text style={styles.servedBtnText}>Ready</Text>
                                <Ionicons name="checkmark" size={16} color="#0f172a" />
                            </TouchableOpacity>
                        )}

                        {/* PAY BUTTON: Only if served */}
                        {item.status === 'served' && (
                            <TouchableOpacity style={styles.completeBtn} onPress={() => handleComplete(item)}>
                                <Text style={styles.completeBtnText}>Pay</Text>
                                <Ionicons name="arrow-forward" size={16} color="#0f172a" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Animated.View>
        );
    };

    return (
        <View style={styles.container}>
            <WebScrollbarStyles />
            
            {/* Page Header */}
            <View style={styles.header}>
                <Text style={styles.pageTitle}>Order Manager</Text>
                
                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <Pressable 
                        style={[styles.tab, activeTab === 'active' && styles.activeTab]} 
                        onPress={() => setActiveTab('active')}
                    >
                        <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>Kitchen ({orders.filter(o => o.status !== 'served').length})</Text>
                    </Pressable>
                    <Pressable 
                        style={[styles.tab, activeTab === 'served' && styles.activeTab]} 
                        onPress={() => setActiveTab('served')}
                    >
                        <Text style={[styles.tabText, activeTab === 'served' && styles.activeTabText]}>Served ({orders.filter(o => o.status === 'served').length})</Text>
                    </Pressable>
                </View>
            </View>

            {/* Content Body */}
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#38bdf8" /></View>
            ) : errorMsg ? (
                <View style={styles.center}>
                    <Ionicons name="warning-outline" size={48} color="#ef4444" />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace('/(tabs)/ongoing-orders')}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : filteredOrders.length === 0 ? (
                <Animated.View entering={FadeIn} style={styles.center}>
                    <Ionicons name="file-tray-outline" size={64} color="#334155" />
                    <Text style={styles.emptyText}>No {activeTab === 'active' ? 'pending' : 'served'} orders</Text>
                </Animated.View>
            ) : (
                <FlatList
                    data={filteredOrders}
                    keyExtractor={item => item.id}
                    renderItem={renderCard}
                    contentContainerStyle={styles.listContent}
                    numColumns={isLargeScreen ? 3 : 1}
                    key={isLargeScreen ? 'grid' : 'list'}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    
    // Header Styles
    header: { 
        padding: 24, paddingBottom: 16, backgroundColor: 'rgba(15, 23, 42, 0.95)', 
        borderBottomWidth: 1, borderBottomColor: '#1e293b', gap: 16
    },
    pageTitle: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
    
    // Tab Styles
    tabContainer: { flexDirection: 'row', backgroundColor: '#1e293b', padding: 4, borderRadius: 12, alignSelf: 'flex-start' },
    tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
    activeTab: { backgroundColor: '#38bdf8' },
    tabText: { color: '#94a3b8', fontWeight: '600', fontSize: 13 },
    activeTabText: { color: '#0f172a', fontWeight: '700' },

    // List Styles
    listContent: { padding: 16, paddingBottom: 100 },
    errorText: { color: '#ef4444', marginTop: 12, fontSize: 16, textAlign: 'center' },
    emptyText: { color: '#64748b', marginTop: 16, fontSize: 18, fontWeight: '600' },
    retryBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#334155', borderRadius: 8 },
    retryText: { color: '#f8fafc', fontWeight: '700' },

    // --- Card Styles ---
    card: { 
        backgroundColor: '#1e293b', borderRadius: 16, padding: 20, margin: 8, 
        borderLeftWidth: 4, borderLeftColor: '#f59e0b', // Default Orange
        flex: 1, minWidth: 300, maxWidth: 600,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
    },
    cardServed: { borderLeftColor: '#10b981' },

    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    orderNum: { color: '#f8fafc', fontWeight: '800', fontSize: 18 },
    timer: { color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 4 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#0f172a' },
    badgePending: { backgroundColor: 'rgba(245, 158, 11, 0.1)' },
    badgeServed: { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
    badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

    separator: { height: 1, backgroundColor: '#334155', marginBottom: 12 },
    
    // Items
    itemsList: { marginBottom: 16, gap: 8 },
    itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
    itemQty: { color: '#38bdf8', fontWeight: '800', width: 32, fontSize: 15 },
    itemName: { color: '#cbd5e1', fontSize: 15, flex: 1, fontWeight: '500' },

    // New Addition Styles (Special Highlight)
    newAdditionContainer: { 
        marginTop: 12, 
        paddingTop: 12, 
        borderTopWidth: 1, 
        borderTopColor: '#334155', 
        borderStyle: 'dashed' 
    },
    newAdditionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    newAdditionTitle: { color: '#38bdf8', fontSize: 11, fontWeight: '800', letterSpacing: 1 },

    // Footer Actions
    cardFooter: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    metaInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    metaText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
    metaDot: { color: '#64748b', marginHorizontal: 4 },

    actionRow: { flexDirection: 'row', gap: 10 },
    iconBtn: { 
        width: 36, height: 36, borderRadius: 10, 
        backgroundColor: 'rgba(56, 189, 248, 0.1)', // Light Blue Tint for Edit
        justifyContent: 'center', alignItems: 'center' 
    },
    servedBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#10b981', borderRadius: 10 },
    servedBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
    completeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#38bdf8', borderRadius: 10 },
    completeBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
});