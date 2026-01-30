import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onValue, ref, update } from 'firebase/database';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import Animated, { FadeInDown, Layout, ZoomIn } from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import { auth, database } from '../../services/firebase';

// --- Types ---
interface KitchenOrder {
    id: string;
    orderNumber: string;
    orderType: string;
    customerName?: string;
    date: number;
    items: { name: string; quantity: number; isAddedLater?: boolean }[];
    status: string;
}

export default function KitchenScreen() {
    const router = useRouter();
    const { userData } = useAuth();
    const [orders, setOrders] = useState<KitchenOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const { width } = useWindowDimensions();
    const [currentTime, setCurrentTime] = useState(new Date());

    const isKitchenUser = userData?.role === 'kitchen';

    // --- Clock Logic ---
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // --- SCALING ENGINE ---
    const scale = useMemo(() => {
        const baseWidth = 1200;
        const calculated = width / baseWidth;
        // Clamp scale to prevent it getting too small or massive
        return Math.min(Math.max(calculated, 0.75), 1.2); 
    }, [width]);

    // Responsive Columns
    const numColumns = useMemo(() => {
        if (width > 1600) return 5;
        if (width > 1300) return 4;
        if (width > 900) return 3;
        if (width > 600) return 2;
        return 1;
    }, [width]);

    // --- Data Fetching ---
    useEffect(() => {
        const ordersRef = ref(database, 'ongoing_orders');
        const unsubscribe = onValue(ordersRef, (snapshot) => {
            const data = snapshot.val();
            const allOrders: KitchenOrder[] = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
            
            // 1. Filter Active
            const pendingOrders = allOrders.filter(o => o.status !== 'served');
            
            // 2. Sort: Oldest First (Priority)
            pendingOrders.sort((a, b) => a.date - b.date);

            setOrders(pendingOrders);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const markReady = async (orderId: string) => {
        // Optimistic update for speed
        setOrders(prev => prev.filter(o => o.id !== orderId));
        await update(ref(database, `ongoing_orders/${orderId}`), { status: 'served' });
    };

    // --- Dynamic Sizing ---
    const DS = {
        title: 24 * scale,
        qty: 32 * scale,
        item: 15 * scale,
        gap: 10 * scale,
        pillPad: 16 * scale,
        cardPad: 16 * scale,
    };

    const renderTicket = ({ item, index }: { item: KitchenOrder, index: number }) => {
        const elapsedMins = Math.floor((Date.now() - item.date) / 60000);
        const isLate = elapsedMins > 20; 

        // Sort items: New additions first, then original
        const sortedItems = [...item.items].sort((a, b) => {
            if (a.isAddedLater && !b.isAddedLater) return -1;
            if (!a.isAddedLater && b.isAddedLater) return 1;
            return 0;
        });

        const hasUpdates = item.items.some(i => i.isAddedLater);

        return (
            <Animated.View 
                // Apple Stacking Effect: Items slide up from bottom
                entering={FadeInDown.delay(index * 50).springify().damping(14)} 
                layout={Layout.springify()}
                style={[
                    styles.ticketCard, 
                    isLate && styles.ticketLate,
                    hasUpdates && styles.ticketUpdated
                ]}
            >
                {/* --- HEADER --- */}
                <View style={[
                    styles.cardHeader,
                    hasUpdates && styles.headerUpdated,
                    isLate && !hasUpdates && styles.headerLate
                ]}>
                    <View>
                        <View style={{flexDirection:'row', alignItems:'center', gap: 8}}>
                            <Text style={[styles.ticketId, { fontSize: DS.title }, hasUpdates && {color:'white'}]}>
                                #{item.orderNumber}
                            </Text>
                            {hasUpdates && (
                                <View style={styles.updateBadge}>
                                    <Ionicons name="flash" size={10} color="#0f172a" />
                                    <Text style={styles.updateText}>UPDATED</Text>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.ticketType, hasUpdates && {color:'#e0f2fe'}]}>
                            {item.orderType} • {item.customerName || 'Guest'}
                        </Text>
                    </View>
                    <View style={styles.timerContainer}>
                        <Text style={[styles.timerText, hasUpdates && {color:'white'}]}>{elapsedMins}m</Text>
                    </View>
                </View>

                {/* --- ITEMS GRID --- */}
                <View style={[styles.cardBody, { padding: DS.cardPad, gap: DS.gap }]}>
                    <View style={styles.itemsGrid}>
                        {sortedItems.map((prod, i) => (
                            <Animated.View 
                                key={`${prod.name}-${i}`} 
                                entering={ZoomIn.delay(i*50)}
                                style={[
                                    styles.itemTile,
                                    prod.isAddedLater && styles.itemTileNew
                                ]}
                            >
                                <View style={styles.qtyContainer}>
                                    <Text style={[
                                        styles.qtyText, 
                                        { fontSize: DS.qty },
                                        prod.isAddedLater && { color: '#38bdf8' }
                                    ]}>{prod.quantity}</Text>
                                </View>
                                <Text style={[
                                    styles.itemName, 
                                    { fontSize: DS.item },
                                    prod.isAddedLater && { color: '#fff', fontWeight:'800' }
                                ]} numberOfLines={3}>
                                    {prod.name}
                                </Text>
                            </Animated.View>
                        ))}
                    </View>
                </View>

                {/* --- FOOTER --- */}
                <TouchableOpacity style={styles.doneBtn} onPress={() => markReady(item.id)}>
                    <Text style={styles.doneBtnText}>COMPLETE</Text>
                    <Ionicons name="checkmark-done" size={24} color="#0f172a" />
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <View style={styles.container}>
            
            {/* --- FLOATING HEADER PILLS --- */}
            <View style={[styles.floatingHeader, { top: Platform.OS === 'web' ? 24 : 50 }]}>
                
                {/* Left: Page Title / Active Count */}
                <View style={styles.pillContainer}>
                    {/* Back Button (Only for Non-Kitchen Roles) */}
                    {!isKitchenUser && (
                        <TouchableOpacity style={styles.iconPill} onPress={() => router.back()}>
                            <Ionicons name="arrow-back" size={24} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                    
                    <View style={styles.infoPill}>
                        <Ionicons name="restaurant" size={20} color="#38bdf8" />
                        <Text style={styles.infoPillTitle}>KITCHEN DISPLAY</Text>
                        <View style={styles.countBadge}>
                            <Text style={styles.countText}>{orders.length}</Text>
                        </View>
                    </View>
                </View>

                {/* Right: Time / Exit */}
                <View style={styles.pillContainer}>
                    <View style={styles.timePill}>
                        <Text style={styles.timePillText}>
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>

                    {/* Exit Button (Only for Kitchen Role) */}
                    {isKitchenUser && (
                        <TouchableOpacity style={styles.exitPill} onPress={() => auth.signOut()}>
                            <Text style={styles.exitText}>EXIT</Text>
                            <Ionicons name="log-out" size={18} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* --- CONTENT AREA --- */}
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#38bdf8" /></View>
            ) : orders.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="checkmark-done-circle" size={100} color="#334155" />
                    <Text style={styles.emptyText}>ALL CLEAR</Text>
                    <Text style={styles.emptySubText}>Waiting for new orders...</Text>
                </View>
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={item => item.id}
                    renderItem={renderTicket}
                    contentContainerStyle={{ 
                        paddingTop: 100, // Space for floating header
                        paddingHorizontal: 16, 
                        paddingBottom: 40 
                    }}
                    numColumns={numColumns}
                    key={`grid-${numColumns}`} // Force re-render on resize
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // --- FLOATING HEADER STYLES ---
    floatingHeader: {
        position: 'absolute', left: 24, right: 24, zIndex: 100,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
    },
    pillContainer: { flexDirection: 'row', gap: 12 },
    
    // Pills
    iconPill: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        borderWidth: 1, borderColor: '#334155',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: "#000", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6
    },
    infoPill: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        paddingVertical: 10, paddingHorizontal: 20, borderRadius: 100,
        borderWidth: 1, borderColor: '#334155',
        shadowColor: "#000", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6
    },
    infoPillTitle: { color: '#f8fafc', fontWeight: '800', fontSize: 16, letterSpacing: 1 },
    countBadge: { backgroundColor: '#38bdf8', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    countText: { color: '#0f172a', fontWeight: '800', fontSize: 14 },

    timePill: {
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        paddingVertical: 12, paddingHorizontal: 24, borderRadius: 100,
        borderWidth: 1, borderColor: '#334155',
    },
    timePillText: { color: '#94a3b8', fontWeight: '700', fontSize: 16, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

    exitPill: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#ef4444',
        paddingVertical: 12, paddingHorizontal: 24, borderRadius: 100,
        shadowColor: "#ef4444", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6
    },
    exitText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 1 },

    // --- TICKET CARD ---
    ticketCard: { 
        flex: 1, margin: 8,
        backgroundColor: '#1e293b', 
        borderRadius: 24, overflow: 'hidden',
        borderWidth: 1, borderColor: '#334155',
        shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8
    },
    ticketLate: { borderColor: '#ef4444', borderWidth: 2 },
    ticketUpdated: { borderColor: '#38bdf8', borderWidth: 2 },

    // Ticket Header
    cardHeader: { 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', 
        padding: 20, backgroundColor: '#162032', borderBottomWidth: 1, borderBottomColor: '#334155' 
    },
    headerUpdated: { backgroundColor: '#0284c7' },
    headerLate: { backgroundColor: '#450a0a' },

    ticketId: { color: '#f8fafc', fontWeight: '900' },
    ticketType: { color: '#94a3b8', fontWeight: '600', fontSize: 13, marginTop: 4, textTransform: 'uppercase' },
    
    updateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
    updateText: { color: '#0f172a', fontWeight: '900', fontSize: 10 },

    timerContainer: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    timerText: { color: '#94a3b8', fontWeight: '700', fontSize: 16 },

    // Grid System
    cardBody: { flex: 1 },
    itemsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    
    // Items
    itemTile: { 
        width: '48%', // 2 per row inside card
        backgroundColor: '#0f172a', 
        padding: 12, borderRadius: 12, 
        borderWidth: 1, borderColor: '#334155',
        justifyContent: 'center', alignItems: 'center',
        flexGrow: 1, minHeight: 90
    },
    itemTileNew: { 
        backgroundColor: 'rgba(56, 189, 248, 0.15)', 
        borderColor: '#38bdf8', borderWidth: 1.5,
    },
    
    qtyContainer: { marginBottom: 6 },
    qtyText: { color: '#64748b', fontWeight: '900' },
    itemName: { color: '#94a3b8', fontWeight: '600', textAlign: 'center', lineHeight: 20 },

    // Footer
    doneBtn: { 
        backgroundColor: '#10b981', 
        paddingVertical: 18, 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        marginTop: 'auto'
    },
    doneBtnText: { color: '#0f172a', fontSize: 18, fontWeight: '900', letterSpacing: 2 },

    emptyText: { color: '#64748b', fontSize: 32, fontWeight: '900', letterSpacing: 2, marginTop: 20 },
    emptySubText: { color: '#475569', fontSize: 16, fontWeight: '600', marginTop: 8 }
});