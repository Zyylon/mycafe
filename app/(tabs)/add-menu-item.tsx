import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref as dbRef, onValue, push, remove, set, update } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState, useRef } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
    Pressable
} from 'react-native';
import Animated, { 
    FadeIn, 
    FadeInDown, 
    FadeOut, 
    LinearTransition,
    useSharedValue,
    withTiming,
    useAnimatedStyle,
    AnimatedLayout
} from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import { database, storage } from '../../services/firebase';

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
    date: string;
    timestamp: number;
}

interface GroupedInventory {
    date: string;
    total: number;
    items: InventoryItem[];
}

// Web Scrollbar Logic
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

export default function ManagementScreen() {
    const { userData } = useAuth();
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 900;

    const [activeTab, setActiveTab] = useState<'inventory' | 'menu'>('inventory');
    const [loading, setLoading] = useState(false);
    const isAdmin = userData?.role === 'admin' || userData?.role === 'superadmin';

    // --- State: Menu ---
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isMenuModalVisible, setMenuModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

    // Menu Form
    const [menuName, setMenuName] = useState('');
    const [menuPrice, setMenuPrice] = useState('');
    const [menuImageUrl, setMenuImageUrl] = useState('');
    const [menuLocalUri, setMenuLocalUri] = useState<string | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');

    // --- State: Inventory ---
    const [inventoryList, setInventoryList] = useState<GroupedInventory[]>([]);
    const [expandedDate, setExpandedDate] = useState<string | null>(null);

    // Inventory Form
    const [invName, setInvName] = useState('');
    const [invPrice, setInvPrice] = useState('');
    const [invWeight, setInvWeight] = useState('');
    const [invWeightUnit, setInvWeightUnit] = useState<'KG' | 'Gram'>('KG');

    // --- UI State (Focus & Errors) ---
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    
    // Shake Animation Value
    const shakeOffset = useSharedValue(0);

    useEffect(() => {
        const catRef = dbRef(database, 'categories');
        const menuRef = dbRef(database, 'menu_items');
        const invRef = dbRef(database, 'inventory_log');

        onValue(catRef, (snap) => {
            const data = snap.val();
            setCategories(data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : []);
        });

        onValue(menuRef, (snap) => {
            const data = snap.val();
            setMenuItems(data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : []);
        });

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

    // Clear errors on input change
    useEffect(() => {
        if (errorMessage) setErrorMessage(null);
    }, [invName, invPrice, invWeight, menuName, menuPrice, newCategoryName]);

    const triggerShake = () => {
        shakeOffset.value = withTiming(10, { duration: 50 }, () => {
            shakeOffset.value = withTiming(-10, { duration: 50 }, () => {
                shakeOffset.value = withTiming(0, { duration: 50 });
            });
        });
    };

    const animatedShakeStyle = useAnimatedStyle(() => {
        return { transform: [{ translateX: shakeOffset.value }] };
    });

    const handleNumericInput = (text: string, setter: (val: string) => void) => {
        setter(text.replace(/[^0-9.]/g, ''));
    };

    const uploadImage = async (uri: string): Promise<string> => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const name = `menu/${Date.now()}`;
            const ref = storageRef(storage, name);
            await uploadBytes(ref, blob, { contentType: 'image/jpeg' });
            return await getDownloadURL(ref);
        } catch (e) {
            throw new Error("Upload failed: " + e);
        }
    };

    // --- Actions ---
    const addInventory = async () => {
        if (!invName || !invPrice || !invWeight) {
            triggerShake();
            setErrorMessage("Please fill in all inventory fields.");
            return;
        }
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
        } catch (e: any) {
            setErrorMessage(e.message);
            triggerShake();
        } finally {
            setLoading(false);
        }
    };

    const deleteInventory = (id: string) => {
        if (Platform.OS === 'web') {
            if (confirm("Delete entry?")) remove(dbRef(database, `inventory_log/${id}`));
        } else {
            Alert.alert("Delete", "Are you sure?", [
                { text: "Cancel" },
                { text: "Delete", style: "destructive", onPress: () => remove(dbRef(database, `inventory_log/${id}`)) }
            ]);
        }
    };

    const openMenuModal = (item?: MenuItem) => {
        setErrorMessage(null); 
        if (item) {
            setEditingItem(item);
            setMenuName(item.name);
            setMenuPrice(item.price.toString());
            setMenuImageUrl(item.imageUrl);
            setMenuLocalUri(null);
            setSelectedCategoryId(item.categoryId);
        } else {
            setEditingItem(null);
            setMenuName(''); setMenuPrice(''); setMenuImageUrl(''); setMenuLocalUri(null); setSelectedCategoryId('');
        }
        setMenuModalVisible(true);
    };

    const saveMenuItem = async () => {
        if (!menuName || !menuPrice || !selectedCategoryId) {
            triggerShake();
            setErrorMessage("Please fill in Name, Price, and Category.");
            return;
        }
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
        } catch (e: any) {
            triggerShake();
            setErrorMessage(e.message);
        } finally {
            setLoading(false);
        }
    };

    const deleteMenuItem = (item: MenuItem) => {
        if (Platform.OS === 'web') {
            if (confirm(`Delete ${item.name}?`)) remove(dbRef(database, `menu_items/${item.id}`));
        } else {
            Alert.alert("Delete", `Delete ${item.name}?`, [
                { text: "Cancel" },
                { text: "Delete", style: "destructive", onPress: () => remove(dbRef(database, `menu_items/${item.id}`)) }
            ]);
        }
    };

    const pickMenuImage = async () => {
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5
        });
        if (!res.canceled) {
            setMenuLocalUri(res.assets[0].uri);
            setMenuImageUrl('');
        }
    };

    const addCategory = async () => {
        if (!newCategoryName.trim()) return;
        const ref = push(dbRef(database, 'categories'));
        await set(ref, { name: newCategoryName.trim() });
        setSelectedCategoryId(ref.key!);
        setNewCategoryName('');
    };

    // --- Renderers ---

    const renderHeader = () => (
        <View style={styles.header}>
            <WebScrollbarStyles />
            <View style={styles.headerLeft}>
                <View style={styles.titleContainer}>
                    <Ionicons name="settings-sharp" size={28} color="#38bdf8" />
                    <Text style={styles.headerTitle}>Management</Text>
                </View>
            </View>
            
            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[styles.tabSegment, activeTab === 'inventory' && styles.activeTabSegment]}
                    onPress={() => { setActiveTab('inventory'); setErrorMessage(null); }}
                >
                    <Ionicons name="clipboard-outline" size={18} color={activeTab === 'inventory' ? '#0f172a' : '#94a3b8'} />
                    <Text style={[styles.tabText, activeTab === 'inventory' && styles.activeTabText]}>Inventory</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tabSegment, activeTab === 'menu' && styles.activeTabSegment]}
                    onPress={() => { setActiveTab('menu'); setErrorMessage(null); }}
                >
                    <Ionicons name="fast-food-outline" size={18} color={activeTab === 'menu' ? '#0f172a' : '#94a3b8'} />
                    <Text style={[styles.tabText, activeTab === 'menu' && styles.activeTabText]}>Menu</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderInventory = () => (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <Animated.View style={[styles.card, animatedShakeStyle]}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Daily Inventory Log</Text>
                    <Text style={styles.cardSubtitle}>Track supplies and costs</Text>
                </View>

                {errorMessage && (
                    <Animated.View entering={FadeInDown} style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={20} color="#f87171" />
                        <Text style={styles.errorText}>{errorMessage}</Text>
                    </Animated.View>
                )}

                {/* --- Inventory Form --- */}
                <View style={styles.formGrid}>
                    <View style={styles.inputGroupFull}>
                        <Text style={styles.label}>Item Name</Text>
                        <View style={[styles.inputWrapper, focusedField === 'invName' && styles.inputWrapperFocused]}>
                            <Ionicons name="cube-outline" size={20} color={focusedField === 'invName' ? "#38bdf8" : "#64748b"} style={styles.inputIcon} />
                            <TextInput 
                                style={styles.input} placeholder="e.g. Coffee Beans" placeholderTextColor="#64748b"
                                value={invName} onChangeText={setInvName}
                                onFocus={() => setFocusedField('invName')} onBlur={() => setFocusedField(null)}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroupHalf}>
                        <Text style={styles.label}>Price (PKR)</Text>
                        <View style={[styles.inputWrapper, focusedField === 'invPrice' && styles.inputWrapperFocused]}>
                            <Ionicons name="cash-outline" size={20} color={focusedField === 'invPrice' ? "#38bdf8" : "#64748b"} style={styles.inputIcon} />
                            <TextInput 
                                style={styles.input} placeholder="0.00" placeholderTextColor="#64748b" keyboardType="numeric"
                                value={invPrice} onChangeText={t => handleNumericInput(t, setInvPrice)}
                                onFocus={() => setFocusedField('invPrice')} onBlur={() => setFocusedField(null)}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroupHalf}>
                        <Text style={styles.label}>Weight / Qty</Text>
                        <View style={[styles.inputWrapper, focusedField === 'invWeight' && styles.inputWrapperFocused]}>
                            <Ionicons name="scale-outline" size={20} color={focusedField === 'invWeight' ? "#38bdf8" : "#64748b"} style={styles.inputIcon} />
                            <TextInput 
                                style={styles.input} placeholder="0" placeholderTextColor="#64748b" keyboardType="numeric"
                                value={invWeight} onChangeText={t => handleNumericInput(t, setInvWeight)}
                                onFocus={() => setFocusedField('invWeight')} onBlur={() => setFocusedField(null)}
                            />
                            <TouchableOpacity style={styles.unitToggle} onPress={() => setInvWeightUnit(invWeightUnit === 'KG' ? 'Gram' : 'KG')}>
                                <Text style={styles.unitText}>{invWeightUnit}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <TouchableOpacity style={styles.actionButton} onPress={addInventory} disabled={loading}>
                    {loading ? <ActivityIndicator color="#0f172a" /> : (
                        <>
                            <Ionicons name="add-circle-outline" size={22} color="#0f172a" />
                            <Text style={styles.actionButtonText}>Log Entry</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={styles.divider} />

                {/* --- Animated Inventory List --- */}
                {inventoryList.map((item, index) => (
                    <Animated.View 
                        key={item.date} 
                        layout={LinearTransition.springify().damping(15)}
                        entering={FadeInDown.delay(index * 100).duration(400)}
                        style={styles.accordionContainer}
                    >
                        <TouchableOpacity 
                            style={styles.accordionHeader} 
                            onPress={() => setExpandedDate(expandedDate === item.date ? null : item.date)}
                        >
                            <View style={styles.accordionLeft}>
                                <Ionicons name={expandedDate === item.date ? "chevron-down-circle" : "chevron-forward-circle"} size={24} color="#38bdf8" />
                                <Text style={styles.accordionTitle}>{new Date(item.date).toDateString()}</Text>
                            </View>
                            <View style={styles.accordionBadge}>
                                <Text style={styles.accordionBadgeText}>PKR {item.total.toFixed(0)}</Text>
                            </View>
                        </TouchableOpacity>
                        
                        {expandedDate === item.date && (
                            <Animated.View 
                                entering={FadeIn} 
                                exiting={FadeOut} 
                                style={styles.accordionBody}
                            >
                                {item.items.map(i => (
                                    <View key={i.id} style={styles.logRow}>
                                        <View>
                                            <Text style={styles.logName}>{i.name}</Text>
                                            <Text style={styles.logMeta}>{i.weight}</Text>
                                        </View>
                                        <View style={styles.logRight}>
                                            <Text style={styles.logPrice}>PKR {i.price.toFixed(0)}</Text>
                                            {isAdmin && (
                                                <TouchableOpacity onPress={() => deleteInventory(i.id)} style={styles.deleteMiniBtn}>
                                                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                ))}
                            </Animated.View>
                        )}
                    </Animated.View>
                ))}
            </Animated.View>
        </ScrollView>
    );

    const renderMenu = () => (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.menuHeaderContainer}>
                 <View>
                    <Text style={styles.pageTitle}>Menu Items</Text>
                    <Text style={styles.pageSubtitle}>{menuItems.length} items available</Text>
                 </View>
                 <TouchableOpacity style={styles.fabButton} onPress={() => openMenuModal()}>
                     <Ionicons name="add" size={24} color="#0f172a" />
                     <Text style={styles.fabText}>Add Item</Text>
                 </TouchableOpacity>
            </View>

            {/* --- Animated Menu Grid --- */}
            <View style={styles.gridContainer}>
                {menuItems.map((item, index) => (
                    <Animated.View 
                        key={item.id} 
                        entering={FadeInDown.delay(index * 50).duration(300)}
                        layout={LinearTransition.springify()}
                        style={[styles.menuCard, { width: isLargeScreen ? '31%' : '100%' }]}
                    >
                        <Image source={{ uri: item.imageUrl }} style={styles.menuImage} />
                        <View style={styles.menuContent}>
                            <View style={styles.menuInfo}>
                                <Text style={styles.menuName}>{item.name}</Text>
                                <Text style={styles.menuCategory}>
                                    {categories.find(c => c.id === item.categoryId)?.name || 'Uncategorized'}
                                </Text>
                            </View>
                            <Text style={styles.menuPrice}>PKR {item.price}</Text>
                        </View>
                        
                        {isAdmin && (
                            <View style={styles.menuActionsOverlay}>
                                <TouchableOpacity style={styles.iconCircle} onPress={() => openMenuModal(item)}>
                                    <Ionicons name="pencil" size={18} color="#38bdf8" />
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.iconCircle, { backgroundColor: '#ef444420' }]} onPress={() => deleteMenuItem(item)}>
                                    <Ionicons name="trash" size={18} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </Animated.View>
                ))}
            </View>

            {/* Modal */}
            <Modal visible={isMenuModalVisible} transparent animationType="fade" onRequestClose={() => setMenuModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
                        <Animated.View style={[styles.modalCard, animatedShakeStyle]}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{editingItem ? 'Edit Item' : 'Create Item'}</Text>
                                <TouchableOpacity onPress={() => setMenuModalVisible(false)} style={styles.closeBtn}>
                                    <Ionicons name="close" size={24} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalScroll}>
                                <View style={styles.modalContent}>
                                    {errorMessage && (
                                        <View style={styles.errorContainer}>
                                            <Ionicons name="alert-circle" size={20} color="#f87171" />
                                            <Text style={styles.errorText}>{errorMessage}</Text>
                                        </View>
                                    )}

                                    <TouchableOpacity style={styles.imagePickerBox} onPress={pickMenuImage}>
                                        {menuLocalUri || menuImageUrl ? (
                                            <Image source={{ uri: menuLocalUri || menuImageUrl }} style={styles.previewImage} />
                                        ) : (
                                            <View style={styles.placeholderContent}>
                                                <Ionicons name="cloud-upload-outline" size={40} color="#38bdf8" />
                                                <Text style={styles.uploadText}>Tap to upload image</Text>
                                            </View>
                                        )}
                                        <View style={styles.editImageBadge}>
                                            <Ionicons name="camera" size={16} color="#fff" />
                                        </View>
                                    </TouchableOpacity>
                                    
                                    <View style={styles.inputGroupFull}>
                                        <Text style={styles.label}>Product Name</Text>
                                        <View style={[styles.inputWrapper, focusedField === 'menuName' && styles.inputWrapperFocused]}>
                                            <Ionicons name="fast-food-outline" size={20} color={focusedField === 'menuName' ? "#38bdf8" : "#64748b"} style={styles.inputIcon} />
                                            <TextInput 
                                                style={styles.input} value={menuName} onChangeText={setMenuName} placeholder="Item Name" placeholderTextColor="#64748b" 
                                                onFocus={() => setFocusedField('menuName')} onBlur={() => setFocusedField(null)}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputGroupFull}>
                                        <Text style={styles.label}>Price</Text>
                                        <View style={[styles.inputWrapper, focusedField === 'menuPrice' && styles.inputWrapperFocused]}>
                                            <Text style={styles.currencyPrefix}>PKR</Text>
                                            <TextInput 
                                                style={styles.input} value={menuPrice} onChangeText={t => handleNumericInput(t, setMenuPrice)} keyboardType="numeric" placeholder="0.00" placeholderTextColor="#64748b" 
                                                onFocus={() => setFocusedField('menuPrice')} onBlur={() => setFocusedField(null)}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputGroupFull}>
                                        <Text style={styles.label}>Category</Text>
                                        <View style={styles.chipContainer}>
                                            {categories.map(c => (
                                                <TouchableOpacity key={c.id} style={[styles.chip, selectedCategoryId === c.id && styles.activeChip]} onPress={() => setSelectedCategoryId(c.id)}>
                                                    <Text style={[styles.chipText, selectedCategoryId === c.id && styles.activeChipText]}>{c.name}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                        <View style={styles.addCategoryRow}>
                                            <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }, focusedField === 'newCat' && styles.inputWrapperFocused]}>
                                                <TextInput 
                                                    style={styles.input} placeholder="New Category Name" placeholderTextColor="#64748b" value={newCategoryName} onChangeText={setNewCategoryName}
                                                    onFocus={() => setFocusedField('newCat')} onBlur={() => setFocusedField(null)}
                                                />
                                            </View>
                                            <TouchableOpacity style={styles.addCatBtn} onPress={addCategory}>
                                                <Ionicons name="add" size={24} color="#0f172a" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </ScrollView>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.saveButton} onPress={saveMenuItem} disabled={loading}>
                                    {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </ScrollView>
    );

    return (
        <View style={styles.container}>
            {renderHeader()}
            <View style={styles.contentContainer}>
                {activeTab === 'inventory' ? renderInventory() : renderMenu()}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    contentContainer: { flex: 1 },
    scrollContent: { padding: 24, paddingBottom: 100, alignItems: 'center' },
    
    // Header
    header: { 
        paddingHorizontal: 24, paddingVertical: 20, 
        backgroundColor: 'rgba(15, 23, 42, 0.95)', 
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
    
    // Tabs
    tabContainer: { 
        flexDirection: 'row', backgroundColor: '#1e293b', 
        borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#334155' 
    },
    tabSegment: { 
        flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, 
        borderRadius: 12, gap: 8 
    },
    activeTabSegment: { backgroundColor: '#38bdf8' },
    tabText: { fontWeight: '600', color: '#94a3b8', fontSize: 14 },
    activeTabText: { color: '#0f172a' },

    // Card Styles
    card: {
        width: '100%', maxWidth: 800,
        backgroundColor: '#1e293b', borderRadius: 24, padding: 32,
        borderWidth: 1, borderColor: '#334155',
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
    },
    cardHeader: { marginBottom: 32 },
    cardTitle: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
    cardSubtitle: { fontSize: 14, color: '#94a3b8' },
    
    // Inputs General
    formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    inputGroupFull: { width: '100%', marginBottom: 16 },
    inputGroupHalf: { flex: 1, minWidth: 200, marginBottom: 16 },
    label: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    
    inputWrapper: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', 
        borderRadius: 16, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 16, height: 56,
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
        flex: 1, color: '#f8fafc', fontSize: 16, height: '100%',
        ...Platform.select({ web: { outlineStyle: 'none' } }) 
    },
    
    unitToggle: { backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
    unitText: { color: '#38bdf8', fontWeight: '700', fontSize: 12 },

    // Error Banner
    errorContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.15)', 
        borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
        borderRadius: 12, padding: 12, marginBottom: 20,
        gap: 10,
    },
    errorText: { color: '#fca5a5', fontSize: 14, fontWeight: '600', flex: 1 },

    actionButton: { 
        backgroundColor: '#38bdf8', paddingVertical: 16, borderRadius: 16, 
        alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16,
        shadowColor: "#38bdf8", shadowOpacity: 0.3, shadowRadius: 10, elevation: 4
    },
    actionButtonText: { color: '#0f172a', fontWeight: '800', fontSize: 16 },

    divider: { height: 1, backgroundColor: '#334155', marginVertical: 32 },

    // Accordion List
    accordionContainer: { marginBottom: 12, backgroundColor: '#0f172a', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
    accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: 'rgba(51, 65, 85, 0.3)' },
    accordionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    accordionTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
    accordionBadge: { backgroundColor: '#1e293b', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
    accordionBadgeText: { color: '#38bdf8', fontWeight: '700', fontSize: 12 },
    accordionBody: { padding: 16 },
    logRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    logName: { color: '#f1f5f9', fontWeight: '600', fontSize: 15 },
    logMeta: { color: '#64748b', fontSize: 13 },
    logRight: { alignItems: 'flex-end' },
    logPrice: { color: '#38bdf8', fontWeight: '700' },
    deleteMiniBtn: { marginTop: 4 },

    // Menu Section
    menuHeaderContainer: { width: '100%', maxWidth: 1200, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    pageTitle: { fontSize: 28, fontWeight: '800', color: '#f8fafc' },
    pageSubtitle: { color: '#94a3b8', marginTop: 4 },
    fabButton: { flexDirection: 'row', backgroundColor: '#38bdf8', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, alignItems: 'center', shadowColor: '#38bdf8', shadowOpacity: 0.4, elevation: 5 },
    fabText: { color: '#0f172a', fontWeight: '700', marginLeft: 8 },
    
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, width: '100%', maxWidth: 1200 },
    menuCard: { 
        backgroundColor: '#1e293b', borderRadius: 24, overflow: 'hidden', 
        borderWidth: 1, borderColor: '#334155', position: 'relative',
        shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
    },
    menuImage: { width: '100%', height: 180, resizeMode: 'cover' },
    menuContent: { padding: 20 },
    menuInfo: { marginBottom: 8 },
    menuName: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
    menuCategory: { fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
    menuPrice: { fontSize: 18, fontWeight: '700', color: '#38bdf8' },
    menuActionsOverlay: { position: 'absolute', top: 12, right: 12, flexDirection: 'column', gap: 8 },
    iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(15, 23, 42, 0.9)', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContainer: { width: '100%', alignItems: 'center' },
    modalCard: { width: '100%', maxWidth: 500, backgroundColor: '#1e293b', borderRadius: 24, borderWidth: 1, borderColor: '#334155', overflow: 'hidden', maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#334155', backgroundColor: '#1e293b' },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#f8fafc' },
    closeBtn: { padding: 4 },
    modalScroll: { maxHeight: 600 },
    modalContent: { padding: 24 },
    
    imagePickerBox: { 
        width: '100%', height: 200, backgroundColor: '#0f172a', borderRadius: 20, 
        borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed',
        justifyContent: 'center', alignItems: 'center', marginBottom: 24, overflow: 'hidden', position: 'relative'
    },
    placeholderContent: { alignItems: 'center', gap: 8 },
    uploadText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
    previewImage: { width: '100%', height: '100%' },
    editImageBadge: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 20 },
    
    currencyPrefix: { color: '#64748b', fontWeight: '700', marginRight: 8 },
    chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155' },
    activeChip: { backgroundColor: '#38bdf8', borderColor: '#38bdf8' },
    chipText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
    activeChipText: { color: '#0f172a' },
    addCategoryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    addCatBtn: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#38bdf8', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    
    modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#334155', backgroundColor: '#1e293b' },
    saveButton: { backgroundColor: '#38bdf8', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
    saveButtonText: { color: '#0f172a', fontWeight: '800', fontSize: 16 }
});