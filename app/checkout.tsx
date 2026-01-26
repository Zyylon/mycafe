import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView, Alert, Platform, LayoutAnimation, UIManager } from 'react-native';
import { ref, set, runTransaction, push } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

const createReceiptHtml = (order: any) => {
    const itemsHtml = order.items.map((item: CartItem) => `
        <tr>
            <td>${item.name} (x${item.quantity})</td>
            <td class="right">PKR ${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
    `).join('');

    const logoUrl = `https://i.imgur.com/Jz5t42s.png`;

    const addressHtml = order.orderType === 'Delivery' && order.address ? `
        <div class="section">
            <h2>Delivery Address</h2>
            <p>${order.address}</p>
        </div>
    ` : '';

    return `
        <html>
            <head>
                <title>Receipt</title>
                <style>
                    body { font-family: 'Courier New', monospace; margin: 0; padding: 20px; background-color: #fff; color: #000; }
                    .container { width: 300px; margin: auto; }
                    .center { text-align: center; }
                    img { max-width: 100px; margin-bottom: 10px; }
                    h1 { font-size: 20px; margin: 0; }
                    h2 { font-size: 16px; border-bottom: 1px dashed #000; padding-bottom: 5px; margin: 15px 0 10px; }
                    p { margin: 2px 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    td { padding: 5px 0; }
                    .right { text-align: right; }
                    .total-row td { border-top: 1px dashed #000; padding-top: 10px; font-weight: bold; }
                    .footer { margin-top: 20px; border-top: 1px dashed #000; padding-top: 10px; }
                    .cafe-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="center">
                        <img src="${logoUrl}" alt="Logo" />
                        <h1 class="cafe-name">Slice n'Spice</h1>
                        <p>Order ${order.orderNumber ? 'Confirmed' : 'Preview'}</p>
                        <p>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
                    </div>

                    <h2>Order #${order.orderNumber || '...'}</h2>
                    
                    <table>
                       ${itemsHtml}
                       <tr class="total-row">
                           <td>Total</td>
                           <td class="right">PKR ${order.total.toFixed(2)}</td>
                       </tr>
                    </table>

                    <div class="section">
                        <h2>Details</h2>
                        <p><strong>Customer:</strong> ${order.customerName || 'N/A'}</p>
                        <p><strong>Contact:</strong> ${order.customerPhone || 'N/A'}</p>
                        <p><strong>Order Type:</strong> ${order.orderType}</p>
                        <p><strong>Payment:</strong> ${order.paymentMethod}</p>
                    </div>

                    ${addressHtml}

                    <div class="footer center">
                        <p>Thank you for your order!</p>
                    </div>
                </div>
            </body>
        </html>
    `;
};

export default function CheckoutScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const printIframe = useRef<HTMLIFrameElement>(null);
    
    const cart = params.cart ? JSON.parse(params.cart as string) : [];
    const total = params.total ? parseFloat(params.total as string) : 0;

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Cash');
    const [orderType, setOrderType] = useState<'Dine-in' | 'Take Away' | 'Delivery'>('Dine-in');
    const [isSaving, setIsSaving] = useState(false);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [receiptHtml, setReceiptHtml] = useState('');

    const handleConfirm = () => {
        const previewOrder = {
            items: cart,
            total,
            customerName: name,
            customerPhone: phone,
            paymentMethod,
            orderType,
            address
        };
        setReceiptHtml(createReceiptHtml(previewOrder));
        LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
        setIsPreviewVisible(true);
    };
    
    const handleEdit = () => {
        if (isPreviewVisible) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
            setIsPreviewVisible(false);
        }
    }

    const handlePrintAndSave = async () => {
        if (cart.length === 0) return Alert.alert('Error', 'Cannot process an empty order.');
        if (orderType === 'Delivery' && !address) return Alert.alert('Address Required', 'Please enter a delivery address.');

        setIsSaving(true);
        try {
            const orderCounterRef = ref(database, 'counters/orders');
            const transactionResult = await runTransaction(orderCounterRef, (currentCount) => (currentCount || 100) + 1);
            
            if (!transactionResult.committed) throw new Error("Failed to generate order number.");
            const newOrderNumber = transactionResult.snapshot.val();

            const newOrderRef = push(ref(database, 'orders'));
            const orderId = newOrderRef.key!;
            
            const orderData = {
                id: orderId,
                orderNumber: String(newOrderNumber),
                date: Date.now(),
                items: cart,
                total,
                customerName: name,
                customerPhone: phone,
                paymentMethod,
                orderType,
                ...(orderType === 'Delivery' && { address }),
            };

            await set(newOrderRef, orderData);
            setReceiptHtml(createReceiptHtml(orderData));

            if (Platform.OS === 'web') {
                setTimeout(() => printIframe.current?.contentWindow?.print(), 100);
            }
            
            Alert.alert('Success', `Order #${newOrderNumber} saved.`, [
                { text: 'OK', onPress: () => router.push({ pathname: '/(tabs)/dashboard', params: { clearCart: 'true' } }) }
            ]);

        } catch (error: any) {
            console.error('Failed to save or print order:', error);
            Alert.alert('Error', error.message || 'There was a problem saving the order.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const mainAction = isPreviewVisible ? handlePrintAndSave : handleConfirm;
    const mainButtonText = isPreviewVisible ? 'Save & Print Receipt' : 'Confirm';

    return (
        <View style={styles.pageContainer}>
            <ScrollView style={styles.formContainer} contentContainerStyle={styles.contentContainer}>
                <Text style={styles.title}>Finalize Order</Text>

                <TextInput style={styles.input} placeholder="Customer Name (Optional)" value={name} onChangeText={setName} onFocus={handleEdit} placeholderTextColor="#94a3b8" />
                <TextInput style={styles.input} placeholder="Customer Phone (Optional)" value={phone} onChangeText={setPhone} onFocus={handleEdit} keyboardType="phone-pad" placeholderTextColor="#94a3b8" />
                
                <Text style={styles.label}>Order Type</Text>
                <View style={styles.toggleContainer}>
                    <Pressable style={({ pressed }) => [styles.toggleButton, orderType === 'Dine-in' && styles.activeButton, { opacity: pressed ? 0.7 : 1 }]} onPress={() => { setOrderType('Dine-in'); handleEdit(); }}><Text style={styles.toggleButtonText}>Dine-in</Text></Pressable>
                    <Pressable style={({ pressed }) => [styles.toggleButton, orderType === 'Take Away' && styles.activeButton, { opacity: pressed ? 0.7 : 1 }]} onPress={() => { setOrderType('Take Away'); handleEdit(); }}><Text style={styles.toggleButtonText}>Take Away</Text></Pressable>
                    <Pressable style={({ pressed }) => [styles.toggleButton, orderType === 'Delivery' && styles.activeButton, { opacity: pressed ? 0.7 : 1 }]} onPress={() => { setOrderType('Delivery'); handleEdit(); }}><Text style={styles.toggleButtonText}>Delivery</Text></Pressable>
                </View>

                {orderType === 'Delivery' && (
                    <TextInput
                        style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                        placeholder="Delivery Address"
                        value={address}
                        onChangeText={setAddress}
                        onFocus={handleEdit}
                        placeholderTextColor="#94a3b8"
                        multiline
                    />
                )}

                <Text style={styles.label}>Payment Method</Text>
                <View style={styles.toggleContainer}>
                    <Pressable style={({ pressed }) => [styles.toggleButton, paymentMethod === 'Cash' && styles.activeButton, { opacity: pressed ? 0.7 : 1 }]} onPress={() => { setPaymentMethod('Cash'); handleEdit(); }}><Text style={styles.toggleButtonText}>Cash</Text></Pressable>
                    <Pressable style={({ pressed }) => [styles.toggleButton, paymentMethod === 'Card' && styles.activeButton, { opacity: pressed ? 0.7 : 1 }]} onPress={() => { setPaymentMethod('Card'); handleEdit(); }}><Text style={styles.toggleButtonText}>Card</Text></Pressable>
                </View>

                <View style={styles.summary}>
                    <Text style={styles.summaryText}>Total Amount:</Text>
                    <Text style={styles.summaryTotal}>PKR {total.toFixed(2)}</Text>
                </View>

                <Pressable style={({ pressed }) => [styles.printButton, { opacity: pressed || isSaving ? 0.7 : 1 }]} onPress={mainAction} disabled={isSaving}>
                    <Text style={styles.printButtonText}>{isSaving ? 'Processing...' : mainButtonText}</Text>
                </Pressable>
            </ScrollView>
            {Platform.OS === 'web' && isPreviewVisible && (
                <View style={styles.previewContainer}>
                    <iframe ref={printIframe} srcDoc={receiptHtml} style={{width: '100%', height: '100%', border: 'none'}} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    pageContainer: { flex: 1, backgroundColor: '#0f172a', flexDirection: 'row' },
    formContainer: { flex: 1 },
    contentContainer: { padding: 20 },
    previewContainer: { flex: 1, padding: 20, borderLeftWidth: 1, borderColor: '#334155' },
    title: { fontSize: 28, fontWeight: 'bold', color: '#f8fafc', marginBottom: 20, textAlign: 'center' },
    input: { width: '100%', backgroundColor: '#1e293b', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
    label: { fontSize: 16, fontWeight: '500', color: '#94a3b8', marginBottom: 10, marginTop: 10 },
    toggleContainer: { flexDirection: 'row', marginBottom: 20, width: '100%' },
    toggleButton: { flex: 1, padding: 15, borderRadius: 10, backgroundColor: '#334155', alignItems: 'center', marginHorizontal: 4 },
    activeButton: { backgroundColor: '#38bdf8' },
    toggleButtonText: { color: '#f8fafc', fontWeight: 'bold' },
    summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#334155', marginVertical: 20 },
    summaryText: { fontSize: 18, color: '#cbd5e1' },
    summaryTotal: { fontSize: 22, fontWeight: 'bold', color: '#4ade80' },
    printButton: { width: '100%', backgroundColor: '#4ade80', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    printButtonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 18 },
});
