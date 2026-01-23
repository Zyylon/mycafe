import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, Pressable, View } from 'react-native';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import * as Crypto from 'expo-crypto';
import { auth, database } from '../../lib/firebaseConfig';

const hashUsername = async (username: string) => {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    username.toLowerCase()
  );
  return digest;
};

export default function LoginScreen() {
  const router = useRouter();
  const [loginInput, setLoginInput] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleLogin = async () => {
    if (loginInput === '' || password === '') {
      Alert.alert('Error', 'Please enter both email/username and password.');
      return;
    }

    setLoading(true);
    try {
      let email = loginInput;

      // If the input doesn't look like an email, treat it as a username.
      if (!loginInput.includes('@')) {
        const hashedUsername = await hashUsername(loginInput);
        const mapRef = ref(database, `username_map/${hashedUsername}`);
        const mapSnapshot = await get(mapRef);

        if (!mapSnapshot.exists()) {
          throw new Error('Username not found.');
        }
        email = mapSnapshot.val(); // Get the email associated with the username
      }

      // Authenticate with Firebase Auth using the resolved email
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Get user role from the Realtime Database to determine destination
      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userData.role === 'admin') {
          router.replace('/admin-dashboard');
        } else {
          router.replace('/(tabs)/dashboard');
        }
      } else {
        await signOut(auth);
        throw new Error('User data not found in database.');
      }
    } catch (error: any) {
      console.error(error);
      let errorMessage = 'An error occurred during login.';
      if (
        error.message === 'Username not found.' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/invalid-email'
      ) {
        errorMessage = 'Invalid credentials. Please try again.';
      }
      Alert.alert('Login Failed', errorMessage);
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
        <Text style={styles.emoji}>☕</Text>
        <Text style={styles.title}>Cafe Billing</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <TextInput
          style={styles.input}
          placeholder="Email or Username"
          placeholderTextColor="#64748b"
          value={loginInput}
          onChangeText={setLoginInput}
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

        <Pressable
          style={({ pressed }) => [styles.button, { opacity: pressed || loading ? 0.7 : 1 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.buttonText}>Log In</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  card: { width: '85%', maxWidth: 400, backgroundColor: '#1e293b', padding: 30, borderRadius: 24, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  emoji: { fontSize: 48, marginBottom: 10 },
  title: { color: '#f8fafc', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 16, marginBottom: 30 },
  input: { width: '100%', backgroundColor: '#0f172a', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  button: { width: '100%', backgroundColor: '#38bdf8', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, height: 55, justifyContent: 'center' },
  buttonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
});
