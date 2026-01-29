import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { push, ref, runTransaction, set } from 'firebase/database';
import React, { useRef, useState } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { database } from '../services/firebase';

// --- Types ---
interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

const createReceiptHtml = (order: any) => {
    const itemsHtml = order.items.map((item: CartItem) => `
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
                        width: 72mm; margin: 0 auto; padding: 10px 0 20px 0; 
                        background-color: #fff; color: #000; 
                        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                        font-size: 12px; line-height: 1.4;
                    }
                    .center { text-align: center; }
                    .bold { font-weight: 700; }
                    .divider { border-bottom: 2px solid #000; margin: 8px 0; }
                    .divider-thin { border-bottom: 1px dashed #000; margin: 8px 0; }
                    .logo { max-width: 50px; display: block; margin: 0 auto 5px; opacity: 0.8; }
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
                    .credit { margin-top: 15px; text-align: center; font-size: 9px; color: #555; text-transform: uppercase; border-top: 1px solid #ddd; padding-top: 5px; }
                    ::-webkit-scrollbar { display: none; }
                </style>
            </head>
            <body>
                <div class="center">
                    <img src="https://i.ibb.co/6R223hD/slice-n-spice.png" class="logo" alt="Logo" onerror="this.style.display='none'" />
                    <div class="brand">Slice n' Spice</div>
                    <div class="meta">${new Date(order.date).toLocaleDateString()} &bull; ${new Date(order.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
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
                <div class="footer"><div>Thank you for your order!</div><div class="order-id">#${order.orderNumber || '---'}</div></div>
                <div class="credit">Designed by Infinity Crafters</div>
            </body>
        </html>
    `;
};

export default function CheckoutScreen() {
    const router = useRouter();
    const { userData, cart, clearCart } = useAuth(); // USING GLOBAL CART
    const iframeRef = useRef<HTMLIFrameElement>(null);
    
    const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Cash');
    const [orderType, setOrderType] = useState<'Dine-in' | 'Take Away' | 'Delivery'>('Dine-in');
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const isMobile = width < 1024; // Lower breakpoint for mobile/tablet view
    const isLargeScreen = width >= 1024;

    const handleBackToMenu = () => {
        router.push('/dashboard');
    };

    const handleCancelOrder = () => {
        if (isWeb) {
            if (confirm("Are you sure you want to cancel? The cart will be cleared.")) {
                clearCart();
                router.replace('/dashboard');
            }
        } else {
            Alert.alert("Cancel Order", "Are you sure? The cart will be cleared.", [
                { text: "No", style: "cancel" },
                { 
                    text: "Yes, Cancel", 
                    style: "destructive", 
                    onPress: () => { clearCart(); router.replace('/dashboard'); }
                }
            ]);
        }
    };

    if (cart.length === 0) {
        return (
            <View style={styles.emptyPage}>
                <View style={styles.emptyContainer}>
                    <Ionicons name="cart-outline" size={80} color="#334155" />
                    <Text style={styles.emptyTitle}>Your cart is empty</Text>
                    <Text style={styles.emptySub}>Add some delicious items from the menu to get started.</Text>
                    <Pressable style={styles.backToMenuBtn} onPress={handleBackToMenu}>
                        <Ionicons name="restaurant-outline" size={20} color="#0f172a" style={{marginRight: 8}} />
                        <Text style={styles.backToMenuText}>Back to Menu</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    const preparePreview = () => {
        if (orderType === 'Delivery' && !address.trim()) return Alert.alert('Error', 'Please enter a delivery address.');

        const tempOrder = {
            items: cart,
            total,
            customerName: name,
            customerPhone: phone,
            paymentMethod,
            orderType,
            address,
            orderNumber: '###',
            staffName: userData?.username || 'Staff',
            date: Date.now()
        };

        setPreviewHtml(createReceiptHtml(tempOrder));
        setShowPreviewModal(true);
    };

    const handleConfirmAndPrint = async () => {
        setIsProcessing(true);
        try {
            const orderCounterRef = ref(database, 'counters/orders');
            const transactionResult = await runTransaction(orderCounterRef, (currentCount) => (currentCount || 100) + 1);
            
            if (!transactionResult.committed) throw new Error("Failed to generate order number.");
            const newOrderNumber = transactionResult.snapshot.val();

            const newOrderRef = push(ref(database, 'orders'));
            const finalOrder = {
                id: newOrderRef.key!,
                orderNumber: String(newOrderNumber),
                date: Date.now(),
                items: cart,
                total,
                customerName: name,
                customerPhone: phone,
                paymentMethod,
                orderType,
                staffName: userData?.username || 'Staff',
                ...(orderType === 'Delivery' && { address }),
            };

            await set(newOrderRef, finalOrder);

            if (isWeb && iframeRef.current) {
                const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
                if (doc) {
                    doc.open();
                    doc.write(createReceiptHtml(finalOrder));
                    doc.close();
                }
                setTimeout(() => {
                    iframeRef.current?.contentWindow?.print();
                    setShowPreviewModal(false);
                    clearCart();
                    router.replace('/dashboard');
                }, 500);
            } else {
                 Alert.alert("Success", `Order #${newOrderNumber} Created`, [{
                        text: "Done",
                        onPress: () => {
                            setShowPreviewModal(false);
                            clearCart();
                            router.replace('/dashboard');
                        }
                }]);
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert('Error', 'Failed to process order. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <View style={styles.pageContainer}>
             <View style={styles.header}>
                <Pressable onPress={handleBackToMenu} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={20} color="#38bdf8" />
                    <Text style={styles.backToMenuTextSmall}>Back to Menu</Text>
                </Pressable>
                <Text style={styles.headerTitle}>Order Checkout</Text>
                <View style={{width: 40}} /> 
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={[styles.contentLayout, isLargeScreen && styles.contentLayoutLarge]}>
                        
                        {/* FORM COLUMN */}
                        <View style={[styles.formColumn, isLargeScreen && { marginRight: 24 }]}>
                            <View style={styles.cardSection}>
                                <Text style={styles.sectionTitle}>1. Order Type</Text>
                                <View style={styles.typeContainer}>
                                    {['Dine-in', 'Take Away', 'Delivery'].map((type) => (
                                        <Pressable key={type} style={[styles.typeButton, orderType === type && styles.typeButtonActive]} onPress={() => setOrderType(type as any)}>
                                            <Ionicons name={type === 'Dine-in' ? 'restaurant' : type === 'Take Away' ? 'bag-handle' : 'bicycle'} size={24} color={orderType === type ? '#0f172a' : '#94a3b8'} style={{marginBottom: 8}} />
                                            <Text style={[styles.typeButtonText, orderType === type && styles.typeButtonTextActive]}>{type}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.cardSection}>
                                <Text style={styles.sectionTitle}>2. Customer Details</Text>
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

                            <View style={styles.cardSection}>
                                <Text style={styles.sectionTitle}>3. Payment Method</Text>
                                <View style={styles.paymentRow}>
                                     <Pressable style={[styles.paymentCard, paymentMethod === 'Cash' && styles.paymentCardActive]} onPress={() => setPaymentMethod('Cash')}>
                                        <View style={[styles.radioOuter, paymentMethod === 'Cash' && styles.radioOuterActive]}>{paymentMethod === 'Cash' && <View style={styles.radioInner} />}</View>
                                        <Ionicons name="cash-outline" size={28} color={paymentMethod === 'Cash' ? "#0f172a" : "#94a3b8"} />
                                        <Text style={[styles.paymentText, paymentMethod === 'Cash' && styles.paymentTextActive]}>Cash Payment</Text>
                                    </Pressable>
                                    <Pressable style={[styles.paymentCard, paymentMethod === 'Card' && styles.paymentCardActive]} onPress={() => setPaymentMethod('Card')}>
                                        <View style={[styles.radioOuter, paymentMethod === 'Card' && styles.radioOuterActive]}>{paymentMethod === 'Card' && <View style={styles.radioInner} />}</View>
                                        <Ionicons name="card-outline" size={24} color={paymentMethod === 'Card' ? "#0f172a" : "#94a3b8"} />
                                        <Text style={[styles.paymentText, paymentMethod === 'Card' && styles.paymentTextActive]}>Card Payment</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>

                        {/* SUMMARY COLUMN */}
                        <View style={[styles.summaryColumn, isLargeScreen && { flex: 1 }]}>
                            <View style={styles.floatingSummaryCard}>
                                <View style={styles.summaryTopRow}>
                                    <Text style={styles.summaryHeader}>Order Summary</Text>
                                    <View style={styles.itemBadge}><Text style={styles.itemBadgeText}>{cart.reduce((a,b)=>a+b.quantity, 0)} items</Text></View>
                                </View>
                                
                                <ScrollView style={styles.cartItemsScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                                    {cart.map((item: CartItem, index: number) => (
                                        <View key={`${item.id}-${index}`} style={styles.summaryItemRow}>
                                            <View style={{flex: 1}}>
                                                <Text style={styles.summaryItemName} numberOfLines={1}>{item.name}</Text>
                                                <Text style={styles.summaryItemQty}>Qty: {item.quantity}</Text>
                                            </View>
                                            <Text style={styles.summaryItemPrice}>PKR {(item.price * item.quantity).toFixed(0)}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                                
                                <View style={styles.totalSection}>
                                    <View style={styles.totalLine} />
                                    <View style={styles.totalRow}>
                                        <Text style={styles.totalLabel}>Total Payable</Text>
                                        <Text style={styles.totalValue}>PKR {total.toFixed(0)}</Text>
                                    </View>
                                </View>
                                
                                <View style={styles.actionGroup}>
                                    <Pressable style={({pressed}) => [styles.placeOrderBtn, pressed && {opacity: 0.9}]} onPress={preparePreview}>
                                        <Text style={styles.placeOrderBtnText}>Place Order</Text>
                                        <Ionicons name="chevron-forward-circle" size={24} color="#0f172a" />
                                    </Pressable>
                                    <Pressable style={({pressed}) => [styles.cancelBtn, pressed && {opacity: 0.9}]} onPress={handleCancelOrder}>
                                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                        <Text style={styles.cancelBtnText}>Discard Order</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal visible={showPreviewModal} transparent={true} animationType="fade" onRequestClose={() => setShowPreviewModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: isMobile ? '94%' : 380 }]}> 
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Receipt Preview</Text>
                            <Pressable onPress={() => setShowPreviewModal(false)} style={styles.closeModalBtn}><Ionicons name="close" size={20} color="#94a3b8" /></Pressable>
                        </View>
                        <View style={[styles.previewFrameContainer, isMobile && { height: 400 }]}>
                            {isWeb && <iframe ref={iframeRef} srcDoc={previewHtml} style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' }} />}
                            {!isWeb && <View style={{padding: 40, alignItems: 'center'}}><Ionicons name="print-outline" size={64} color="#334155" /><Text style={{color: '#94a3b8', marginTop: 12, textAlign: 'center'}}>Preview not supported on mobile devices. Tap Print below to confirm.</Text></View>}
                        </View>
                        <View style={styles.modalFooter}>
                             <Pressable style={styles.cancelBtnModal} onPress={() => setShowPreviewModal(false)} disabled={isProcessing}><Text style={styles.cancelBtnTextModal}>Cancel</Text></Pressable>
                            <Pressable style={styles.confirmBtnModal} onPress={handleConfirmAndPrint} disabled={isProcessing}>
                                {isProcessing ? <ActivityIndicator color="#0f172a" /> : <><Ionicons name="print" size={20} color="#0f172a" style={{marginRight: 8}} /><Text style={styles.confirmBtnTextModal}>Confirm & Print</Text></>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    pageContainer: { flex: 1, backgroundColor: '#0f172a' },
    emptyPage: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { alignItems: 'center', padding: 32 },
    emptyTitle: { color: '#f8fafc', fontSize: 24, fontWeight: '800', marginTop: 24, marginBottom: 8 },
    emptySub: { color: '#94a3b8', fontSize: 16, textAlign: 'center', marginBottom: 32, maxWidth: 300 },
    backToMenuBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#38bdf8', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16 },
    backToMenuText: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
    
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20, backgroundColor: 'rgba(15, 23, 42, 0.95)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', zIndex: 10 },
    headerTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '800' },
    backButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
    backToMenuTextSmall: { color: '#38bdf8', fontSize: 13, fontWeight: '700', marginLeft: 6 },
    
    scrollContent: { padding: 16, paddingBottom: 100 },
    contentLayout: { flexDirection: 'column', gap: 20 },
    contentLayoutLarge: { flexDirection: 'row', alignItems: 'flex-start', padding: 24 },
    
    formColumn: { flex: 2, gap: 20 },
    cardSection: { backgroundColor: '#1e293b', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#334155', shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
    sectionTitle: { color: '#38bdf8', fontSize: 14, fontWeight: '800', marginBottom: 20, textTransform: 'uppercase', letterSpacing: 1 },
    
    typeContainer: { flexDirection: 'row', gap: 10 },
    typeButton: { flex: 1, paddingVertical: 20, borderRadius: 16, backgroundColor: '#0f172a', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
    typeButtonActive: { backgroundColor: '#38bdf8', borderColor: '#38bdf8' },
    typeButtonText: { color: '#94a3b8', fontWeight: '700', fontSize: 12, marginTop: 4 },
    typeButtonTextActive: { color: '#0f172a' },
    
    inputContainer: { gap: 12 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 16, height: 56 },
    inputWrapperFocused: { borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.05)' },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, height: '100%', color: '#f8fafc', fontSize: 16, ...Platform.select({ web: { outlineStyle: 'none' } }) },
    
    paymentRow: { flexDirection: 'row', gap: 10 },
    paymentCard: { flex: 1, flexDirection: 'row', padding: 20, backgroundColor: '#0f172a', borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155', position: 'relative' },
    paymentCardActive: { backgroundColor: 'rgba(56, 189, 248, 0.1)', borderColor: '#38bdf8' },
    paymentText: { color: '#94a3b8', fontWeight: '700', fontSize: 15, marginLeft: 16 },
    paymentTextActive: { color: '#38bdf8' },
    radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' },
    radioOuterActive: { borderColor: '#38bdf8' },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#38bdf8' },
    
    summaryColumn: { minWidth: 320 },
    floatingSummaryCard: { backgroundColor: '#1e293b', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: '#38bdf8', shadowColor: "#38bdf8", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
    summaryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    summaryHeader: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
    itemBadge: { backgroundColor: 'rgba(56, 189, 248, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    itemBadgeText: { color: '#38bdf8', fontSize: 12, fontWeight: '700' },
    
    cartItemsScroll: { maxHeight: 250 },
    summaryItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' },
    summaryItemName: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
    summaryItemQty: { color: '#64748b', fontSize: 12, marginTop: 2 },
    summaryItemPrice: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
    
    totalSection: { marginTop: 10 },
    totalLine: { height: 1, backgroundColor: '#334155', marginBottom: 16 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 },
    totalLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
    totalValue: { color: '#38bdf8', fontSize: 28, fontWeight: '900' },
    
    actionGroup: { gap: 10 },
    placeOrderBtn: { backgroundColor: '#38bdf8', borderRadius: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#38bdf8', shadowOpacity: 0.3, elevation: 6 },
    placeOrderBtnText: { color: '#0f172a', fontWeight: '900', fontSize: 18, textTransform: 'uppercase' },
    cancelBtn: { backgroundColor: 'transparent', paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    cancelBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 14 },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalContent: { width: '100%', backgroundColor: '#1e293b', borderRadius: 24, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
    closeModalBtn: { padding: 4 },
    previewFrameContainer: { height: 450, backgroundColor: '#fff', width: '100%' }, 
    modalFooter: { padding: 20, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', gap: 12 },
    cancelBtnModal: { flex: 1, padding: 16, borderRadius: 14, alignItems: 'center', backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155' },
    cancelBtnTextModal: { color: '#94a3b8', fontWeight: '700' },
    confirmBtnModal: { flex: 2, padding: 16, borderRadius: 14, alignItems: 'center', backgroundColor: '#38bdf8', flexDirection: 'row', justifyContent: 'center' },
    confirmBtnTextModal: { color: '#0f172a', fontWeight: '800' },
});
