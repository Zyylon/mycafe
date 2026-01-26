import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ref as dbRef, onValue, push, remove, set, update } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    LayoutAnimation,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet, Text, TextInput,
    UIManager,
    View,
    Dimensions
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database, storage, firebaseConfig } from '../lib/firebaseConfig';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

// --- Types ---
interface MenuItem {
    id: string;
    name: string;
    price: number;
    imageUrl: string;
    categoryId: string;
}

interface Category {
    id: string;
    name: string;
}

interface InventoryItem {
    id: string;
    name: string;
    price: number;
    weight: string;
    date: string; // YYYY-MM-DD
    timestamp: number;
}

interface GroupedInventory {
    date: string;
    total: number;
    items: InventoryItem[];
}

const { width: windowWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

export default function ManagementScreen() {
    const router = useRouter();
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<'inventory' | 'menu'>('inventory');
    const [loading, setLoading] = useState(false);
    const isAdmin = userData?.role === 'admin' || userData?.role === 'superadmin';

    // --- State: Menu Management ---
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isMenuModalVisible, setMenuModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

    // Form State (Menu)
    const [menuName, setMenuName] = useState('');
    const [menuPrice, setMenuPrice] = useState('');
    const [menuImageUrl, setMenuImageUrl] = useState('');
    const [menuLocalUri, setMenuLocalUri] = useState<string | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');

    // --- State: Inventory Management ---
    const [inventoryList, setInventoryList] = useState<GroupedInventory[]>([]);
    const [expandedDate, setExpandedDate] = useState<string | null>(null);

    // Form State (Inventory)
    const [invName, setInvName] = useState('');
    const [invPrice, setInvPrice] = useState('');
    const [invWeight, setInvWeight] = useState('');
    const [invWeightUnit, setInvWeightUnit] = useState<'KG' | 'Gram'>('KG');

    useEffect(() => {
        // Fetch Categories
        const catRef = dbRef(database, 'categories');
        onValue(catRef, (snap) => {
            const data = snap.val();
            setCategories(data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : []);
        });

        // Fetch Menu Items
        const menuRef = dbRef(database, 'menu_items');
        onValue(menuRef, (snap) => {
            const data = snap.val();
            setMenuItems(data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : []);
        });

        // Fetch Inventory
        const invRef = dbRef(database, 'inventory_log');
        onValue(invRef, (snap) => {
            const data = snap.val();
            if (data) {
                const raw: InventoryItem[] = Object.keys(data).map(k => ({ id: k, ...data[k] }));
                const grouped: { [key: string]: GroupedInventory } = {};
                raw.forEach(item => {
                    if (!grouped[item.date]) grouped[item.date] = { date: item.date, total: 0, items: [] };
                    grouped[item.date].items.push(item);
                    grouped[item.date].total += item.price;
                });
                setInventoryList(Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)));
            } else {
                setInventoryList([]);
            }
        });
    }, []);

    // --- Helpers ---
    const handleNumericInput = (text: string, setter: (val: string) => void) => {
        setter(text.replace(/[^0-9.]/g, ''));
    };

    const uploadImage = async (uri: string): Promise<string> => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const name = `menu/${Date.now()}`;
            const ref = storageRef(storage, name);
            await uploadBytes(ref, blob);
            return await getDownloadURL(ref);
        } catch (e) {
            console.error(e);
            throw new Error("Upload failed");
        }
    };

    // --- Actions: Inventory ---
    const addInventory = async () => {
        if (!invName || !invPrice || !invWeight) return Alert.alert("Error", "Fill all fields");
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const ref = push(dbRef(database, 'inventory_log'));
            await set(ref, {
                name: invName,
                price: parseFloat(invPrice),
                weight: `${invWeight} ${invWeightUnit}`,
                date: today,
                timestamp: Date.now()
            });
            setInvName(''); setInvPrice(''); setInvWeight('');
            Alert.alert("Success", "Inventory logged");
        } catch (e: any) {
            Alert.alert("Error", e.message);
        } finally {
            setLoading(false);
        }
    };

    const deleteInventory = (id: string) => {
        const perform = () => remove(dbRef(database, `inventory_log/${id}`));
        if (isWeb) { if (window.confirm("Delete entry?")) perform(); }
        else { Alert.alert("Delete", "Are you sure?", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: perform }]); }
    };

    // --- Actions: Menu ---
    const openMenuModal = (item?: MenuItem) => {
        if (item) {
            setEditingItem(item);
            setMenuName(item.name);
            setMenuPrice(item.price.toString());
            setMenuImageUrl(item.imageUrl);
            setSelectedCategoryId(item.categoryId);
        } else {
            setEditingItem(null);
            setMenuName(''); setMenuPrice(''); setMenuImageUrl(''); setMenuLocalUri(null); setSelectedCategoryId('');
        }
        setMenuModalVisible(true);
    };

    const pickMenuImage = async () => {
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5 });
        if (!res.canceled) {
            setMenuLocalUri(res.assets[0].uri);
            setMenuImageUrl('');
        }
    };

    const saveMenuItem = async () => {
        if (!menuName || !menuPrice || !selectedCategoryId) return Alert.alert("Error", "Fill required fields");
        setLoading(true);
        try {
            let url = menuImageUrl;
            if (menuLocalUri) url = await uploadImage(menuLocalUri);

            const data = { name: menuName, price: parseFloat(menuPrice), imageUrl: url, categoryId: selectedCategoryId };
            if (editingItem) {
                await update(dbRef(database, `menu_items/${editingItem.id}`), data);
            } else {
                await set(push(dbRef(database, 'menu_items')), data);
            }
            setMenuModalVisible(false);
            Alert.alert("Success", "Menu updated");
        } catch (e: any) {
            Alert.alert("Error", e.message);
        } finally {
            setLoading(false);
        }
    };

    const deleteMenuItem = (item: MenuItem) => {
        const perform = () => remove(dbRef(database, `menu_items/${item.id}`));
        if (isWeb) { if (window.confirm(`Delete ${item.name}?`)) perform(); }
        else { Alert.alert("Delete", `Delete ${item.name}?`, [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: perform }]); }
    };

    const addCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            const ref = push(dbRef(database, 'categories'));
            await set(ref, { name: newCategoryName.trim() });
            setSelectedCategoryId(ref.key!);
            setNewCategoryName('');
        } catch (e) { Alert.alert("Error", "Failed to add category"); }
    };

    // --- Sub-Renderers ---

    const renderInventory = () => (
        <View style={styles.tabPane}>
            <View style={styles.webCard}>
                <Text style={styles.sectionTitle}>Daily Inventory Log</Text>
                <View style={styles.invForm}>
                    <TextInput style={styles.input} placeholder="Item Name" value={invName} onChangeText={setInvName} placeholderTextColor="#64748b" />
                    <View style={styles.row}>
                        <View style={[styles.inputBox, { flex: 1 }]}>
                            <TextInput style={styles.boxInput} placeholder="Price" value={invPrice} onChangeText={t => handleNumericInput(t, setInvPrice)} keyboardType="numeric" placeholderTextColor="#64748b" />
                            <Text style={styles.boxSuffix}>PKR</Text>
                        </View>
                        <View style={[styles.inputBox, { flex: 1.2 }]}>
                            <TextInput style={styles.boxInput} placeholder="Weight/Qty" value={invWeight} onChangeText={t => handleNumericInput(t, setInvWeight)} keyboardType="numeric" placeholderTextColor="#64748b" />
                            <View style={styles.unitToggle}>
                                <Pressable style={[styles.unitBtn, invWeightUnit === 'KG' && styles.unitBtnActive]} onPress={() => setInvWeightUnit('KG')}><Text style={[styles.unitBtnText, invWeightUnit === 'KG' && styles.unitBtnTextActive]}>KG</Text></Pressable>
                                <Pressable style={[styles.unitBtn, invWeightUnit === 'Gram' && styles.unitBtnActive]} onPress={() => setInvWeightUnit('Gram')}><Text style={[styles.unitBtnText, invWeightUnit === 'Gram' && styles.unitBtnTextActive]}>G</Text></Pressable>
                            </View>
                        </View>
                    </View>
                    <Pressable style={styles.primaryBtn} onPress={addInventory} disabled={loading}>
                        {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.primaryBtnText}>Add Entry</Text>}
                    </Pressable>
                </View>

                <FlatList
                    data={inventoryList}
                    keyExtractor={item => item.date}
                    renderItem={({ item }) => (
                        <View style={styles.groupCard}>
                            <Pressable style={styles.groupHeader} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpandedDate(expandedDate === item.date ? null : item.date); }}>
                                <View style={styles.rowAlign}>
                                    <Ionicons name={expandedDate === item.date ? "chevron-down" : "chevron-forward"} size={20} color="#94a3b8" />
                                    <Text style={styles.groupTitle}>{new Date(item.date).toDateString()}</Text>
                                </View>
                                <Text style={styles.groupTotal}>PKR {item.total.toFixed(2)}</Text>
                            </Pressable>
                            {expandedDate === item.date && (
                                <View style={styles.groupDetails}>
                                    {item.items.map(i => (
                                        <View key={i.id} style={styles.itemRow}>
                                            <View>
                                                <Text style={styles.itemName}>{i.name}</Text>
                                                <Text style={styles.itemSub}>{i.weight}</Text>
                                            </View>
                                            <View style={styles.rowAlign}>
                                                <Text style={styles.itemPrice}>PKR {i.price.toFixed(2)}</Text>
                                                {isAdmin && <Pressable style={{ marginLeft: 15 }} onPress={() => deleteInventory(i.id)}><Ionicons name="trash-outline" size={18} color="#ef4444" /></Pressable>}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}
                />
            </View>
        </View>
    );

    const renderMenu = () => (
        <View style={styles.tabPane}>
            <View style={styles.webCard}>
                <View style={styles.rowBetween}>
                    <Text style={styles.sectionTitle}>Menu Management</Text>
                    <Pressable style={styles.fab} onPress={() => openMenuModal()}>
                        <Ionicons name="add" size={24} color="#0f172a" />
                        <Text style={styles.fabText}>New Item</Text>
                    </Pressable>
                </View>

                <FlatList
                    data={menuItems}
                    numColumns={windowWidth > 800 ? 2 : 1}
                    key={windowWidth > 800 ? 'web' : 'mob'}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.menuCard}>
                            <Image source={{ uri: item.imageUrl }} style={styles.menuThumb} />
                            <View style={{ flex: 1, marginLeft: 15 }}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                <Text style={styles.itemSub}>{categories.find(c => c.id === item.categoryId)?.name}</Text>
                                <Text style={styles.itemPrice}>PKR {item.price.toFixed(2)}</Text>
                            </View>
                            {isAdmin && (
                                <View style={styles.rowAlign}>
                                    <Pressable style={styles.iconBtn} onPress={() => openMenuModal(item)}><Ionicons name="pencil" size={20} color="#38bdf8" /></Pressable>
                                    <Pressable style={styles.iconBtn} onPress={() => deleteMenuItem(item)}><Ionicons name="trash-outline" size={20} color="#ef4444" /></Pressable>
                                </View>
                            )}
                        </View>
                    )}
                />
            </View>

            <Modal visible={isMenuModalVisible} transparent animationType="fade" onRequestClose={() => setMenuModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalBox, windowWidth > 700 && { width: 700 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingItem ? 'Edit Item' : 'Create Menu Item'}</Text>
                            <Pressable onPress={() => setMenuModalVisible(false)}><Ionicons name="close" size={24} color="#94a3b8" /></Pressable>
                        </View>
                        
                        <ScrollView contentContainerStyle={[styles.modalBody, windowWidth > 700 && styles.row]}>
                            {/* Left: Image */}
                            <View style={[styles.modalSection, windowWidth > 700 && { flex: 1, marginRight: 20 }]}>
                                <Pressable style={styles.imageBox} onPress={pickMenuImage}>
                                    {menuLocalUri || menuImageUrl ? (
                                        <Image source={{ uri: menuLocalUri || menuImageUrl }} style={styles.fullImg} />
                                    ) : (
                                        <View style={styles.imgPlaceholder}><Ionicons name="camera" size={40} color="#475569" /><Text style={styles.imgText}>Upload Image</Text></View>
                                    )}
                                </Pressable>
                                <TextInput style={[styles.input, { marginTop: 10 }]} placeholder="Or URL" value={menuImageUrl} onChangeText={setMenuImageUrl} placeholderTextColor="#64748b" />
                            </View>

                            {/* Right: Details */}
                            <View style={[styles.modalSection, windowWidth > 700 && { flex: 1.5 }]}>
                                <Text style={styles.label}>Item Name</Text>
                                <TextInput style={styles.input} value={menuName} onChangeText={setMenuName} placeholder="e.g. Espresso" placeholderTextColor="#475569" />
                                
                                <Text style={styles.label}>Price</Text>
                                <View style={styles.inputBox}>
                                    <TextInput style={styles.boxInput} value={menuPrice} onChangeText={t => handleNumericInput(t, setMenuPrice)} keyboardType="numeric" placeholder="0.00" placeholderTextColor="#475569" />
                                    <Text style={styles.boxSuffix}>PKR</Text>
                                </View>

                                <Text style={styles.label}>Category</Text>
                                <View style={styles.catGrid}>
                                    {categories.map(c => (
                                        <Pressable key={c.id} style={[styles.catTag, selectedCategoryId === c.id && styles.catTagActive]} onPress={() => setSelectedCategoryId(c.id)}>
                                            <Text style={[styles.catTagText, selectedCategoryId === c.id && styles.catTagTextActive]}>{c.name}</Text>
                                        </Pressable>
                                    ))}
                                </View>

                                <View style={styles.row}>
                                    <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="New category..." value={newCategoryName} onChangeText={setNewCategoryName} placeholderTextColor="#475569" />
                                    <Pressable style={styles.catAddBtn} onPress={addCategory}><Ionicons name="add" size={24} color="#0f172a" /></Pressable>
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <Pressable style={[styles.primaryBtn, { width: '100%' }]} onPress={saveMenuItem} disabled={loading}>
                                {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.primaryBtnText}>{editingItem ? 'Update Item' : 'Save Item'}</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <Text style={styles.title}>Management</Text>
                <Pressable onPress={() => router.back()}><Ionicons name="close" size={28} color="#94a3b8" /></Pressable>
            </View>

            <View style={styles.tabs}>
                <Pressable style={[styles.tab, activeTab === 'inventory' && styles.activeTab]} onPress={() => setActiveTab('inventory')}><Text style={[styles.tabText, activeTab === 'inventory' && styles.activeTabText]}>Inventory Log</Text></Pressable>
                <Pressable style={[styles.tab, activeTab === 'menu' && styles.activeTab]} onPress={() => setActiveTab('menu')}><Text style={[styles.tabText, activeTab === 'menu' && styles.activeTabText]}>Menu Items</Text></Pressable>
            </View>

            <ScrollView contentContainerStyle={{ flexGrow: 1 }} scrollEnabled={!isWeb}>
                {activeTab === 'inventory' ? renderInventory() : renderMenu()}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 20, backgroundColor: '#1e293b' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc' },
    tabs: { flexDirection: 'row', backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
    tab: { flex: 1, paddingVertical: 15, alignItems: 'center' },
    activeTab: { borderBottomWidth: 3, borderBottomColor: '#38bdf8' },
    tabText: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
    activeTabText: { color: '#38bdf8' },
    tabPane: { flex: 1, padding: 20, alignItems: 'center' },

    webCard: { width: '100%', maxWidth: 900 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#f1f5f9', marginBottom: 20 },
    
    // Forms
    row: { flexDirection: 'row', gap: 12 },
    rowAlign: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    input: { backgroundColor: '#1e293b', borderRadius: 12, padding: 15, color: '#f1f5f9', borderWidth: 1, borderColor: '#334155', marginBottom: 12, fontSize: 16 },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 12, paddingRight: 15 },
    boxInput: { flex: 1, padding: 15, color: '#f1f5f9', fontSize: 16 },
    boxSuffix: { color: '#64748b', fontWeight: 'bold' },
    primaryBtn: { backgroundColor: '#38bdf8', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    primaryBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
    
    // Inventory
    invForm: { backgroundColor: '#1e293b', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 30 },
    unitToggle: { flexDirection: 'row', backgroundColor: '#334155', borderRadius: 8, padding: 3 },
    unitBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    unitBtnActive: { backgroundColor: '#38bdf8' },
    unitBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
    unitBtnTextActive: { color: '#0f172a' },
    
    groupCard: { backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
    groupHeader: { padding: 18, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#334155' },
    groupTitle: { color: '#f1f5f9', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
    groupTotal: { color: '#38bdf8', fontWeight: 'bold' },
    groupDetails: { padding: 15 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
    itemName: { color: '#f1f5f9', fontSize: 16, fontWeight: '500' },
    itemSub: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
    itemPrice: { color: '#f1f5f9', fontWeight: 'bold' },

    // Menu
    fab: { flexDirection: 'row', backgroundColor: '#38bdf8', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, alignItems: 'center' },
    fabText: { color: '#0f172a', fontWeight: 'bold', marginLeft: 8 },
    menuCard: { flex: 1, backgroundColor: '#1e293b', borderRadius: 16, padding: 15, margin: 6, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
    menuThumb: { width: 70, height: 70, borderRadius: 12 },
    iconBtn: { padding: 8, marginLeft: 8 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalBox: { backgroundColor: '#1e293b', borderRadius: 24, width: '100%', maxHeight: '90%', overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 24, borderBottomWidth: 1, borderBottomColor: '#334155' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#f1f5f9' },
    modalBody: { padding: 24 },
    modalSection: { marginBottom: 20 },
    label: { color: '#94a3b8', marginBottom: 8, fontWeight: '600' },
    imageBox: { width: '100%', aspectRatio: 1, backgroundColor: '#0f172a', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#334155' },
    imgPlaceholder: { alignItems: 'center' },
    imgText: { color: '#475569', marginTop: 10 },
    fullImg: { width: '100%', height: '100%', borderRadius: 16 },
    modalFooter: { padding: 24, borderTopWidth: 1, borderTopColor: '#334155' },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
    catTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#334155' },
    catTagActive: { backgroundColor: '#38bdf8' },
    catTagText: { color: '#94a3b8', fontSize: 13 },
    catTagTextActive: { color: '#0f172a', fontWeight: 'bold' },
    catAddBtn: { backgroundColor: '#38bdf8', height: 50, width: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});
