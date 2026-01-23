import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, Image
} from 'react-native';
import { database, storage } from '../lib/firebaseConfig';
import { ref as dbRef, push, set } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';

export default function AddMenuItemScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need permission to access your photos to add a menu image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Reverted: Use deprecated but compatible API
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

  const handleAddItem = async () => {
    if (!name || !price) {
      Alert.alert('Validation Error', 'Please enter a name and a price.');
      return;
    }
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
        Alert.alert('Validation Error', 'Please enter a valid, positive price.');
        return;
    }

    setLoading(true);
    try {
      let finalImageUrl = imageUrl;

      if (localImageUri) {
        try {
          finalImageUrl = await uploadImage(localImageUri);
        } catch {
          Alert.alert('Image Upload Failed', 'Could not upload the selected image. Please try again.');
          setLoading(false);
          return;
        }
      }
      
      const menuItemsRef = dbRef(database, 'menu_items');
      const newItemRef = push(menuItemsRef);
      await set(newItemRef, {
        name,
        price: priceValue,
        imageUrl: finalImageUrl || ''
      });

      Alert.alert('Success', 'Menu item added successfully!');
      router.back();
    } catch (error) {
      console.error("Failed to add item:", error);
      Alert.alert('Save Error', 'There was an error adding the item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Add New Menu Item</Text>

        <Image source={{ uri: localImageUri || imageUrl || 'https://via.placeholder.com/150' }} style={styles.imagePreview} />

        <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
            <Text style={styles.imagePickerButtonText}>Select Image</Text>
        </TouchableOpacity>
        
        <Text style={styles.orText}>or paste an image URL below</Text>

        <TextInput style={styles.input} placeholder="Item Name" value={name} onChangeText={setName} placeholderTextColor="#64748b" />
        <TextInput style={styles.input} placeholder="Price" value={price} onChangeText={setPrice} keyboardType="numeric" placeholderTextColor="#64748b" />
        <TextInput style={styles.input} placeholder="Image URL (Optional)" value={imageUrl} onChangeText={(text) => { setImageUrl(text); setLocalImageUri(null); }} placeholderTextColor="#64748b" />

        <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleAddItem} disabled={loading}>
          {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.buttonText}>Add Item</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  card: { width: '90%', maxWidth: 450, backgroundColor: '#1e293b', borderRadius: 20, padding: 25, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc', marginBottom: 20 },
  input: { width: '100%', backgroundColor: '#0f172a', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  button: { width: '100%', backgroundColor: '#38bdf8', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, height: 55, justifyContent: 'center' },
  buttonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  imagePickerButton: { width: '100%', backgroundColor: '#334155', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  imagePickerButtonText: { color: '#f8fafc', fontWeight: 'bold', fontSize: 16 },
  orText: { color: '#94a3b8', marginVertical: 10 },
  imagePreview: { width: 150, height: 150, borderRadius: 12, marginBottom: 20, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155' },
  cancelButton: { marginTop: 15 },
  cancelButtonText: { color: '#94a3b8' }
});
