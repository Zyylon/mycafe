import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { database } from '../../lib/firebaseConfig';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleLogin = async () => {
    if (username === '' || password === '') {
      Alert.alert('Error', 'Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      const staffUsersRef = ref(database, 'staff_users');
      const usernameQuery = query(staffUsersRef, orderByChild('username'), equalTo(username));
      const snapshot = await get(usernameQuery);

      if (snapshot.exists()) {
        let userFound = false;
        snapshot.forEach((childSnapshot) => {
          const userData = childSnapshot.val();
          if (userData.password === password) {
            userFound = true;
          }
        });

        if (userFound) {
          router.replace('/(tabs)/dashboard');
        } else {
          Alert.alert('Login Failed', 'Incorrect password.');
        }
      } else {
        Alert.alert('Login Failed', 'Username not found.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'An error occurred during login.');
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
        <TouchableOpacity
          style={styles.adminButton}
          onPress={() => router.push('/admin-login')}
        >
          <Text style={styles.adminButtonText}>Admin Login</Text>
        </TouchableOpacity>

        <Text style={styles.emoji}>☕</Text>
        <Text style={styles.title}>Cafe Billing</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <TextInput
          style={styles.input}
          placeholder="Staff Username"
          placeholderTextColor="#64748b"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  card: { width: '85%', maxWidth: 400, backgroundColor: '#1e293b', padding: 30, borderRadius: 24, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  adminButton: { position: 'absolute', top: 20, right: 20, backgroundColor: '#4ade80', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  adminButtonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 14 },
  emoji: { fontSize: 48, marginBottom: 10 },
  title: { color: '#f8fafc', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 16, marginBottom: 30 },
  input: { width: '100%', backgroundColor: '#0f172a', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  button: { width: '100%', backgroundColor: '#38bdf8', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, height: 55, justifyContent: 'center' },
  buttonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
});
