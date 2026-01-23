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
  Pressable,
  View,
  ScrollView,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import * as Crypto from 'expo-crypto';
import { auth, database } from '../lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';

const hashUsername = async (username: string) => {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    username.toLowerCase()
  );
  return digest;
};

export default function CreateUserScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [loading, setLoading] = useState(false);

  const handleCreateUser = async () => {
    if (!username || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const { uid } = userCredential.user;
      const hashedUsername = await hashUsername(username);
      await set(ref(database, `username_map/${hashedUsername}`), email.toLowerCase());
      await set(ref(database, `users/${uid}`), {
        username,
        email: email.toLowerCase(),
        role,
        createdAt: new Date().toISOString(),
      });

      Alert.alert('Success', `User created successfully as ${role}!`)
      router.back();

    } catch (error: any) {
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
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Create New User</Text>
            <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name="close-outline" size={28} color="#94a3b8" />
            </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.formContainer}>
                <Text style={styles.subtitle}>Assign a role and create a new user account.</Text>

                <TextInput
                    style={styles.input}
                    placeholder="Username"
                    placeholderTextColor="#64748b"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                />

                <TextInput
                    style={styles.input}
                    placeholder="Email Address"
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

                <View style={styles.roleSelector}>
                    <Pressable style={({ pressed }) => [styles.roleButton, role === 'staff' && styles.activeRole, { opacity: pressed ? 0.7 : 1 }]} onPress={() => setRole('staff')}>
                        <Text style={[styles.roleButtonText, role === 'staff' && styles.activeRoleText]}>Staff</Text>
                    </Pressable>
                    <Pressable style={({ pressed }) => [styles.roleButton, role === 'admin' && styles.activeRole, { opacity: pressed ? 0.7 : 1 }]} onPress={() => setRole('admin')}>
                        <Text style={[styles.roleButtonText, role === 'admin' && styles.activeRoleText]}>Admin</Text>
                    </Pressable>
                    <Pressable style={({ pressed }) => [styles.roleButton, role === 'superadmin' && styles.activeRole, { opacity: pressed ? 0.7 : 1 }]} onPress={() => setRole('superadmin')}>
                        <Text style={[styles.roleButtonText, role === 'superadmin' && styles.activeRoleText]}>Superadmin</Text>
                    </Pressable>
                </View>

                <Pressable
                    style={({ pressed }) => [styles.button, { opacity: pressed || loading ? 0.7 : 1 }, loading && styles.disabledButton]}
                    onPress={handleCreateUser}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create User Account</Text>}
                </Pressable>
            </View>
        </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      paddingHorizontal: 20, 
      paddingVertical: 15,
      paddingTop: Platform.OS === 'ios' ? 50 : 20, 
      backgroundColor: '#1e293b',
      borderBottomWidth: 1,
      borderBottomColor: '#334155'
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc' },
  backButton: { padding: 5 },
  scrollContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20
  },
  formContainer: {
      width: '100%',
      maxWidth: 400,
      alignItems: 'center'
  },
  subtitle: { fontSize: 16, color: '#94a3b8', marginBottom: 30, textAlign: 'center' },
  input: { 
      width: '100%', 
      backgroundColor: '#1e293b', 
      color: '#f1f5f9', 
      padding: 15, 
      borderRadius: 12, 
      marginBottom: 15, 
      borderWidth: 1, 
      borderColor: '#334155',
      fontSize: 16
  },
  roleSelector: { 
      flexDirection: 'row', 
      width: '100%', 
      marginBottom: 30, 
      justifyContent: 'space-between',
      backgroundColor: '#334155',
      borderRadius: 12,
      padding: 5,
  },
  roleButton: { 
      flex: 1,
      paddingVertical: 12, 
      borderRadius: 8,
      alignItems: 'center'
  },
  activeRole: { backgroundColor: '#38bdf8' },
  roleButtonText: { color: '#f1f5f9', fontWeight: 'bold', fontSize: 14 },
  activeRoleText: { color: '#0f172a' },
  button: { 
      width: '100%', 
      backgroundColor: '#38bdf8', 
      padding: 16, 
      borderRadius: 12, 
      alignItems: 'center', 
      marginTop: 10 
  },
  buttonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  disabledButton: { backgroundColor: '#4b5563' },
});
