import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

// --- Receipt Generator ---
const createReceiptHtml = (order: any) => {
    const itemsHtml = order.items.map((item: CartItem) => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px;">
            <span>${item.name} x${item.quantity}</span>
            <span>${(item.price * item.quantity).toFixed(0)}</span>
        </div>
    `).join('');

    const addressHtml = order.orderType === 'Delivery' && order.address ? `
        <div style="border-top: 1px dashed #000; margin-top: 10px; padding-top: 5px;">
            <div style="font-weight: bold; font-size: 12px;">Delivery Address:</div>
            <div style="font-size: 12px;">${order.address}</div>
        </div>
    ` : '';

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <title>Receipt</title>
                <style>
                    @page { size: 80mm auto; margin: 0; }
                    body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; padding: 10px 4px; background-color: #fff; color: #000; position: relative; min-height: 95vh; }
                    .center { text-align: center; }
                    img { max-width: 60px; display: block; margin: 0 auto 5px; }
                    .header { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
                    .sub-header { font-size: 12px; margin-bottom: 10px; }
                    .divider { border-top: 1px dashed #000; margin: 5px 0; }
                    .row { display: flex; justify-content: space-between; font-size: 12px; }
                    .bold { font-weight: bold; }
                    .footer { text-align: center; font-size: 10px; margin-top: 15px; }
                    .credit { position: fixed; bottom: 0px; left: 50%; transform: translateX(-50%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 0.7rem; color: #666; text-align: center; width: 100%; background-color: #fff; padding-top: 5px; }
                    @media print { body { margin: 0; } .credit { position: fixed; bottom: 0; } }
                </style>
            </head>
            <body>
                <div class="center">
                    <img src="https://i.ibb.co/6R223hD/slice-n-spice.png" alt="Logo" onerror="this.style.display='none'" />
                    <div class="header">Slice n' Spice</div>
                    <div class="sub-header">${new Date(order.date).toLocaleDateString()} ${new Date(order.date).toLocaleTimeString()}</div>
                </div>
                <div class="divider"></div>
                <div class="row"><span>Order Type:</span><span class="bold">${order.orderType}</span></div>
                <div class="row"><span>Pay Method:</span><span class="bold">${order.paymentMethod}</span></div>
                <div class="row"><span>Customer:</span><span class="bold">${order.customerName || 'Walk-in'}</span></div>
                ${order.customerPhone ? `<div class="row"><span>Contact:</span><span class="bold">${order.customerPhone}</span></div>` : ''}
                <div class="row"><span>Staff:</span><span class="bold">${order.staffName || 'Admin'}</span></div>
                <div class="divider"></div>
                ${itemsHtml}
                <div class="divider"></div>
                <div class="row bold" style="font-size: 14px;"><span>TOTAL</span><span>PKR ${order.total.toFixed(0)}</span></div>
                ${addressHtml}
                <div class="footer"><div>Thank you for your order!</div><div style="margin-top: 5px;">Order #${order.orderNumber || 'PREVIEW'}</div></div>
                <div class="credit"><div>Designed by Infinity Crafters!</div></div>
            </body>
        </html>
    `;
};

export default function CheckoutScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { userData } = useAuth(); // Get Staff Name
    const iframeRef = useRef<HTMLIFrameElement>(null);
    
    // Parse Params
    const cart = params.cart ? JSON.parse(params.cart as string) : [];
    const total = params.total ? parseFloat(params.total as string) : 0;

    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Cash');
    const [orderType, setOrderType] = useState<'Dine-in' | 'Take Away' | 'Delivery'>('Dine-in');
    
    // UI State
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const isLargeScreen = width > 900;

    const preparePreview = () => {
        if (cart.length === 0) return Alert.alert('Error', 'Cart is empty.');
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
            staffName: userData?.username || 'Staff', // Pass Staff Name
            date: Date.now()
        };

        setPreviewHtml(createReceiptHtml(tempOrder));
        setShowPreviewModal(true);
    };

    const handleConfirmAndPrint = async () => {
        setIsProcessing(true);
        try {
            // 1. Get New Order Number (Atomic Increment)
            const orderCounterRef = ref(database, 'counters/orders');
            const transactionResult = await runTransaction(orderCounterRef, (currentCount) => (currentCount || 100) + 1);
            
            if (!transactionResult.committed) throw new Error("Failed to generate order number.");
            const newOrderNumber = transactionResult.snapshot.val();

            // 2. Create Order Object
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

            // 3. Save to Firebase
            await set(newOrderRef, finalOrder);

            // 4. Print
            const finalReceiptHtml = createReceiptHtml(finalOrder);
            
            if (isWeb && iframeRef.current) {
                const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
                if (doc) {
                    doc.open();
                    doc.write(finalReceiptHtml);
                    doc.close();
                }
                setTimeout(() => {
                    iframeRef.current?.contentWindow?.print();
                    setShowPreviewModal(false);
                    router.replace({ pathname: '/(tabs)/dashboard', params: { clearCart: 'true' } });
                }, 500);
            } else {
                 Alert.alert("Success", `Order #${newOrderNumber} Created`, [{
                        text: "Done",
                        onPress: () => {
                            setShowPreviewModal(false);
                            router.replace({ pathname: '/(tabs)/dashboard', params: { clearCart: 'true' } });
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
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#f8fafc" />
                </Pressable>
                <Text style={styles.headerTitle}>Checkout</Text>
                <View style={{width: 40}} /> 
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={[styles.contentLayout, isLargeScreen && styles.contentLayoutLarge]}>
                        
                        {/* LEFT COLUMN: FORM */}
                        <View style={styles.formColumn}>
                            
                            {/* Order Type */}
                            <View style={styles.cardSection}>
                                <Text style={styles.sectionTitle}>Order Type</Text>
                                <View style={styles.typeContainer}>
                                    {['Dine-in', 'Take Away', 'Delivery'].map((type) => (
                                        <Pressable 
                                            key={type} 
                                            style={[styles.typeButton, orderType === type && styles.typeButtonActive]}
                                            onPress={() => setOrderType(type as any)}
                                        >
                                            <Ionicons 
                                                name={type === 'Dine-in' ? 'restaurant' : type === 'Take Away' ? 'bag-handle' : 'bicycle'} 
                                                size={20} 
                                                color={orderType === type ? '#0f172a' : '#94a3b8'} 
                                                style={{marginBottom: 4}}
                                            />
                                            <Text style={[styles.typeButtonText, orderType === type && styles.typeButtonTextActive]}>{type}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            {/* Details */}
                            <View style={styles.cardSection}>
                                <Text style={styles.sectionTitle}>Customer Details</Text>
                                <View style={styles.inputContainer}>
                                    
                                    {/* Name Input */}
                                    <View style={[
                                        styles.inputWrapper,
                                        focusedInput === 'name' && styles.inputWrapperFocused
                                    ]}>
                                        <Ionicons name="person-outline" size={20} color={focusedInput === 'name' ? "#38bdf8" : "#64748b"} style={styles.inputIcon} />
                                        <TextInput 
                                            style={styles.input} 
                                            placeholder="Customer Name (Optional)" 
                                            placeholderTextColor="#64748b"
                                            value={name}
                                            onChangeText={setName}
                                            onFocus={() => setFocusedInput('name')}
                                            onBlur={() => setFocusedInput(null)}
                                        />
                                    </View>

                                    {/* Phone Input */}
                                    <View style={[
                                        styles.inputWrapper,
                                        focusedInput === 'phone' && styles.inputWrapperFocused
                                    ]}>
                                        <Ionicons name="call-outline" size={20} color={focusedInput === 'phone' ? "#38bdf8" : "#64748b"} style={styles.inputIcon} />
                                        <TextInput 
                                            style={styles.input} 
                                            placeholder="Phone Number (Optional)" 
                                            placeholderTextColor="#64748b"
                                            keyboardType="phone-pad"
                                            value={phone}
                                            onChangeText={setPhone}
                                            onFocus={() => setFocusedInput('phone')}
                                            onBlur={() => setFocusedInput(null)}
                                        />
                                    </View>

                                    {/* Address Input (Conditional) */}
                                    {orderType === 'Delivery' && (
                                        <View style={[
                                            styles.inputWrapper,
                                            focusedInput === 'address' && styles.inputWrapperFocused
                                        ]}>
                                            <Ionicons name="location-outline" size={20} color={focusedInput === 'address' ? "#38bdf8" : "#64748b"} style={styles.inputIcon} />
                                            <TextInput 
                                                style={styles.input} 
                                                placeholder="Delivery Address" 
                                                placeholderTextColor="#64748b"
                                                value={address}
                                                onChangeText={setAddress}
                                                onFocus={() => setFocusedInput('address')}
                                                onBlur={() => setFocusedInput(null)}
                                                multiline
                                            />
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Payment */}
                            <View style={styles.cardSection}>
                                <Text style={styles.sectionTitle}>Payment Method</Text>
                                <View style={styles.paymentRow}>
                                     <Pressable 
                                        style={[styles.paymentCard, paymentMethod === 'Cash' && styles.paymentCardActive]}
                                        onPress={() => setPaymentMethod('Cash')}
                                    >
                                        <View style={[styles.radioOuter, paymentMethod === 'Cash' && styles.radioOuterActive]}>
                                            {paymentMethod === 'Cash' && <View style={styles.radioInner} />}
                                        </View>
                                        <Ionicons name="cash-outline" size={24} color={paymentMethod === 'Cash' ? "#0f172a" : "#94a3b8"} />
                                        <Text style={[styles.paymentText, paymentMethod === 'Cash' && styles.paymentTextActive]}>Cash</Text>
                                    </Pressable>
                                    <Pressable 
                                        style={[styles.paymentCard, paymentMethod === 'Card' && styles.paymentCardActive]}
                                        onPress={() => setPaymentMethod('Card')}
                                    >
                                        <View style={[styles.radioOuter, paymentMethod === 'Card' && styles.radioOuterActive]}>
                                            {paymentMethod === 'Card' && <View style={styles.radioInner} />}
                                        </View>
                                        <Ionicons name="card-outline" size={24} color={paymentMethod === 'Card' ? "#0f172a" : "#94a3b8"} />
                                        <Text style={[styles.paymentText, paymentMethod === 'Card' && styles.paymentTextActive]}>Card</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>

                        {/* RIGHT COLUMN: SUMMARY (Floating Box) */}
                        <View style={styles.summaryColumn}>
                            <View style={styles.floatingSummaryCard}>
                                <Text style={styles.summaryHeader}>Order Summary</Text>
                                <ScrollView style={styles.cartItemsScroll} nestedScrollEnabled>
                                    {cart.map((item: CartItem, index: number) => (
                                        <View key={`${item.id}-${index}`} style={styles.summaryItemRow}>
                                            <Text style={styles.summaryItemName}>{item.quantity}x {item.name}</Text>
                                            <Text style={styles.summaryItemPrice}>{(item.price * item.quantity).toFixed(0)}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                                
                                <View style={styles.divider} />
                                
                                <View style={styles.totalRow}>
                                    <Text style={styles.totalLabel}>Total Amount</Text>
                                    <Text style={styles.totalValue}>PKR {total.toFixed(0)}</Text>
                                </View>
                                
                                <Pressable 
                                    style={({pressed}) => [styles.placeOrderBtn, pressed && {opacity: 0.9}]} 
                                    onPress={preparePreview}
                                >
                                    <Text style={styles.placeOrderBtnText}>Place Order</Text>
                                    <Ionicons name="arrow-forward-circle" size={24} color="#0f172a" />
                                </Pressable>
                            </View>
                        </View>

                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Receipt Modal */}
            <Modal
                visible={showPreviewModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowPreviewModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Confirm Receipt</Text>
                            <Pressable onPress={() => setShowPreviewModal(false)} style={styles.closeModalBtn}>
                                <Ionicons name="close" size={20} color="#94a3b8" />
                            </Pressable>
                        </View>
                        
                        <View style={styles.previewFrameContainer}>
                            {isWeb && (
                                <iframe 
                                    ref={iframeRef}
                                    srcDoc={previewHtml}
                                    style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' }}
                                />
                            )}
                            {!isWeb && (
                                <View style={{padding: 20, alignItems: 'center'}}>
                                    <Text style={{color: '#f1f5f9'}}>Preview not supported on native. Click Print to proceed.</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.modalFooter}>
                             <Pressable style={styles.cancelButton} onPress={() => setShowPreviewModal(false)} disabled={isProcessing}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.confirmButton} onPress={handleConfirmAndPrint} disabled={isProcessing}>
                                {isProcessing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.confirmButtonText}>Print & Save</Text>}
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
    
    // Header
    header: { 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
        paddingHorizontal: 24, paddingVertical: 16, 
        backgroundColor: 'rgba(15, 23, 42, 0.95)', borderBottomWidth: 1, borderBottomColor: '#1e293b'
    },
    headerTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
    backButton: { 
        width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e293b', 
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' 
    },

    // Layout
    scrollContent: { padding: 24, paddingBottom: 60 },
    contentLayout: { flexDirection: 'column', gap: 24 },
    contentLayoutLarge: { flexDirection: 'row', alignItems: 'flex-start' }, // Desktop: Side by Side
    
    formColumn: { flex: 2, gap: 24 },
    summaryColumn: { flex: 1, minWidth: 320 },

    // Card Sections
    cardSection: { 
        backgroundColor: '#1e293b', borderRadius: 24, padding: 24, 
        borderWidth: 1, borderColor: '#334155',
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2
    },
    sectionTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700', marginBottom: 20 },

    // Order Type Buttons
    typeContainer: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
    typeButton: { 
        flex: 1, minWidth: 100, paddingVertical: 16, paddingHorizontal: 12, 
        borderRadius: 16, backgroundColor: '#0f172a', alignItems: 'center', 
        borderWidth: 1, borderColor: '#334155' 
    },
    typeButtonActive: { backgroundColor: '#38bdf8', borderColor: '#38bdf8' },
    typeButtonText: { color: '#94a3b8', fontWeight: '600', fontSize: 14, marginTop: 4 },
    typeButtonTextActive: { color: '#0f172a' },

    // Inputs
    inputContainer: { gap: 16 },
    inputWrapper: { 
        flexDirection: 'row', alignItems: 'center', 
        backgroundColor: '#0f172a', borderRadius: 16, 
        borderWidth: 1, borderColor: '#334155', paddingHorizontal: 16,
        ...Platform.select({ web: { transition: 'border-color 0.2s ease, box-shadow 0.2s ease' } })
    },
    inputWrapperFocused: {
        borderColor: '#38bdf8',
        ...Platform.select({
            web: { boxShadow: '0 0 0 4px rgba(56, 189, 248, 0.2)' },
            default: { shadowColor: '#38bdf8', shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }
        })
    },
    inputIcon: { marginRight: 12 },
    input: { 
        flex: 1, paddingVertical: 16, color: '#f8fafc', fontSize: 16,
        ...Platform.select({ web: { outlineStyle: 'none' } }) 
    },

    // Payment
    paymentRow: { flexDirection: 'row', gap: 16 },
    paymentCard: { 
        flex: 1, padding: 20, backgroundColor: '#0f172a', borderRadius: 16, 
        alignItems: 'center', justifyContent: 'center', 
        borderWidth: 1, borderColor: '#334155', position: 'relative'
    },
    paymentCardActive: { backgroundColor: '#38bdf8', borderColor: '#38bdf8' },
    paymentText: { color: '#94a3b8', fontWeight: '700', marginTop: 8 },
    paymentTextActive: { color: '#0f172a' },
    radioOuter: {
        position: 'absolute', top: 12, right: 12,
        width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#334155',
        justifyContent: 'center', alignItems: 'center'
    },
    radioOuterActive: { borderColor: '#0f172a' },
    radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0f172a' },

    // Floating Summary Box
    floatingSummaryCard: {
        backgroundColor: '#1e293b', borderRadius: 24, padding: 24,
        borderWidth: 1, borderColor: '#38bdf8', 
        shadowColor: "#38bdf8", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
    },
    summaryHeader: { color: '#f8fafc', fontSize: 20, fontWeight: '800', marginBottom: 20 },
    cartItemsScroll: { maxHeight: 300, marginBottom: 20 },
    summaryItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    summaryItemName: { color: '#cbd5e1', fontSize: 15, flex: 1 },
    summaryItemPrice: { color: '#f8fafc', fontSize: 15, fontWeight: '600', marginLeft: 10 },
    divider: { height: 1, backgroundColor: '#334155', marginVertical: 16 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    totalLabel: { color: '#94a3b8', fontSize: 16 },
    totalValue: { color: '#38bdf8', fontSize: 28, fontWeight: '800' },
    
    placeOrderBtn: { 
        backgroundColor: '#38bdf8', borderRadius: 16, paddingVertical: 18, 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        shadowColor: "#38bdf8", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6
    },
    placeOrderBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 18 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', maxWidth: 450, backgroundColor: '#1e293b', borderRadius: 24, borderWidth: 1, borderColor: '#334155', overflow: 'hidden', maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#334155' },
    modalTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
    closeModalBtn: { padding: 4 },
    previewFrameContainer: { height: 400, backgroundColor: '#334155' },
    modalFooter: { padding: 20, borderTopWidth: 1, borderColor: '#334155', flexDirection: 'row', gap: 12 },
    cancelButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: '#334155' },
    cancelButtonText: { color: '#f8fafc', fontWeight: '700' },
    confirmButton: { flex: 2, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: '#38bdf8' },
    confirmButtonText: { color: '#0f172a', fontWeight: '700' },
});