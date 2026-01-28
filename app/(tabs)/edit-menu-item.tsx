import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, Pressable, View, Image, useWindowDimensions, ScrollView
} from 'react-native';
import { database, storage } from '../../services/firebase';
import { ref as dbRef, get, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

// Web-specific scrollbar styles
const WebScrollbarStyles = () => {
    if (Platform.OS !== 'web') return null;
    return (
        <style type="text/css">
            {`
            ::-webkit-scrollbar {
                width: 10px;
                height: 10px;
            }
            ::-webkit-scrollbar-track {
                background: #0f172a; 
            }
            ::-webkit-scrollbar-thumb {
                background: #334155; 
                border-radius: 5px;
                border: 2px solid #0f172a;
            }
            ::-webkit-scrollbar-thumb:hover {
                background: #475569; 
            }
            /* Firefox */
            * {
                scrollbar-width: thin;
                scrollbar-color: #334155 #0f172a;
            }
            `}
        </style>
    );
};

export default function EditMenuItemScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [originalImageUrl, setOriginalImageUrl] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { width } = useWindowDimensions();

  useEffect(() => {
    if (!id) return;
    const itemRef = dbRef(database, `menu_items/${id}`);
    get(itemRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setName(data.name);
        setPrice(data.price.toString());
        setImageUrl(data.imageUrl || '');
        setOriginalImageUrl(data.imageUrl || '');
      } else {
        Alert.alert('Error', 'Menu item not found.');
        router.back();
      }
    }).finally(() => setLoading(false));
  }, [id, router]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need permission to access your photos to change the menu image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setLocalImageUri(result.assets[0].uri);
      setImageUrl('');
    }
  };

  const uploadImage = (uri: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        const blob = xhr.response;
        const imageName = `menu_items/${Date.now()}`;
        const imageRef = storageRef(storage, imageName);
        
        uploadBytes(imageRef, blob)
          .then(snapshot => {
            getDownloadURL(snapshot.ref)
              .then(url => resolve(url))
              .catch(error => {
                console.error("Firebase: Failed to get download URL:", error);
                reject(new Error("Could not get image URL after upload."));
              });
          })
          .catch(error => {
            console.error("Firebase: Upload failed:", error);
            reject(new Error("Image upload to storage failed."));
          });
      };
      xhr.onerror = function (e) {
        console.error("Upload Error: Network request failed", e);
        reject(new TypeError("Network request failed"));
      };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });
  };

  const handleUpdateItem = async () => {
    if (!name || !price) {
      Alert.alert('Validation Error', 'Name and price cannot be empty.');
      return;
    }
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
        Alert.alert('Validation Error', 'Please enter a valid, positive price.');
        return;
    }

    setSaving(true);
    try {
      let finalImageUrl = imageUrl;

      if (localImageUri) {
        try {
          finalImageUrl = await uploadImage(localImageUri);
        } catch (uploadError) {
          console.error("Image upload failed:", uploadError);
          Alert.alert('Upload Error', 'Failed to upload the new image. The item was not saved.');
          setSaving(false);
          return;
        }
      }

      const itemData = {
        name,
        price: priceValue,
        imageUrl: finalImageUrl || '',
      };

      const itemRef = dbRef(database, `menu_items/${id}`);
      await update(itemRef, itemData);
      
      if (localImageUri && originalImageUrl && originalImageUrl.includes('firebasestorage')) {
        try {
          const oldImageRef = storageRef(storage, originalImageUrl);
          await deleteObject(oldImageRef);
        } catch (deleteError) {
          console.warn("Could not delete old image, but the item was saved:", deleteError);
        }
      }

      Alert.alert('Success', 'Menu item updated successfully!');
      router.back();

    } catch (error) {
      console.error("Update failed:", error);
      Alert.alert('Save Error', 'Failed to save changes. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Loading Item...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebScrollbarStyles />
      <View style={styles.header}>
          <Text style={styles.title}>Edit Menu Item</Text>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name="close-outline" size={28} color="#94a3b8" />
          </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.formContainer}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Item Details</Text>
                  <Text style={styles.cardSubtitle}>Update information for this menu item</Text>
              </View>

              <View style={styles.imageSection}>
                  <Image source={{ uri: localImageUri || imageUrl || 'https://via.placeholder.com/150' }} style={styles.imagePreview} />
                  <Pressable style={({ pressed }) => [styles.imagePickerButton, { opacity: pressed ? 0.7 : 1 }]} onPress={pickImage}>
                      <Ionicons name="camera-outline" size={20} color="#f8fafc" style={{ marginRight: 8 }} />
                      <Text style={styles.imagePickerButtonText}>Change Image</Text>
                  </Pressable>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Item Name</Text>
                <View style={styles.inputWrapper}>
                    <Ionicons name="fast-food-outline" size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input} 
                      placeholder="E.g. Spicy Burger" 
                      value={name} 
                      onChangeText={setName} 
                      placeholderTextColor="#64748b" 
                    />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Price (PKR)</Text>
                <View style={styles.inputWrapper}>
                    <Ionicons name="cash-outline" size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input} 
                      placeholder="0" 
                      value={price} 
                      onChangeText={setPrice} 
                      keyboardType="numeric" 
                      placeholderTextColor="#64748b" 
                    />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Image URL (Optional)</Text>
                <View style={styles.inputWrapper}>
                    <Ionicons name="link-outline" size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input} 
                      placeholder="https://..." 
                      value={imageUrl} 
                      onChangeText={(text) => { 
                        setImageUrl(text); 
                        setLocalImageUri(null);
                      }} 
                      placeholderTextColor="#64748b" 
                    />
                </View>
                <Text style={styles.helperText}>Or select an image from your device above.</Text>
              </View>
      
              <View style={styles.actionButtons}>
                <Pressable style={({ pressed }) => [styles.cancelButton, { opacity: pressed ? 0.7 : 1 }]} onPress={() => router.back()}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                
                <Pressable style={({ pressed }) => [styles.saveButton, { opacity: pressed || saving ? 0.7 : 1 }]} onPress={handleUpdateItem} disabled={saving}>
                  {saving ? <ActivityIndicator color="#0f172a" /> : (
                      <>
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                        <Ionicons name="checkmark-circle-outline" size={20} color="#0f172a" style={{ marginLeft: 8 }} />
                      </>
                  )}
                </Pressable>
              </View>
            </View>
        </KeyboardAvoidingView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loadingContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, color: '#94a3b8', fontSize: 16 },
  
  // Header
  header: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      paddingHorizontal: 24, 
      paddingVertical: 20,
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderBottomWidth: 1, 
      borderBottomColor: 'rgba(255,255,255,0.05)',
      zIndex: 10,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#1e293b' },

  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20, alignItems: 'center' },
  formContainer: { width: '100%', alignItems: 'center' },
  
  // Card - Matched perfectly with create-user.tsx
  card: { 
    width: '100%', 
    maxWidth: 600, 
    backgroundColor: '#1e293b', 
    borderRadius: 24, 
    padding: 32, 
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHeader: { marginBottom: 32, alignItems: 'center' },
  cardTitle: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  cardSubtitle: { fontSize: 14, color: '#94a3b8' },

  imageSection: { alignItems: 'center', marginBottom: 32 },
  imagePreview: { 
    width: 180, 
    height: 180, 
    borderRadius: 24, 
    marginBottom: 20, 
    backgroundColor: '#0f172a', 
    borderWidth: 1, 
    borderColor: '#334155' 
  },
  imagePickerButton: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    backgroundColor: '#334155', 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569'
  },
  imagePickerButtonText: { color: '#f8fafc', fontWeight: '600', fontSize: 14 },

  inputGroup: { marginBottom: 20, width: '100%' },
  label: { fontSize: 14, fontWeight: '600', color: '#94a3b8', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  // Input Wrapper - Matched with create-user.tsx
  inputWrapper: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: '#0f172a', 
      borderRadius: 16, 
      borderWidth: 1, 
      borderColor: '#334155', 
      paddingHorizontal: 16 
  },
  inputIcon: { marginRight: 12 },
  input: { 
    flex: 1, 
    paddingVertical: 16, 
    color: '#f8fafc', 
    fontSize: 16,
  },
  helperText: { color: '#64748b', fontSize: 12, marginTop: 6, marginLeft: 4 },

  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 12 },
  cancelButton: { 
    flex: 1, 
    padding: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155'
  },
  cancelButtonText: { color: '#94a3b8', fontWeight: '700', fontSize: 16 },
  saveButton: { 
    flex: 2, 
    backgroundColor: '#38bdf8', 
    padding: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: "#38bdf8", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6
  },
  saveButtonText: { color: '#0f172a', fontWeight: '800', fontSize: 16 }
});
