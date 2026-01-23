import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { auth, database } from '../lib/firebaseConfig';

export default function AdminLoginScreen() {
  const router = useRouter();
  const { redirectTo } = useLocalSearchParams();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleLogin = async () => {
    if (email === '' || password === '') {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const adminsRef = ref(database, 'admins');
      const allAdminsSnapshot = await get(adminsRef);

      if (!allAdminsSnapshot.exists()) {
        // This is the VERY FIRST admin login. Automatically make this user an admin.
        const userAdminRef = ref(database, `admins/${user.uid}`);
        await set(userAdminRef, { email: user.email, isFirstAdmin: true });
        Alert.alert('Welcome, First Admin!', 'Your account has been set up with administrative privileges.');
        router.replace((redirectTo as string) || '/admin-dashboard');
      } else {
        // Admins table exists, check if the current user is in it.
        const userAdminRef = ref(database, `admins/${user.uid}`);
        const userAdminSnapshot = await get(userAdminRef);
        if (userAdminSnapshot.exists()) {
          // User is a verified admin.
          router.replace((redirectTo as string) || '/admin-dashboard');
        } else {
          // User is authenticated but NOT an admin.
          await auth.signOut();
          Alert.alert('Access Denied', 'You do not have administrative privileges.');
        }
      }
    } catch (error: any) {
      console.error("Admin Login Error:", error.code);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
          errorMessage = 'Invalid credentials. Please check your email and password.';
      } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'The email address is not valid.';
      }
      Alert.alert('Admin Login Failed', errorMessage);
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
        <Text style={styles.title}>Admin Login</Text>

        <TextInput
          style={styles.input}
          placeholder="Admin Email"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#64748b"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.buttonText}>Log In</Text>
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
  card: { width: '85%', maxWidth: 400, backgroundColor: '#1e293b', padding: 30, borderRadius: 24, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  title: { color: '#f8fafc', fontSize: 28, fontWeight: 'bold', marginBottom: 30 },
  input: { width: '100%', backgroundColor: '#0f172a', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  button: { width: '100%', backgroundColor: '#38bdf8', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, height: 55, justifyContent: 'center' },
  buttonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  cancelButton: { marginTop: 15 },
  cancelButtonText: { color: '#94a3b8' }
});
