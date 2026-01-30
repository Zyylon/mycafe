import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, ref, remove, runTransaction, set } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View
} from 'react-native';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { database } from '../services/firebase';

// --- Thermal Receipt Template ---
const createReceiptHtml = (order: any) => {
    const itemsHtml = order.items.map((item: any) => `
        <div class="item-row">
            <div class="qty-name">
                <span class="qty">${item.quantity}</span>
                <span class="name">${item.name}</span>
            </div>
            <div class="price">${(item.price * item.quantity).toFixed(0)}</div>
        </div>
    `).join('');

    const addressHtml = order.orderType === 'Delivery' && order.address ? `
        <div class="section-box">
            <div class="label">DELIVERY ADDRESS</div>
            <div class="value large">${order.address}</div>
        </div>
    ` : '';

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Receipt</title>
                <style>
                    @page { size: 80mm auto; margin: 0; }
                    body { 
                        width: 100%; margin: 0; padding: 10px; 
                        background-color: #fff; color: #000; 
                        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                        font-size: 12px; line-height: 1.4;
                        box-sizing: border-box;
                    }
                    .center { text-align: center; }
                    .bold { font-weight: 700; }
                    .divider { border-bottom: 2px solid #000; margin: 8px 0; }
                    .divider-thin { border-bottom: 1px dashed #000; margin: 8px 0; }
                    .brand { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
                    .meta { font-size: 10px; color: #333; }
                    .info-grid { display: flex; flex-wrap: wrap; margin-top: 10px; }
                    .info-item { width: 50%; margin-bottom: 4px; }
                    .label { font-size: 9px; text-transform: uppercase; color: #444; }
                    .value { font-size: 11px; font-weight: 700; }
                    .value.large { font-size: 12px; }
                    .item-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
                    .qty-name { display: flex; align-items: flex-start; flex: 1; padding-right: 5px; }
                    .qty { font-weight: 700; min-width: 20px; }
                    .name { flex: 1; }
                    .price { font-weight: 700; white-space: nowrap; }
                    .total-section { margin-top: 10px; padding-top: 5px; border-top: 2px solid #000; }
                    .total-row { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
                    .total-label { font-size: 14px; font-weight: 700; text-transform: uppercase; }
                    .total-amount { font-size: 18px; font-weight: 900; }
                    .section-box { border: 1px solid #000; border-radius: 4px; padding: 5px; margin: 10px 0; background: #f8f8f8; -webkit-print-color-adjust: exact; }
                    .footer { text-align: center; margin-top: 20px; font-size: 10px; }
                    .order-id { font-size: 14px; font-weight: 700; margin-top: 5px; border: 1px solid #000; display: inline-block; padding: 2px 8px; border-radius: 4px; }
                    ::-webkit-scrollbar { display: none; }
                </style>
            </head>
            <body>
                <div class="center">
                    <div class="brand">Slice n' Spice</div>
                    <div class="meta">${new Date().toLocaleDateString()} &bull; ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
                <div class="divider"></div>
                <div class="info-grid">
                    <div class="info-item"><div class="label">Type</div><div class="value">${order.orderType}</div></div>
                    <div class="info-item"><div class="label">Payment</div><div class="value">${order.paymentMethod}</div></div>
                    <div class="info-item"><div class="label">Customer</div><div class="value">${order.customerName || 'Walk-in'}</div></div>
                    <div class="info-item"><div class="label">Staff</div><div class="value">${order.staffName}</div></div>
                </div>
                ${order.customerPhone ? `<div style="margin-top: 4px;"><div class="label">Contact</div><div class="value">${order.customerPhone}</div></div>` : ''}
                <div class="divider-thin"></div>
                <div style="min-height: 50px;">${itemsHtml}</div>
                <div class="total-section">
                    <div class="total-row"><span class="total-label">Total</span><span class="total-amount">PKR ${order.total.toFixed(0)}</span></div>
                </div>
                ${addressHtml}
                <div class="footer">
                    <div>Thank you for your order!</div>
                    <div class="order-id">#${order.orderNumber}</div>
                </div>
            </body>
        </html>
    `;
};

export default function CheckoutScreen() {
    const router = useRouter();
    const params = useLocalSearchParams(); // <--- GET PARAMS
    const { userData, cart: globalCart, clearCart } = useAuth();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    
    // --- DETERMINE MODE (New Order vs Complete Existing) ---
    const mode = params.mode === 'complete' ? 'complete' : 'new';
    
    // Resolve Data Source
    const items = mode === 'complete' && params.cart 
        ? JSON.parse(params.cart as string) 
        : globalCart;

    const totalAmount = mode === 'complete' && params.total 
        ? parseFloat(params.total as string) 
        : globalCart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const existingData = mode === 'complete' && params.existingData
        ? JSON.parse(params.existingData as string)
        : {};

    // --- State ---
    const [name, setName] = useState(existingData.customerName || '');
    const [phone, setPhone] = useState(existingData.customerPhone || '');
    const [address, setAddress] = useState(existingData.address || '');
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Cash');
    const [orderType, setOrderType] = useState<'Dine-in' | 'Take Away' | 'Delivery'>(existingData.orderType || 'Dine-in');
    
    // UI State
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const isLargeScreen = width >= 1024;

    // --- Receipt Injection ---
    useEffect(() => {
        if (showPreviewModal && isWeb && iframeRef.current && previewHtml) {
            setTimeout(() => {
                const doc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
                if (doc) {
                    doc.open();
                    doc.write(previewHtml);
                    doc.close();
                }
            }, 100);
        }
    }, [showPreviewModal, previewHtml]);

    const handleBack = () => {
        if (mode === 'complete') router.back();
        else router.push('/dashboard');
    };

    const handleCancelOrder = () => {
        Alert.alert("Discard", mode === 'complete' ? "Cancel payment?" : "Clear cart?", [
            { text: "No", style: "cancel" },
            { 
                text: "Yes", 
                style: "destructive", 
                onPress: () => { 
                    if (mode === 'new') clearCart(); 
                    handleBack();
                }
            }
        ]);
    };

    // --- Empty State (Only relevant for New Orders) ---
    if (items.length === 0) {
        return (
            <View style={styles.emptyPage}>
                <View style={styles.emptyContainer}>
                    <Ionicons name="cart-outline" size={80} color="#334155" />
                    <Text style={styles.emptyTitle}>Cart is empty</Text>
                    <Pressable style={styles.backToMenuBtn} onPress={() => router.push('/dashboard')}>
                        <Text style={styles.backToMenuText}>Back to Menu</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    const preparePreview = () => {
        if (orderType === 'Delivery' && !address.trim()) {
            return Alert.alert('Missing Info', 'Please enter a delivery address.');
        }

        const tempOrder = {
            items,
            total: totalAmount,
            customerName: name,
            customerPhone: phone,
            paymentMethod,
            orderType,
            address,
            orderNumber: existingData.orderNumber || '###',
            staffName: userData?.username || 'Staff',
            date: Date.now()
        };

        setPreviewHtml(createReceiptHtml(tempOrder));
        setShowPreviewModal(true);
    };

    const handleConfirmAndPrint = async (shouldPrint: boolean) => {
        setIsProcessing(true);
        try {
            let finalOrderId = params.orderId as string;
            let finalOrderNumber = existingData.orderNumber;

            // 1. If NEW ORDER: Generate ID & Number
            if (mode === 'new') {
                const orderCounterRef = ref(database, 'counters/orders');
                const transactionResult = await runTransaction(orderCounterRef, (count) => (count || 100) + 1);
                if (!transactionResult.committed) throw new Error("ID Gen Failed");
                
                finalOrderNumber = String(transactionResult.snapshot.val());
                finalOrderId = `order_${finalOrderNumber}_${Date.now()}`;
            }

            // 2. Prepare Data
            const finalOrderData = {
                id: finalOrderId,
                orderNumber: finalOrderNumber,
                date: existingData.date || Date.now(), // Preserve original date if completing
                items,
                total: totalAmount,
                customerName: name,
                customerPhone: phone,
                paymentMethod,
                orderType,
                staffName: userData?.username || 'Staff',
                ...(orderType === 'Delivery' && { address }),
                
                // If 'complete' mode -> It goes to history (Completed)
                // If 'new' mode -> It goes to kitchen (Pending)
                status: mode === 'complete' ? 'completed' : 'pending',
                completedAt: mode === 'complete' ? Date.now() : null
            };

            // 3. Database Write
            if (mode === 'complete') {
                // Move from Ongoing -> History
                await set(ref(database, `orders/${finalOrderId}`), finalOrderData);
                await remove(ref(database, `ongoing_orders/${finalOrderId}`));
            } else {
                // Save to Ongoing (Kitchen)
                await set(ref(database, `ongoing_orders/${finalOrderId}`), finalOrderData);
            }

            // 4. Printing
            if (shouldPrint && isWeb && iframeRef.current) {
                const win = iframeRef.current?.contentWindow;
                if (win) { win.focus(); win.print(); }
                setTimeout(() => finalizeFlow(), 1000);
            } else {
                if(shouldPrint && !isWeb) Alert.alert("Success", "Saved (No Native Print)");
                finalizeFlow();
            }

        } catch (error: any) {
            Alert.alert('Error', error.message);
            setIsProcessing(false);
        }
    };

    const finalizeFlow = () => {
        setShowPreviewModal(false);
        if (mode === 'new') clearCart();
        router.replace('/(tabs)/ongoing-orders');
        setIsProcessing(false);
    };

    return (
        <View style={styles.pageContainer}>
             <View style={styles.header}>
                <View style={{flexDirection:'row', alignItems:'center', gap: 12}}>
                    <Pressable onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#f8fafc" />
                    </Pressable>
                    <View>
                        <Text style={styles.headerTitle}>{mode === 'complete' ? 'Finalize Order' : 'New Order'}</Text>
                        {mode === 'complete' && <Text style={styles.headerSub}>#{existingData.orderNumber}</Text>}
                    </View>
                </View>
                <View style={styles.totalBadge}>
                    <Text style={styles.totalBadgeLabel}>TOTAL DUE</Text>
                    <Text style={styles.totalBadgeValue}>PKR {totalAmount.toFixed(0)}</Text>
                </View>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Animated.View entering={FadeIn.duration(500)} style={[styles.contentLayout, isLargeScreen && styles.contentLayoutLarge]}>
                        
                        {/* LEFT: Input Forms */}
                        <View style={[styles.formColumn, isLargeScreen && { marginRight: 24 }]}>
                            
                            {/* Order Type (Only show for New Orders to avoid confusion) */}
                            {mode === 'new' && (
                                <View style={styles.cardSection}>
                                    <Text style={styles.sectionTitle}>Order Type</Text>
                                    <View style={styles.typeContainer}>
                                        {['Dine-in', 'Take Away', 'Delivery'].map((type) => (
                                            <Pressable key={type} style={[styles.typeButton, orderType === type && styles.typeButtonActive]} onPress={() => setOrderType(type as any)}>
                                                <Ionicons name={type === 'Dine-in' ? 'restaurant' : type === 'Take Away' ? 'bag-handle' : 'bicycle'} size={24} color={orderType === type ? '#0f172a' : '#94a3b8'} style={{marginBottom: 8}} />
                                                <Text style={[styles.typeButtonText, orderType === type && styles.typeButtonTextActive]}>{type}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Customer Info */}
                            <View style={styles.cardSection}>
                                <Text style={styles.sectionTitle}>Customer Details</Text>
                                <View style={styles.inputContainer}>
                                    <View style={[styles.inputWrapper, focusedInput === 'name' && styles.inputWrapperFocused]}>
                                        <Ionicons name="person-outline" size={20} color={focusedInput === 'name' ? "#38bdf8" : "#64748b"} style={styles.inputIcon} />
                                        <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#64748b" value={name} onChangeText={setName} onFocus={() => setFocusedInput('name')} onBlur={() => setFocusedInput(null)} />
                                    </View>
                                    <View style={[styles.inputWrapper, focusedInput === 'phone' && styles.inputWrapperFocused]}>
                                        <Ionicons name="call-outline" size={20} color={focusedInput === 'phone' ? "#38bdf8" : "#64748b"} style={styles.inputIcon} />
                                        <TextInput style={styles.input} placeholder="Phone Number" placeholderTextColor="#64748b" keyboardType="phone-pad" value={phone} onChangeText={setPhone} onFocus={() => setFocusedInput('phone')} onBlur={() => setFocusedInput(null)} />
                                    </View>
                                    {orderType === 'Delivery' && (
                                        <View style={[styles.inputWrapper, { height: 100, alignItems: 'flex-start', paddingTop: 12 }, focusedInput === 'address' && styles.inputWrapperFocused]}>
                                            <Ionicons name="location-outline" size={20} color={focusedInput === 'address' ? "#38bdf8" : "#64748b"} style={styles.inputIcon} />
                                            <TextInput style={[styles.input, { textAlignVertical: 'top' }]} placeholder="Full Delivery Address" placeholderTextColor="#64748b" value={address} onChangeText={setAddress} onFocus={() => setFocusedInput('address')} onBlur={() => setFocusedInput(null)} multiline />
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Payment */}
                            <View style={styles.cardSection}>
                                <Text style={styles.sectionTitle}>Payment Method</Text>
                                <View style={styles.paymentRow}>
                                     {['Cash', 'Card'].map(m => (
                                        <Pressable key={m} style={[styles.paymentCard, paymentMethod === m && styles.paymentCardActive]} onPress={() => setPaymentMethod(m as any)}>
                                            <Ionicons name={m === 'Cash' ? "cash-outline" : "card-outline"} size={24} color={paymentMethod === m ? "#0f172a" : "#94a3b8"} />
                                            <Text style={[styles.paymentText, paymentMethod === m && styles.paymentTextActive]}>{m}</Text>
                                            {paymentMethod === m && <View style={styles.checkBadge}><Ionicons name="checkmark" size={12} color="white" /></View>}
                                        </Pressable>
                                     ))}
                                </View>
                            </View>
                        </View>

                        {/* RIGHT: Summary */}
                        <View style={[styles.summaryColumn, isLargeScreen && { flex: 1 }]}>
                            <View style={styles.floatingSummaryCard}>
                                <Text style={styles.summaryHeader}>Order Summary</Text>
                                <ScrollView style={styles.cartItemsScroll} showsVerticalScrollIndicator={false}>
                                    {items.map((item: any, index: number) => (
                                        <View key={`${item.id}-${index}`} style={styles.summaryItemRow}>
                                            <Text style={styles.summaryItemQty}>{item.quantity}x</Text>
                                            <View style={{flex: 1, paddingHorizontal: 10}}>
                                                <Text style={styles.summaryItemName} numberOfLines={1}>{item.name}</Text>
                                            </View>
                                            <Text style={styles.summaryItemPrice}>{item.price * item.quantity}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                                
                                <View style={styles.totalSection}>
                                    <View style={styles.totalLine} />
                                    <View style={styles.totalRow}>
                                        <Text style={styles.totalLabel}>Grand Total</Text>
                                        <Text style={styles.totalValue}>PKR {totalAmount.toFixed(0)}</Text>
                                    </View>
                                </View>
                                
                                <View style={styles.actionGroup}>
                                    <Pressable style={({pressed}) => [styles.placeOrderBtn, pressed && {opacity: 0.9}]} onPress={preparePreview}>
                                        <Text style={styles.placeOrderBtnText}>{mode === 'complete' ? 'Complete & Print' : 'Place Order'}</Text>
                                        <Ionicons name="checkmark-done-circle" size={24} color="#0f172a" />
                                    </Pressable>
                                    <Pressable style={styles.cancelBtn} onPress={handleCancelOrder}>
                                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                        <Text style={styles.cancelBtnText}>Discard</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Receipt Modal */}
            <Modal visible={showPreviewModal} transparent={true} animationType="fade" onRequestClose={() => setShowPreviewModal(false)}>
                <View style={styles.modalOverlay}>
                    <Animated.View entering={SlideInUp.springify()} style={[styles.modalContent, { maxWidth: 420 }]}> 
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{mode === 'complete' ? 'Receipt Ready' : 'Confirm Order'}</Text>
                            <Pressable onPress={() => setShowPreviewModal(false)}><Ionicons name="close" size={24} color="#94a3b8" /></Pressable>
                        </View>
                        
                        <View style={styles.previewFrameContainer}>
                            {isWeb ? (
                                <iframe ref={iframeRef} style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' }} />
                            ) : (
                                <View style={{padding: 40, alignItems: 'center'}}>
                                    <Ionicons name="receipt-outline" size={64} color="#334155" />
                                    <Text style={{color: '#94a3b8', marginTop: 16, textAlign: 'center'}}>Thermal preview available on Web.</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.modalFooter}>
                            <Pressable style={styles.actionBtnSecondary} onPress={() => handleConfirmAndPrint(false)} disabled={isProcessing}>
                                <Text style={styles.actionBtnTextSecondary}>{mode === 'complete' ? 'Complete (No Print)' : 'Send to Kitchen'}</Text>
                            </Pressable>
                            <Pressable style={styles.actionBtnPrimary} onPress={() => handleConfirmAndPrint(true)} disabled={isProcessing}>
                                {isProcessing ? <ActivityIndicator color="#0f172a" /> : (
                                    <>
                                        <Ionicons name="print" size={20} color="#0f172a" />
                                        <Text style={styles.actionBtnTextPrimary}>Print & Complete</Text>
                                    </>
                                )}
                            </Pressable>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    pageContainer: { flex: 1, backgroundColor: '#0f172a' },
    
    emptyPage: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { alignItems: 'center' },
    emptyTitle: { color: '#f8fafc', fontSize: 24, fontWeight: '800', marginVertical: 16 },
    backToMenuBtn: { backgroundColor: '#38bdf8', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
    backToMenuText: { color: '#0f172a', fontWeight: '700' },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20, backgroundColor: 'rgba(15, 23, 42, 0.95)', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    headerTitle: { color: '#f8fafc', fontSize: 24, fontWeight: '800' },
    headerSub: { color: '#38bdf8', fontSize: 16, fontWeight: '700' },
    backButton: { padding: 8, borderRadius: 12, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
    
    totalBadge: { alignItems: 'flex-end' },
    totalBadgeLabel: { color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
    totalBadgeValue: { color: '#38bdf8', fontSize: 20, fontWeight: '800' },

    scrollContent: { padding: 24 },
    contentLayout: { flexDirection: 'column', gap: 24 },
    contentLayoutLarge: { flexDirection: 'row', alignItems: 'flex-start' },
    
    formColumn: { flex: 2, gap: 24 },
    cardSection: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#334155', shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 12 },
    sectionTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
    
    typeContainer: { flexDirection: 'row', gap: 12 },
    typeButton: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: '#0f172a', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
    typeButtonActive: { backgroundColor: '#38bdf8', borderColor: '#38bdf8' },
    typeButtonText: { color: '#94a3b8', fontWeight: '700', fontSize: 12 },
    typeButtonTextActive: { color: '#0f172a' },

    inputContainer: { gap: 16 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 16, height: 56 },
    inputWrapperFocused: { borderColor: '#38bdf8' },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, height: '100%', color: '#f8fafc', fontSize: 16, ...Platform.select({ web: { outlineStyle: 'none' } }) },

    paymentRow: { flexDirection: 'row', gap: 16 },
    paymentCard: { flex: 1, flexDirection: 'row', padding: 20, backgroundColor: '#0f172a', borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155', position: 'relative' },
    paymentCardActive: { backgroundColor: 'rgba(56, 189, 248, 0.1)', borderColor: '#38bdf8' },
    paymentText: { color: '#94a3b8', fontWeight: '700', fontSize: 15, marginLeft: 12 },
    paymentTextActive: { color: '#38bdf8' },
    checkBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: '#0f172a', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },

    summaryColumn: { minWidth: 320 },
    floatingSummaryCard: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#334155', shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
    summaryHeader: { color: '#f8fafc', fontSize: 18, fontWeight: '800', marginBottom: 16 },
    cartItemsScroll: { maxHeight: 300 },
    summaryItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    summaryItemQty: { color: '#38bdf8', fontWeight: '700', width: 30 },
    summaryItemName: { color: '#cbd5e1', fontSize: 15 },
    summaryItemPrice: { color: '#f8fafc', fontWeight: '600', marginLeft: 'auto' },
    
    totalSection: { marginTop: 16 },
    totalLine: { height: 1, backgroundColor: '#334155', marginBottom: 16 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    totalLabel: { color: '#94a3b8', fontSize: 16 },
    totalValue: { color: '#38bdf8', fontSize: 24, fontWeight: '900' },

    actionGroup: { gap: 12 },
    placeOrderBtn: { backgroundColor: '#38bdf8', borderRadius: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#38bdf8', shadowOpacity: 0.3, elevation: 6 },
    placeOrderBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 18 },
    cancelBtn: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    cancelBtnText: { color: '#ef4444', fontWeight: '700' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', backgroundColor: '#1e293b', borderRadius: 24, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#334155' },
    modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
    previewFrameContainer: { height: 400, backgroundColor: '#fff' },
    modalFooter: { padding: 20, flexDirection: 'row', gap: 12, borderTopWidth: 1, borderColor: '#334155' },
    actionBtnSecondary: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
    actionBtnTextSecondary: { color: '#f8fafc', fontWeight: '700' },
    actionBtnPrimary: { flex: 2, padding: 16, borderRadius: 12, backgroundColor: '#38bdf8', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    actionBtnTextPrimary: { color: '#0f172a', fontWeight: '800' },
});