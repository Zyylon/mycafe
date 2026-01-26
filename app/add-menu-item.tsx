import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ref as dbRef, onValue, push, remove, set } from 'firebase/database';
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
    View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database, storage } from '../lib/firebaseConfig';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// --- Interfaces ---
interface InventoryItem {
    id: string;
    name: string;
    price: number;
    weight: string;
    date: string; // ISO String YYYY-MM-DD
    timestamp: number;
}

interface GroupedInventory {
    date: string;
    total: number;
    items: InventoryItem[];
}

export default function ManageMenuAndInventoryScreen() {
  const router = useRouter();
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState<'inventory' | 'menu'>('inventory');
  const [loading, setLoading] = useState(false);
  const isAdmin = userData?.role === 'admin' || userData?.role === 'superadmin';

  // --- Inventory State ---
  const [invName, setInvName] = useState('');
  const [invPrice, setInvPrice] = useState('');
  const [invWeight, setInvWeight] = useState('');
  const [invWeightUnit, setInvWeightUnit] = useState<'KG' | 'Gram'>('KG'); // Default unit
  const [inventoryList, setInventoryList] = useState<GroupedInventory[]>([]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  // --- Menu State ---
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);

  useEffect(() => {
    // Fetch Categories
    const categoriesRef = dbRef(database, 'categories');
    onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const categoryList = Object.keys(data).map(key => ({
          id: key,
          name: data[key].name
        }));
        setCategories(categoryList);
      }
    });

    // Fetch Inventory
    const inventoryRef = dbRef(database, 'inventory_log');
    onValue(inventoryRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const rawItems: InventoryItem[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            
            // Group by Date
            const grouped: { [key: string]: GroupedInventory } = {};
            rawItems.forEach(item => {
                if (!grouped[item.date]) {
                    grouped[item.date] = { date: item.date, total: 0, items: [] };
                }
                grouped[item.date].items.push(item);
                grouped[item.date].total += item.price;
            });

            // Convert to array and sort by date descending
            const sortedList = Object.values(grouped).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setInventoryList(sortedList);
        } else {
            setInventoryList([]);
        }
    });
  }, []);

  // --- Helper: Numeric Input Handler ---
  const handleNumericInput = (text: string, setter: (val: string) => void) => {
      const numericValue = text.replace(/[^0-9.]/g, '');
      setter(numericValue);
  };

  // --- Inventory Functions ---
  const handleAddInventory = async () => {
      if (!invName.trim() || !invPrice.trim() || !invWeight.trim()) {
          Alert.alert("Error", "Please fill all fields.");
          return;
      }
      const priceVal = parseFloat(invPrice);
      if (isNaN(priceVal) || priceVal <= 0) {
          Alert.alert("Error", "Invalid price.");
          return;
      }

      setLoading(true);
      try {
          const newItemRef = push(dbRef(database, 'inventory_log'));
          const today = new Date().toISOString().split('T')[0];
          await set(newItemRef, {
              name: invName.trim(),
              price: priceVal,
              weight: `${invWeight.trim()} ${invWeightUnit}`,
              date: today,
              timestamp: Date.now()
          });
          setInvName('');
          setInvPrice('');
          setInvWeight('');
          Alert.alert("Success", "Inventory added.");
      } catch (error: any) {
          Alert.alert("Error", error.message);
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteInventory = async (id: string) => {
      if (!isAdmin) return;
      if (Platform.OS === 'web') {
          if (confirm("Delete this inventory item?")) {
              await remove(dbRef(database, `inventory_log/${id}`));
          }
      } else {
          Alert.alert("Delete", "Delete this item?", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: async () => await remove(dbRef(database, `inventory_log/${id}`)) }
          ]);
      }
  };

  const toggleExpand = (date: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedDate(expandedDate === date ? null : date);
  };

  // --- Menu Functions ---
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need permission to access your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
        setLocalImageUri(result.assets[0].uri);
        setImageUrl(''); 
    }
  };

  const uploadImage = (uri: string): Promise<string> => {
      return new Promise(async (resolve, reject) => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const imageName = `menu_items/${Date.now()}`;
            const imageRef = storageRef(storage, imageName);
            
            await uploadBytes(imageRef, blob);
            const url = await getDownloadURL(imageRef);
            resolve(url);
        } catch (error) {
            console.error("Upload Error:", error);
            reject(new Error("Image upload failed."));
        }
    });
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    const newCategoryName = newCategory.trim();
    try {
        const categoryRef = push(dbRef(database, 'categories'));
        await set(categoryRef, { name: newCategoryName });
        setSelectedCategory(categoryRef.key);
        setNewCategory('');
        Alert.alert('Success', `Category "${newCategoryName}" added.`);
    } catch (error) {
        Alert.alert('Error', 'Failed to add category.');
    }
  };

  const handleAddItem = async () => {
    if (!name.trim() || !price.trim() || !selectedCategory) {
      Alert.alert('Error', 'Please fill all required fields.');
      return;
    }
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
        Alert.alert('Error', 'Invalid price.');
        return;
    }

    setLoading(true);
    try {
      let finalImageUrl = imageUrl.trim();
      if (localImageUri) {
          finalImageUrl = await uploadImage(localImageUri);
      }
      
      const menuItemsRef = dbRef(database, 'menu_items');
      const newItemRef = push(menuItemsRef);
      await set(newItemRef, {
        name: name.trim(),
        price: priceValue,
        imageUrl: finalImageUrl,
        categoryId: selectedCategory,
      });

      Alert.alert('Success', 'Menu item added!');
      setName('');
      setPrice('');
      setImageUrl('');
      setLocalImageUri(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to add item.');
    } finally {
      setLoading(false);
    }
  };

  // --- Renderers ---

  const renderInventoryTab = () => (
      <View style={styles.tabContent}>
          <View style={styles.webContainer}>
            <View style={styles.addInvContainer}>
                <Text style={styles.sectionHeader}>Add Daily Inventory</Text>
                
                <View style={styles.formRow}>
                    <TextInput 
                        style={[styles.input, {flex: 2}]} 
                        placeholder="Item Name" 
                        value={invName} 
                        onChangeText={setInvName} 
                        placeholderTextColor="#64748b" 
                    />
                    <View style={[styles.inputContainer, {flex: 1.5}]}>
                        <TextInput 
                            style={styles.inputField} 
                            placeholder="Price" 
                            value={invPrice} 
                            onChangeText={(text) => handleNumericInput(text, setInvPrice)}
                            keyboardType="numeric" 
                            placeholderTextColor="#64748b" 
                        />
                        <Text style={styles.suffixText}>PKR</Text>
                    </View>
                </View>

                <View style={styles.inputContainer}>
                    <TextInput 
                        style={styles.inputField} 
                        placeholder="Weight/Qty" 
                        value={invWeight} 
                        onChangeText={(text) => handleNumericInput(text, setInvWeight)}
                        keyboardType="numeric" 
                        placeholderTextColor="#64748b" 
                    />
                    <View style={styles.embeddedUnitSelector}>
                        <Pressable 
                            style={[styles.embeddedUnitBtn, invWeightUnit === 'KG' && styles.embeddedUnitBtnActive]} 
                            onPress={() => setInvWeightUnit('KG')}
                        >
                            <Text style={[styles.embeddedUnitText, invWeightUnit === 'KG' && styles.embeddedUnitTextActive]}>KG</Text>
                        </Pressable>
                        <Pressable 
                            style={[styles.embeddedUnitBtn, invWeightUnit === 'Gram' && styles.embeddedUnitBtnActive]} 
                            onPress={() => setInvWeightUnit('Gram')}
                        >
                            <Text style={[styles.embeddedUnitText, invWeightUnit === 'Gram' && styles.embeddedUnitTextActive]}>G</Text>
                        </Pressable>
                    </View>
                </View>

                <Pressable style={styles.addButton} onPress={handleAddInventory}>
                    <Text style={styles.addButtonText}>Add to Inventory</Text>
                </Pressable>
            </View>

            <FlatList 
                data={inventoryList}
                keyExtractor={item => item.date}
                renderItem={({ item }) => {
                    const isExpanded = expandedDate === item.date;
                    return (
                        <View style={styles.dayCard}>
                            <Pressable style={styles.dayHeader} onPress={() => toggleExpand(item.date)}>
                                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                    <Ionicons name={isExpanded ? "chevron-down" : "chevron-forward"} size={20} color="#94a3b8" style={{marginRight: 10}} />
                                    <Text style={styles.dayTitle}>{new Date(item.date).toDateString()}</Text>
                                </View>
                                <Text style={styles.dayTotal}>Total: PKR {item.total.toFixed(2)}</Text>
                            </Pressable>
                            {isExpanded && (
                                <View style={styles.dayDetails}>
                                    {item.items.map(invItem => (
                                        <View key={invItem.id} style={styles.invItemRow}>
                                            <View>
                                                <Text style={styles.invItemName}>{invItem.name}</Text>
                                                <Text style={styles.invItemWeight}>{invItem.weight}</Text>
                                            </View>
                                            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                                <Text style={styles.invItemPrice}>PKR {invItem.price.toFixed(2)}</Text>
                                                {isAdmin && (
                                                    <Pressable onPress={() => handleDeleteInventory(invItem.id)} style={{marginLeft: 15}}>
                                                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                                    </Pressable>
                                                )}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                }}
                contentContainerStyle={{paddingBottom: 20}}
            />
          </View>
      </View>
  );

  const renderMenuTab = () => (
      <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={[styles.formContainer, styles.webContainer]}>
                <Pressable style={styles.imagePicker} onPress={pickImage}>
                    {localImageUri ? (
                        <Image source={{ uri: localImageUri }} style={styles.imagePreview} />
                    ) : imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
                    ) : (
                        <View style={styles.imagePlaceholder}>
                            <Ionicons name="image-outline" size={50} color="#64748b" />
                            <Text style={styles.imagePickerText}>Select Image</Text>
                        </View>
                    )}
                </Pressable>
                <Text style={styles.orText}>or paste image URL</Text>
                <TextInput style={styles.input} placeholder="Image URL" value={imageUrl} onChangeText={(text) => { setImageUrl(text); setLocalImageUri(null); }} placeholderTextColor="#64748b" />

                <TextInput style={styles.input} placeholder="Item Name" value={name} onChangeText={setName} placeholderTextColor="#64748b" />
                
                <View style={styles.inputContainer}>
                    <TextInput 
                        style={styles.inputField} 
                        placeholder="Price" 
                        value={price} 
                        onChangeText={(text) => handleNumericInput(text, setPrice)}
                        keyboardType="numeric" 
                        placeholderTextColor="#64748b" 
                    />
                    <Text style={styles.suffixText}>PKR</Text>
                </View>
                
                <Pressable style={styles.input} onPress={() => setCategoryModalVisible(true)}>
                  <Text style={{color: selectedCategory ? '#f1f5f9': '#64748b'}}>{categories.find(c => c.id === selectedCategory)?.name || 'Select Category'}</Text>
                </Pressable>
                
                <View style={styles.newCategoryContainer}>
                  <TextInput
                    style={[styles.input, {flex: 1, marginBottom: 0}]}
                    placeholder="New Category"
                    value={newCategory}
                    onChangeText={setNewCategory}
                    placeholderTextColor="#64748b"
                  />
                  <Pressable style={styles.addCategoryButton} onPress={handleAddCategory}>
                    <Ionicons name="add" size={24} color="#f1f5f9" />
                  </Pressable>
                </View>

                <Pressable style={[styles.button, loading && styles.disabledButton]} onPress={handleAddItem} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Add Menu Item</Text>}
                </Pressable>
          </View>
          
          {/* Category Modal */}
          <Modal
            visible={isCategoryModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setCategoryModalVisible(false)}
          >
            <Pressable onPress={() => setCategoryModalVisible(false)} style={styles.modalBackdrop}>
                <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Category</Text>
                <FlatList
                    data={categories}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                    <Pressable
                        style={styles.categoryItem}
                        onPress={() => {
                        setSelectedCategory(item.id);
                        setCategoryModalVisible(false);
                        }}
                    >
                        <Text style={styles.categoryItemText}>{item.name}</Text>
                    </Pressable>
                    )}
                />
                </View>
            </Pressable>
          </Modal>
      </ScrollView>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Management</Text>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="close-outline" size={28} color="#94a3b8" />
            </Pressable>
        </View>

        <View style={styles.tabsContainer}>
            <View style={styles.webContainer}>
                <View style={{flexDirection: 'row'}}>
                    <Pressable style={[styles.tab, activeTab === 'inventory' && styles.activeTab]} onPress={() => setActiveTab('inventory')}>
                        <Text style={[styles.tabText, activeTab === 'inventory' && styles.activeTabText]}>Inventory Log</Text>
                    </Pressable>
                    <Pressable style={[styles.tab, activeTab === 'menu' && styles.activeTab]} onPress={() => setActiveTab('menu')}>
                        <Text style={[styles.tabText, activeTab === 'menu' && styles.activeTabText]}>Menu Items</Text>
                    </Pressable>
                </View>
            </View>
        </View>

        {activeTab === 'inventory' ? renderInventoryTab() : renderMenuTab()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 15, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc' },
  backButton: { padding: 5 },
  
  tabsContainer: { padding: 10, backgroundColor: '#1e293b', alignItems: 'center' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#38bdf8' },
  tabText: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
  activeTabText: { color: '#38bdf8' },
  tabContent: { flex: 1, padding: 15, alignItems: 'center' },

  // Web Layout Wrapper
  webContainer: {
      width: '100%',
      maxWidth: 600,
      alignSelf: 'center',
  },

  // Input with Suffix/Embedded Controls
  inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#1e293b',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#334155',
      marginBottom: 15,
      paddingRight: 10
  },
  inputField: {
      flex: 1,
      color: '#f1f5f9',
      padding: 15,
      fontSize: 16
  },
  suffixText: {
      color: '#64748b',
      fontWeight: 'bold',
      paddingRight: 10
  },

  // Inventory Styles
  addInvContainer: { backgroundColor: '#1e293b', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  sectionHeader: { color: '#f1f5f9', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  formRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  input: { backgroundColor: '#1e293b', color: '#f1f5f9', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155', fontSize: 16 },
  
  // Embedded Unit Selector
  embeddedUnitSelector: { flexDirection: 'row', backgroundColor: '#334155', borderRadius: 8, padding: 3 },
  embeddedUnitBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  embeddedUnitBtnActive: { backgroundColor: '#38bdf8' },
  embeddedUnitText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  embeddedUnitTextActive: { color: '#0f172a' },

  addButton: { backgroundColor: '#38bdf8', padding: 12, borderRadius: 8, alignItems: 'center' },
  addButtonText: { color: '#0f172a', fontWeight: 'bold' },
  
  dayCard: { backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  dayHeader: { padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#334155' },
  dayTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: 'bold' },
  dayTotal: { color: '#38bdf8', fontWeight: 'bold' },
  dayDetails: { padding: 15 },
  invItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  invItemName: { color: '#f1f5f9', fontSize: 15 },
  invItemWeight: { color: '#94a3b8', fontSize: 13 },
  invItemPrice: { color: '#f1f5f9', fontWeight: 'bold' },

  // Menu Styles
  scrollContainer: { flexGrow: 1, padding: 20 },
  formContainer: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  imagePicker: { width: '100%', aspectRatio: 1.5, backgroundColor: '#1e293b', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  imagePickerText: { color: '#94a3b8', marginTop: 10, fontWeight: 'bold' },
  orText: { color: '#94a3b8', textAlign: 'center', marginBottom: 10, fontSize: 14 },
  button: { width: '100%', backgroundColor: '#38bdf8', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  disabledButton: { backgroundColor: '#4b5563' },
  newCategoryContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  addCategoryButton: { backgroundColor: '#38bdf8', padding: 15, borderRadius: 12, marginLeft: 10 },
  
  // Modal
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { backgroundColor: '#1e293b', borderRadius: 15, padding: 20, width: '80%', maxHeight: '60%', borderWidth: 1, borderColor: '#334155', maxWidth: 500 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#f8fafc', marginBottom: 20, textAlign: 'center' },
  categoryItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#334155' },
  categoryItemText: { fontSize: 16, color: '#f1f5f9' },
});
