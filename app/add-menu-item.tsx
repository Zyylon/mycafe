import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, Pressable, View, Image, ScrollView, Modal, FlatList
} from 'react-native';
import { database, storage } from '../lib/firebaseConfig';
import { ref as dbRef, push, set, onValue } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

export default function AddMenuItemScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);

  useEffect(() => {
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
  }, []);

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
        setImageUrl(''); // Clear URL when local image is picked
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
    if (!newCategory.trim()) {
      Alert.alert('Invalid Category', 'Please enter a valid category name.');
      return;
    }
    const newCategoryName = newCategory.trim();
    const existingCategory = categories.find(c => c.name.toLowerCase() === newCategoryName.toLowerCase());
    if (existingCategory) {
        Alert.alert('Category Exists', `The category "${newCategoryName}" already exists.`);
        setNewCategory('');
        return;
    }

    try {
        const categoryRef = push(dbRef(database, 'categories'));
        await set(categoryRef, { name: newCategoryName });
        setSelectedCategory(categoryRef.key);
        setNewCategory('');
        Alert.alert('Success', `Category "${newCategoryName}" added successfully.`);
    } catch (error) {
        console.error("Failed to add category:", error);
        Alert.alert('Error', 'There was an error adding the category.');
    }
  };

  const handleAddItem = async () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Missing Info', 'Please enter a name and price.');
      return;
    }
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
        Alert.alert('Invalid Price', 'Please enter a valid, positive price.');
        return;
    }
    if (!localImageUri && !imageUrl.trim()) {
        Alert.alert('Missing Image', 'Please select an image or provide an image URL.');
        return;
    }
    if (!selectedCategory) {
        Alert.alert('Missing Category', 'Please select a category for the item.');
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

      Alert.alert('Success', 'Menu item added successfully!');
      router.back();
    } catch (error) {
      console.error("Failed to add item:", error);
      Alert.alert('Save Error', 'There was an error adding the item.');
    } finally {
      setLoading(false);
    }
  };

  const renderCategoryModal = () => (
    <Modal
      visible={isCategoryModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setCategoryModalVisible(false)}
    >
      <Pressable onPress={() => setCategoryModalVisible(false)} style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select a Category</Text>
          <FlatList
            data={categories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.categoryItem, { opacity: pressed ? 0.7 : 1 }]}
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
  );

  const selectedCategoryName = categories.find(c => c.id === selectedCategory)?.name || 'Select Category';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        {renderCategoryModal()}
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Add New Item</Text>
            <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name="close-outline" size={28} color="#94a3b8" />
            </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.formContainer}>

                <Pressable style={({ pressed }) => [styles.imagePicker, { opacity: pressed ? 0.7 : 1 }]} onPress={pickImage}>
                    {localImageUri ? (
                        <Image source={{ uri: localImageUri }} style={styles.imagePreview} />
                    ) : imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
                    ) : (
                        <View style={styles.imagePlaceholder}>
                            <Ionicons name="image-outline" size={50} color="#64748b" />
                            <Text style={styles.imagePickerText}>Tap to Select Image</Text>
                        </View>
                    )}
                </Pressable>
                
                <Text style={styles.orText}>or paste image URL</Text>

                <TextInput style={styles.input} placeholder="Item Name" value={name} onChangeText={setName} placeholderTextColor="#64748b" />
                <TextInput style={styles.input} placeholder="Price" value={price} onChangeText={setPrice} keyboardType="numeric" placeholderTextColor="#64748b" />
                <TextInput style={styles.input} placeholder="Image URL" value={imageUrl} onChangeText={(text) => { setImageUrl(text); setLocalImageUri(null); }} placeholderTextColor="#64748b" />
                
                <Pressable style={({ pressed }) => [styles.input, { opacity: pressed ? 0.7 : 1 }]} onPress={() => setCategoryModalVisible(true)}>
                  <Text style={{color: selectedCategory ? '#f1f5f9': '#64748b'}}>{selectedCategoryName}</Text>
                </Pressable>
                
                <View style={styles.newCategoryContainer}>
                  <TextInput
                    style={[styles.input, {flex: 1, marginBottom: 0}]}
                    placeholder="Or Add New Category"
                    value={newCategory}
                    onChangeText={setNewCategory}
                    placeholderTextColor="#64748b"
                  />
                  <Pressable style={({ pressed }) => [styles.addCategoryButton, { opacity: pressed ? 0.7 : 1 }]} onPress={handleAddCategory}>
                    <Ionicons name="add" size={24} color="#f1f5f9" />
                  </Pressable>
                </View>

                <Pressable style={({ pressed }) => [styles.button, { opacity: pressed || loading ? 0.7 : 1 }, loading && styles.disabledButton]} onPress={handleAddItem} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Add Menu Item</Text>}
                </Pressable>

            </View>
        </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 15, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc' },
  backButton: { padding: 5 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  formContainer: { width: '100%', maxWidth: 400, alignSelf: 'center', alignItems: 'center' },
  imagePicker: { width: '100%', aspectRatio: 1.5, backgroundColor: '#1e293b', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  imagePickerText: { color: '#94a3b8', marginTop: 10, fontWeight: 'bold' },
  orText: { color: '#94a3b8', marginVertical: 10, fontSize: 14 },
  input: { width: '100%', backgroundColor: '#1e293b', color: '#f1f5f9', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155', fontSize: 16 },
  button: { width: '100%', backgroundColor: '#38bdf8', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  disabledButton: { backgroundColor: '#4b5563' },
  newCategoryContainer: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    marginBottom: 15
  },
  addCategoryButton: {
    backgroundColor: '#38bdf8',
    padding: 15,
    borderRadius: 12,
    marginLeft: 10,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 15,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 20,
    textAlign: 'center',
  },
  categoryItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  categoryItemText: {
    fontSize: 16,
    color: '#f1f5f9',
  },
});
