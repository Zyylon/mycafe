import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref as dbRef, onValue, push, remove, set, update } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
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
    ZoomIn,
    ZoomOut
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { database, storage } from '../../services/firebase';

// --- Type Definitions ---
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

// --- Web Specific Styles ---
const WebScrollbarStyles = () => {
    if (Platform.OS !== 'web') return null;
    return (
        <style type="text/css">
            {`
            ::-webkit-scrollbar { width: 0px; background: transparent; }
            input:focus, textarea:focus, select:focus { outline: none; }
            `}
        </style>
    );
};

export default function ManagementScreen() {
    const { userData } = useAuth();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    
    // Responsive Breakpoints
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;

    const [activeTab, setActiveTab] = useState<'inventory' | 'menu'>('inventory');
    const [loading, setLoading] = useState(false);
    const isAdmin = userData?.role === 'admin' || userData?.role === 'superadmin';

    // --- State: Menu ---
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isMenuModalVisible, setMenuModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

    // Menu Form State
    const [menuName, setMenuName] = useState('');
    const [menuPrice, setMenuPrice] = useState('');
    const [menuImageUrl, setMenuImageUrl] = useState('');
    const [menuLocalUri, setMenuLocalUri] = useState<string | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');

    // --- State: Inventory ---
    const [inventoryList, setInventoryList] = useState<GroupedInventory[]>([]);
    const [expandedDate, setExpandedDate] = useState<string | null>(null);

    // Inventory Form State
    const [invName, setInvName] = useState('');
    const [invPrice, setInvPrice] = useState('');
    const [invWeight, setInvWeight] = useState('');
    const [invWeightUnit, setInvWeightUnit] = useState<'KG' | 'Gram'>('KG');

    // --- UI Interaction State ---
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const shakeOffset = useSharedValue(0);

    // --- Data Fetching ---
    useEffect(() => {
        const catRef = dbRef(database, 'categories');
        const menuRef = dbRef(database, 'menu_items');
        const invRef = dbRef(database, 'inventory_log');

        const unsubCat = onValue(catRef, (snap) => {
            const data = snap.val();
            setCategories(data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : []);
        });

        const unsubMenu = onValue(menuRef, (snap) => {
            const data = snap.val();
            setMenuItems(data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : []);
        });

        const unsubInv = onValue(invRef, (snap) => {
            const data = snap.val();
            if (data) {
                const raw: InventoryItem[] = Object.keys(data).map(k => ({ id: k, ...data[k] }));
                const grouped: { [key: string]: GroupedInventory } = {};
                
                raw.forEach(item => {
                    if (!grouped[item.date]) {
                        grouped[item.date] = { date: item.date, total: 0, items: [] };
                    }
                    grouped[item.date].items.push(item);
                    grouped[item.date].total += item.price;
                });
                
                // Sort by date descending
                setInventoryList(Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)));
            } else {
                setInventoryList([]);
            }
        });

        return () => {
            unsubCat();
            unsubMenu();
            unsubInv();
        };
    }, []);

    // Clear validation errors on input
    useEffect(() => {
        if (errorMessage) setErrorMessage(null);
    }, [invName, invPrice, invWeight, menuName, menuPrice, newCategoryName]);

    // --- Helper Functions ---
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
            const url = await getDownloadURL(ref);
            return url;
        } catch (e) {
            console.error(e);
            throw new Error("Image upload failed");
        }
    };

    // --- Inventory CRUD ---
    const addInventory = async () => {
        if (!invName || !invPrice || !invWeight) {
            triggerShake();
            setErrorMessage("All fields are required.");
            return;
        }
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const newItem = {
                name: invName,
                price: parseFloat(invPrice),
                weight: `${invWeight} ${invWeightUnit}`,
                date: today,
                timestamp: Date.now()
            };
            await set(push(dbRef(database, 'inventory_log')), newItem);
            setInvName(''); setInvPrice(''); setInvWeight('');
        } catch (e: any) {
            setErrorMessage(e.message);
            triggerShake();
        } finally {
            setLoading(false);
        }
    };

    const deleteInventory = (id: string) => {
        const confirmDelete = () => remove(dbRef(database, `inventory_log/${id}`));
        
        if (Platform.OS === 'web') {
            if (confirm("Delete this entry?")) confirmDelete();
        } else {
            Alert.alert("Confirm Delete", "Are you sure you want to remove this entry?", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: confirmDelete }
            ]);
        }
    };

    // --- Menu CRUD ---
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
            setErrorMessage("Name, Price, and Category are required.");
            return;
        }
        setLoading(true);
        try {
            let url = menuImageUrl;
            if (menuLocalUri) {
                url = await uploadImage(menuLocalUri);
            }

            const data = {
                name: menuName,
                price: parseFloat(menuPrice),
                imageUrl: url,
                categoryId: selectedCategoryId
            };

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
        const confirmDelete = () => remove(dbRef(database, `menu_items/${item.id}`));

        if (Platform.OS === 'web') {
            if (confirm(`Delete ${item.name}?`)) confirmDelete();
        } else {
            Alert.alert("Delete Item", `Are you sure you want to delete ${item.name}?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: confirmDelete }
            ]);
        }
    };

    const pickMenuImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.6,
        });

        if (!result.canceled) {
            setMenuLocalUri(result.assets[0].uri);
            setMenuImageUrl(''); // Clear remote URL to prefer local
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
        <View style={[styles.header, isMobile && styles.headerMobile]}>
            <WebScrollbarStyles />
            <View style={styles.headerContent}>
                <View style={styles.titleRow}>
                    <View style={styles.iconBox}>
                        <Ionicons 
                            name={activeTab === 'inventory' ? "clipboard" : "fast-food"} 
                            size={isMobile ? 20 : 24} 
                            color="#38bdf8" 
                        />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>
                            {activeTab === 'inventory' ? 'Inventory Log' : 'Menu Catalog'}
                        </Text>
                        {!isMobile && (
                            <Text style={styles.headerSubtitle}>
                                {activeTab === 'inventory' ? 'Track supplies & costs' : 'Manage your products'}
                            </Text>
                        )}
                    </View>
                </View>

                {activeTab === 'menu' && (
                    <TouchableOpacity style={styles.headerAddBtn} onPress={() => openMenuModal()}>
                        <Ionicons name="add" size={20} color="#0f172a" />
                        <Text style={styles.headerAddBtnText}>{isMobile ? 'New' : 'New Item'}</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const renderInventoryTab = () => (
        <ScrollView contentContainerStyle={[styles.scrollContent, isMobile && { paddingHorizontal: 16, paddingBottom: 150 }]}>
            
            {/* INVENTORY FORM */}
            <Animated.View style={[styles.card, isMobile && styles.cardMobile, animatedShakeStyle]}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Add Supply Entry</Text>
                    {!isMobile && <Text style={styles.cardSubtitle}>Log daily purchases</Text>}
                </View>

                {errorMessage && (
                    <Animated.View entering={FadeInDown} style={styles.errorBanner}>
                        <Ionicons name="alert-circle" size={20} color="#f87171" />
                        <Text style={styles.errorText}>{errorMessage}</Text>
                    </Animated.View>
                )}

                <View style={styles.formGrid}>
                    <View style={styles.inputGroupFull}>
                        <Text style={styles.label}>Item Name</Text>
                        <View style={[styles.inputWrapper, focusedField === 'invName' && styles.inputWrapperFocused]}>
                            <Ionicons name="cube-outline" size={20} color={focusedField === 'invName' ? "#38bdf8" : "#64748b"} />
                            <TextInput 
                                style={styles.input} 
                                placeholder="e.g. Flour 50KG" 
                                placeholderTextColor="#64748b"
                                value={invName} 
                                onChangeText={setInvName}
                                onFocus={() => setFocusedField('invName')} 
                                onBlur={() => setFocusedField(null)}
                            />
                        </View>
                    </View>

                    {/* Mobile Friendly Row for Price & Weight */}
                    <View style={styles.rowInputs}>
                        <View style={styles.inputGroupHalf}>
                            <Text style={styles.label}>Price (PKR)</Text>
                            <View style={[styles.inputWrapper, focusedField === 'invPrice' && styles.inputWrapperFocused]}>
                                <Text style={styles.prefix}>Rs.</Text>
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="0" 
                                    placeholderTextColor="#64748b"
                                    keyboardType="numeric"
                                    value={invPrice} 
                                    onChangeText={t => handleNumericInput(t, setInvPrice)}
                                    onFocus={() => setFocusedField('invPrice')} 
                                    onBlur={() => setFocusedField(null)}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroupHalf}>
                            <Text style={styles.label}>Weight</Text>
                            <View style={[styles.inputWrapper, styles.inputWrapperNoPad, focusedField === 'invWeight' && styles.inputWrapperFocused]}>
                                <TextInput 
                                    style={[styles.input, { paddingLeft: 16 }]} 
                                    placeholder="0" 
                                    placeholderTextColor="#64748b"
                                    keyboardType="numeric"
                                    value={invWeight} 
                                    onChangeText={t => handleNumericInput(t, setInvWeight)}
                                    onFocus={() => setFocusedField('invWeight')} 
                                    onBlur={() => setFocusedField(null)}
                                />
                                {/* FIXED UNIT TOGGLE FOR MOBILE */}
                                <Pressable 
                                    style={styles.unitToggleBtn} 
                                    onPress={() => setInvWeightUnit(prev => prev === 'KG' ? 'Gram' : 'KG')}
                                >
                                    <Text style={styles.unitToggleText}>{invWeightUnit}</Text>
                                    <Ionicons name="chevron-down" size={12} color="#38bdf8" />
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </View>

                <TouchableOpacity style={styles.saveButton} onPress={addInventory} disabled={loading}>
                    {loading ? <ActivityIndicator color="#0f172a" /> : (
                        <>
                            <Ionicons name="save-outline" size={18} color="#0f172a" />
                            <Text style={styles.saveButtonText}>Log Entry</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={styles.divider} />

                {/* INVENTORY LIST */}
                {inventoryList.map((group, index) => (
                    <Animated.View 
                        key={group.date}
                        entering={FadeInDown.delay(index * 100).duration(400)}
                        layout={LinearTransition}
                        style={styles.historyGroup}
                    >
                        <Pressable 
                            style={styles.groupHeader}
                            onPress={() => setExpandedDate(expandedDate === group.date ? null : group.date)}
                        >
                            <View style={styles.groupHeaderLeft}>
                                <Ionicons 
                                    name={expandedDate === group.date ? "chevron-down" : "chevron-forward"} 
                                    size={18} color="#94a3b8" 
                                />
                                <Text style={styles.groupDate}>{new Date(group.date).toDateString()}</Text>
                            </View>
                            <View style={styles.groupTotalBadge}>
                                <Text style={styles.groupTotalText}>Rs. {group.total.toLocaleString()}</Text>
                            </View>
                        </Pressable>

                        {expandedDate === group.date && (
                            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.groupBody}>
                                {group.items.map(item => (
                                    <View key={item.id} style={styles.logItem}>
                                        <View>
                                            <Text style={styles.logItemName}>{item.name}</Text>
                                            <Text style={styles.logItemMeta}>{item.weight}</Text>
                                        </View>
                                        <View style={styles.logItemRight}>
                                            <Text style={styles.logItemPrice}>{item.price.toLocaleString()}</Text>
                                            {isAdmin && (
                                                <TouchableOpacity onPress={() => deleteInventory(item.id)} style={styles.deleteIcon}>
                                                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
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

    const renderMenuTab = () => (
        <ScrollView contentContainerStyle={[styles.scrollContent, isMobile && { padding: 12, paddingBottom: 150 }]}>
            <View style={styles.menuGrid}>
                {menuItems.map((item, index) => (
                    <Animated.View 
                        key={item.id}
                        entering={FadeInDown.delay(index * 50)}
                        layout={LinearTransition}
                        style={[
                            styles.menuCard,
                            // Responsive Width Calculation
                            { width: isMobile ? '100%' : isTablet ? '48%' : '31%' } 
                        ]}
                    >
                        <Image source={{ uri: item.imageUrl }} style={styles.menuCardImage} />
                        <View style={styles.menuCardContent}>
                            <View>
                                <Text style={styles.menuCardTitle} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.menuCardCategory}>
                                    {categories.find(c => c.id === item.categoryId)?.name || 'Uncategorized'}
                                </Text>
                            </View>
                            <Text style={styles.menuCardPrice}>PKR {item.price}</Text>
                        </View>
                        
                        {isAdmin && (
                            <View style={styles.cardActions}>
                                <TouchableOpacity style={styles.actionIcon} onPress={() => openMenuModal(item)}>
                                    <Ionicons name="pencil" size={16} color="#38bdf8" />
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.actionIcon, styles.deleteAction]} onPress={() => deleteMenuItem(item)}>
                                    <Ionicons name="trash" size={16} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </Animated.View>
                ))}
            </View>
        </ScrollView>
    );

    // --- MAIN RENDER ---
    return (
        <View style={[styles.container, { paddingTop: isMobile ? insets.top : 0 }]}>
            {renderHeader()}
            
            <View style={styles.content}>
                {activeTab === 'inventory' ? renderInventoryTab() : renderMenuTab()}
            </View>

            {/* Floating Mode Switcher (Icon Only) */}
            <Pressable 
                style={[styles.fabSwitch, isMobile && { bottom: 120, right: 20 }]}
                onPress={() => setActiveTab(prev => prev === 'inventory' ? 'menu' : 'inventory')}
            >
                <Animated.View 
                    key={activeTab} 
                    entering={ZoomIn} 
                    exiting={ZoomOut}
                    style={styles.fabInner}
                >
                    <Ionicons 
                        name={activeTab === 'inventory' ? "fast-food" : "clipboard"} 
                        size={26} 
                        color="#0f172a" 
                    />
                </Animated.View>
            </Pressable>

            {/* Menu Item Modal */}
            <Modal 
                visible={isMenuModalVisible} 
                transparent 
                animationType="fade" 
                onRequestClose={() => setMenuModalVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                        style={[styles.modalKeyboardAvoid, isMobile && { justifyContent: 'flex-end' }]}
                    >
                        <Animated.View style={[styles.modalSurface, isMobile && styles.modalSurfaceMobile, animatedShakeStyle]}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{editingItem ? 'Edit Item' : 'New Product'}</Text>
                                <TouchableOpacity onPress={() => setMenuModalVisible(false)} style={styles.modalClose}>
                                    <Ionicons name="close" size={24} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                                <View style={styles.modalForm}>
                                    
                                    {/* Image Uploader */}
                                    <TouchableOpacity style={styles.uploadBox} onPress={pickMenuImage}>
                                        {menuLocalUri || menuImageUrl ? (
                                            <Image source={{ uri: menuLocalUri || menuImageUrl }} style={styles.uploadPreview} />
                                        ) : (
                                            <View style={styles.uploadPlaceholder}>
                                                <Ionicons name="cloud-upload-outline" size={32} color="#38bdf8" />
                                                <Text style={styles.uploadText}>Upload Photo</Text>
                                            </View>
                                        )}
                                        <View style={styles.cameraIcon}>
                                            <Ionicons name="camera" size={14} color="#fff" />
                                        </View>
                                    </TouchableOpacity>

                                    {/* Name Input */}
                                    <View style={styles.inputGroupFull}>
                                        <Text style={styles.label}>Product Name</Text>
                                        <View style={[styles.inputWrapper, focusedField === 'menuName' && styles.inputWrapperFocused]}>
                                            <Ionicons name="fast-food-outline" size={20} color={focusedField === 'menuName' ? "#38bdf8" : "#64748b"} />
                                            <TextInput 
                                                style={styles.input} 
                                                value={menuName} 
                                                onChangeText={setMenuName} 
                                                placeholder="e.g. Zinger Burger" 
                                                placeholderTextColor="#64748b" 
                                                onFocus={() => setFocusedField('menuName')} 
                                                onBlur={() => setFocusedField(null)}
                                            />
                                        </View>
                                    </View>

                                    {/* Price & Category Row */}
                                    <View style={styles.rowInputs}>
                                        <View style={styles.inputGroupHalf}>
                                            <Text style={styles.label}>Price</Text>
                                            <View style={[styles.inputWrapper, focusedField === 'menuPrice' && styles.inputWrapperFocused]}>
                                                <Text style={styles.prefix}>Rs.</Text>
                                                <TextInput 
                                                    style={styles.input} 
                                                    value={menuPrice} 
                                                    onChangeText={t => handleNumericInput(t, setMenuPrice)} 
                                                    keyboardType="numeric" 
                                                    placeholder="0" 
                                                    placeholderTextColor="#64748b" 
                                                    onFocus={() => setFocusedField('menuPrice')} 
                                                    onBlur={() => setFocusedField(null)}
                                                />
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.inputGroupFull}>
                                        <Text style={styles.label}>Category</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                                            {categories.map(c => (
                                                <TouchableOpacity 
                                                    key={c.id} 
                                                    style={[styles.chip, selectedCategoryId === c.id && styles.chipActive]} 
                                                    onPress={() => setSelectedCategoryId(c.id)}
                                                >
                                                    <Text style={[styles.chipText, selectedCategoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                        
                                        <View style={styles.addCatRow}>
                                            <View style={[styles.inputWrapper, { flex: 1, height: 44 }, focusedField === 'newCat' && styles.inputWrapperFocused]}>
                                                <TextInput 
                                                    style={styles.input} 
                                                    placeholder="New Category" 
                                                    placeholderTextColor="#64748b" 
                                                    value={newCategoryName} 
                                                    onChangeText={setNewCategoryName}
                                                    onFocus={() => setFocusedField('newCat')} 
                                                    onBlur={() => setFocusedField(null)}
                                                />
                                            </View>
                                            <TouchableOpacity style={styles.addCatBtn} onPress={addCategory}>
                                                <Ionicons name="add" size={24} color="#0f172a" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {errorMessage && (
                                        <Text style={styles.errorTextSimple}>{errorMessage}</Text>
                                    )}

                                </View>
                            </ScrollView>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.saveButton} onPress={saveMenuItem} disabled={loading}>
                                    {loading ? <ActivityIndicator color="#0f172a" /> : (
                                        <Text style={styles.saveButtonText}>Save Item</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    content: { flex: 1 },
    scrollContent: { padding: 24, paddingBottom: 100 },

    // --- Header ---
    header: { 
        paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#0f172a',
        borderBottomWidth: 1, borderBottomColor: '#1e293b'
    },
    headerMobile: { paddingHorizontal: 16, paddingVertical: 12 },
    headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(56, 189, 248, 0.1)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#f8fafc', letterSpacing: 0.5 },
    headerSubtitle: { fontSize: 13, color: '#94a3b8' },
    headerAddBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#38bdf8', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, gap: 6 },
    headerAddBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 14 },

    // --- Inventory Card ---
    card: { 
        width: '100%', maxWidth: 700, alignSelf: 'center',
        backgroundColor: '#1e293b', borderRadius: 24, padding: 24,
        borderWidth: 1, borderColor: '#334155',
        shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10
    },
    cardMobile: { padding: 16, borderRadius: 16 },
    cardHeader: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 12 },
    cardTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
    cardSubtitle: { fontSize: 13, color: '#64748b' },

    // --- Forms ---
    formGrid: { gap: 16 },
    rowInputs: { flexDirection: 'row', gap: 12 },
    inputGroupFull: { width: '100%' },
    inputGroupHalf: { flex: 1 },
    
    label: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    
    inputWrapper: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', 
        borderRadius: 12, borderWidth: 1, borderColor: '#334155', height: 50, paddingHorizontal: 12,
        ...Platform.select({ web: { transition: 'border-color 0.2s' } })
    },
    inputWrapperNoPad: { paddingRight: 4 }, // For unit toggle
    inputWrapperFocused: { borderColor: '#38bdf8', backgroundColor: '#162032' },
    
    input: { flex: 1, color: '#f8fafc', fontSize: 15, height: '100%', outlineStyle: 'none' } as any,
    prefix: { color: '#64748b', marginRight: 8, fontSize: 15 },
    
    // Robust Unit Toggle
    unitToggleBtn: { 
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#1e293b', paddingHorizontal: 10, paddingVertical: 6, 
        borderRadius: 8, borderWidth: 1, borderColor: '#334155' 
    },
    unitToggleText: { color: '#38bdf8', fontWeight: '700', fontSize: 12 },

    saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#38bdf8', borderRadius: 12, paddingVertical: 14, gap: 8, marginTop: 8 },
    saveButtonText: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
    errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 12, marginBottom: 16, gap: 8 },
    errorText: { color: '#f87171', fontSize: 13, flex: 1 },
    errorTextSimple: { color: '#f87171', fontSize: 13, marginTop: 10, textAlign: 'center' },
    divider: { height: 1, backgroundColor: '#334155', marginVertical: 24 },

    // --- History List ---
    historyGroup: { marginBottom: 12, backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
    groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
    groupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    groupDate: { color: '#f8fafc', fontSize: 15, fontWeight: '600' },
    groupTotalBadge: { backgroundColor: '#1e293b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
    groupTotalText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
    groupBody: { padding: 14, paddingTop: 0, gap: 12 },
    logItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    logItemName: { color: '#cbd5e1', fontSize: 14, fontWeight: '500' },
    logItemMeta: { color: '#64748b', fontSize: 12 },
    logItemRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logItemPrice: { color: '#38bdf8', fontSize: 14, fontWeight: '700' },
    deleteIcon: { padding: 4 },

    // --- Menu Grid ---
    menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, width: '100%', maxWidth: 1200, alignSelf: 'center' },
    menuCard: { backgroundColor: '#1e293b', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#334155', position: 'relative' },
    menuCardImage: { width: '100%', height: 160, backgroundColor: '#0f172a' },
    menuCardContent: { padding: 16, gap: 12 },
    menuCardTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
    menuCardCategory: { color: '#64748b', fontSize: 11, textTransform: 'uppercase', marginTop: 2 },
    menuCardPrice: { color: '#38bdf8', fontSize: 16, fontWeight: '700' },
    cardActions: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 8 },
    actionIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155' },
    deleteAction: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' },

    // --- FAB Switch ---
    fabSwitch: { position: 'absolute', bottom: 30, right: 30, zIndex: 50 },
    fabInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#38bdf8', alignItems: 'center', justifyContent: 'center', shadowColor: "#38bdf8", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },

    // --- Modal ---
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
    modalKeyboardAvoid: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalSurface: { width: '100%', maxWidth: 450, backgroundColor: '#1e293b', borderRadius: 24, borderWidth: 1, borderColor: '#334155', maxHeight: '85%', overflow: 'hidden', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20 },
    modalSurfaceMobile: { width: '100%', borderRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#334155' },
    modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
    modalClose: { padding: 4 },
    modalScroll: { flex: 1 },
    modalForm: { padding: 24, gap: 16 },
    
    uploadBox: { width: '100%', height: 160, backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#334155', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    uploadPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
    uploadPlaceholder: { alignItems: 'center', gap: 8 },
    uploadText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
    cameraIcon: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 20 },

    chipsScroll: { gap: 8, paddingBottom: 4 },
    chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155' },
    chipActive: { backgroundColor: '#38bdf8', borderColor: '#38bdf8' },
    chipText: { color: '#94a3b8', fontSize: 12 },
    chipTextActive: { color: '#0f172a', fontWeight: '700' },
    
    addCatRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    addCatBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#38bdf8', alignItems: 'center', justifyContent: 'center' },
    
    modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#334155', backgroundColor: '#1e293b' },
});