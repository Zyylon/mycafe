import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { browserSessionPersistence, setPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { get, ref } from 'firebase/database';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, Image } from 'react-native';
import { auth, database } from '../lib/firebaseConfig';

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
      await setPersistence(auth, browserSessionPersistence);
      let email = loginInput;

      if (!loginInput.includes('@')) {
        const hashedUsername = await hashUsername(loginInput);
        const mapRef = ref(database, `username_map/${hashedUsername}`);
        const mapSnapshot = await get(mapRef);

        if (!mapSnapshot.exists()) {
          throw new Error('Username not found.');
        }
        email = mapSnapshot.val();
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        router.replace('/(tabs)/dashboard');
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
      <View style={styles.mainContent}>
        <View style={styles.card}>
          <Text style={styles.emoji}>☕</Text>
          <Text style={styles.title}>Slice n' Spice</Text>
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
      </View>

      <View style={styles.footerBranding}>
          <Image source={require('../assets/images/ic.png')} style={styles.footerLogo} />
          <Text style={styles.footerCredit}>Designed By Infinity Crafters</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0f172a',
  },
  mainContent: {
    flex: 1, // This makes the content area take up available space, pushing the footer down
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: { 
    width: '100%', 
    maxWidth: 400, 
    backgroundColor: '#1e293b', 
    padding: 30, 
    borderRadius: 24, 
    borderWidth: 1, 
    borderColor: '#334155', 
    alignItems: 'center' 
  },
  emoji: { fontSize: 48, marginBottom: 10 },
  title: { color: '#f8fafc', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 16, marginBottom: 30 },
  input: { width: '100%', backgroundColor: '#0f172a', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  button: { width: '100%', backgroundColor: '#38bdf8', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, height: 55, justifyContent: 'center' },
  buttonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  footerBranding: {
    padding: 40,
    alignItems: 'center',
  },
  footerLogo: {
      width: 50,
      height: 50,
      resizeMode: 'contain',
      marginBottom: 8,
  },
  footerCredit: {
      fontSize: 12,
      color: '#64748b',
  },
});
