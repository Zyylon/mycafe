import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, database } from '../lib/firebaseConfig';

export default function CreateUserScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateUser = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter an email and password.');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const { uid } = userCredential.user;

      // Step 2: Save additional user info (like role) in Realtime Database
      // We use the UID from Auth as the key to link the data.
      await set(ref(database, `staff_users/${uid}`), {
        email: email,
        role: 'staff', // Assign a role for future permission handling
        createdAt: new Date().toISOString(),
      });

      Alert.alert('Success', 'Staff user created successfully!');
      router.back(); // Go back to the admin dashboard

    } catch (error: any) {
      console.error(error);
      let errorMessage = 'An error occurred while creating the user.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email address is already in use.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'The password is too weak. Please use at least 6 characters.';
      }
      Alert.alert('Creation Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Create Staff User</Text>
        <Text style={styles.subtitle}>Creates a new user with Staff permissions.</Text>

        <TextInput
          style={styles.input}
          placeholder="Staff Email Address"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password (min. 6 characters)"
          placeholderTextColor="#64748b"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleCreateUser}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.buttonText}>Create User</Text>
          )}
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
  card: { width: '90%', backgroundColor: '#1e293b', borderRadius: 20, padding: 25, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 20, textAlign: 'center' },
  input: { width: '100%', backgroundColor: '#0f172a', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  button: { width: '100%', backgroundColor: '#38bdf8', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  cancelButton: { marginTop: 15 },
  cancelButtonText: { color: '#94a3b8' }
});
