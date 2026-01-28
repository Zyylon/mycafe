import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import React, { useState, useRef, useEffect } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
    Animated,
    LayoutAnimation,
    UIManager
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { database, firebaseConfig } from '../../services/firebase';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const hashUsername = async (username: string) => {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    username.toLowerCase()
  );
  return digest;
};

export default function CreateUserScreen() {
  const router = useRouter();
  const { userData } = useAuth();
  
  // Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'username' | 'email' | 'password' | null>(null);

  // Animations
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  const currentUserRole = userData?.role;
  const isSuperAdmin = currentUserRole === 'superadmin';
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 900;

  // Clear errors when typing
  useEffect(() => {
    if (errorMessage) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setErrorMessage(null);
    }
  }, [username, email, password]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  const handleCreateUser = async () => {
    if (!username || !email || !password) {
      triggerShake();
      setErrorMessage('Please fill in all fields.');
      return;
    }

    if (role === 'superadmin' && !isSuperAdmin) {
       triggerShake();
       setErrorMessage('Only Superadmins can create other Superadmins.');
       return;
    }

    setLoading(true);
    let secondaryApp = null;
    try {
      const secondaryAppName = 'secondaryAppForUserCreation';
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const { uid } = userCredential.user;

      await signOut(secondaryAuth);

      const hashedUsername = await hashUsername(username);
      await set(ref(database, `username_map/${hashedUsername}`), email.toLowerCase());
      await set(ref(database, `users/${uid}`), {
        username,
        email: email.toLowerCase(),
        role,
        createdAt: new Date().toISOString(),
      });

      Alert.alert('Success', `User created successfully as ${role}!`);
      router.back();

    } catch (error: any) {
      console.error(error);
      triggerShake();
      let msg = 'An error occurred while creating the user.';
      
      if (error.code === 'auth/email-already-in-use') {
        msg = 'This email address is already in use.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (error.code === 'auth/weak-password') {
        msg = 'Password is too weak (min 6 chars).';
      } else {
        msg = error.message || msg;
      }
      setErrorMessage(msg);
    } finally {
      if (secondaryApp) {
        await deleteApp(secondaryApp);
      }
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
       <KeyboardAvoidingView
         behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
         style={{ flex: 1 }}
       >
           <View style={styles.header}>
               <View style={styles.headerLeft}>
                   {!isLargeScreen && (
                       <Pressable onPress={() => router.back()} style={styles.backButton}>
                           <Ionicons name="arrow-back" size={24} color="#f8fafc" />
                       </Pressable>
                   )}
                   <View style={styles.titleContainer}>
                        <Ionicons name="person-add" size={28} color="#38bdf8" />
                        <Text style={styles.headerTitle}>Create User</Text>
                   </View>
               </View>
           </View>
           
           <ScrollView contentContainerStyle={styles.scrollContainer}>
               <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnimation }] }]}>
                   <View style={styles.cardHeader}>
                       <Text style={styles.cardTitle}>Account Details</Text>
                       <Text style={styles.cardSubtitle}>Configure new user credentials and permissions</Text>
                   </View>

                    {/* ERROR BANNER */}
                    {errorMessage && (
                        <View style={styles.errorContainer}>
                            <Ionicons name="alert-circle" size={20} color="#f87171" />
                            <Text style={styles.errorText}>{errorMessage}</Text>
                        </View>
                    )}

                   {/* USERNAME */}
                   <View style={styles.inputGroup}>
                       <Text style={styles.label}>Username</Text>
                       <View style={[
                           styles.inputWrapper,
                           errorMessage && styles.inputErrorBorder,
                           focusedField === 'username' && styles.inputWrapperFocused
                       ]}>
                           <Ionicons 
                                name="person-outline" 
                                size={20} 
                                color={focusedField === 'username' ? "#38bdf8" : "#64748b"} 
                                style={styles.inputIcon} 
                            />
                           <TextInput
                               style={styles.input}
                               placeholder="Enter username"
                               placeholderTextColor="#64748b"
                               value={username}
                               onChangeText={setUsername}
                               autoCapitalize="none"
                               onFocus={() => setFocusedField('username')}
                               onBlur={() => setFocusedField(null)}
                           />
                       </View>
                   </View>
   
                   {/* EMAIL */}
                   <View style={styles.inputGroup}>
                       <Text style={styles.label}>Email Address</Text>
                       <View style={[
                           styles.inputWrapper,
                           errorMessage && styles.inputErrorBorder,
                           focusedField === 'email' && styles.inputWrapperFocused
                       ]}>
                           <Ionicons 
                                name="mail-outline" 
                                size={20} 
                                color={focusedField === 'email' ? "#38bdf8" : "#64748b"} 
                                style={styles.inputIcon} 
                            />
                           <TextInput
                               style={styles.input}
                               placeholder="name@example.com"
                               placeholderTextColor="#64748b"
                               value={email}
                               onChangeText={setEmail}
                               autoCapitalize="none"
                               keyboardType="email-address"
                               onFocus={() => setFocusedField('email')}
                               onBlur={() => setFocusedField(null)}
                           />
                       </View>
                   </View>
   
                   {/* PASSWORD */}
                   <View style={styles.inputGroup}>
                       <Text style={styles.label}>Password</Text>
                       <View style={[
                           styles.inputWrapper,
                           errorMessage && styles.inputErrorBorder,
                           focusedField === 'password' && styles.inputWrapperFocused
                       ]}>
                           <Ionicons 
                                name="lock-closed-outline" 
                                size={20} 
                                color={focusedField === 'password' ? "#38bdf8" : "#64748b"} 
                                style={styles.inputIcon} 
                            />
                           <TextInput
                               style={styles.input}
                               placeholder="Min. 6 characters"
                               placeholderTextColor="#64748b"
                               secureTextEntry={!isPasswordVisible}
                               value={password}
                               onChangeText={setPassword}
                               onFocus={() => setFocusedField('password')}
                               onBlur={() => setFocusedField(null)}
                           />
                           <Pressable
                                onPressIn={() => setIsPasswordVisible(true)}
                                onPressOut={() => setIsPasswordVisible(false)}
                                style={styles.eyeIcon}
                            >
                                <Ionicons 
                                    name={isPasswordVisible ? "eye" : "eye-off"} 
                                    size={20} 
                                    color={isPasswordVisible ? "#38bdf8" : "#64748b"} 
                                />
                            </Pressable>
                       </View>
                   </View>
   
                   <View style={styles.roleSection}>
                       <Text style={styles.label}>Assign Role</Text>
                       <View style={styles.roleGrid}>
                           {[
                               { id: 'staff', label: 'Staff', icon: 'id-card-outline', desc: 'Basic access' },
                               { id: 'admin', label: 'Admin', icon: 'shield-outline', desc: 'Manage users' },
                               { id: 'superadmin', label: 'Super Admin', icon: 'shield-checkmark-outline', desc: 'Full access' }
                           ].map((item) => (
                               <Pressable
                                   key={item.id}
                                   style={[
                                       styles.roleCard,
                                       role === item.id && styles.activeRoleCard,
                                       item.id === 'superadmin' && !isSuperAdmin && styles.disabledRoleCard
                                   ]}
                                   onPress={() => {
                                       if (item.id !== 'superadmin' || isSuperAdmin) {
                                           setRole(item.id);
                                       }
                                   }}
                               >
                                   <View style={[styles.roleIconBox, role === item.id && styles.activeRoleIconBox]}>
                                        <Ionicons 
                                            name={item.icon as any} 
                                            size={24} 
                                            color={role === item.id ? '#0f172a' : '#94a3b8'} 
                                        />
                                   </View>
                                   <Text style={[styles.roleLabel, role === item.id && styles.activeRoleLabel]}>{item.label}</Text>
                                   <Text style={styles.roleDesc}>{item.desc}</Text>
                               </Pressable>
                           ))}
                       </View>
                   </View>
   
                   <Pressable
                       style={({ pressed }) => [styles.createButton, { opacity: pressed || loading ? 0.8 : 1 }]}
                       onPress={handleCreateUser}
                       disabled={loading}
                   >
                       {loading ? <ActivityIndicator color="#0f172a" /> : (
                           <>
                               <Text style={styles.createButtonText}>Create Account</Text>
                               <Ionicons name="arrow-forward" size={20} color="#0f172a" />
                           </>
                       )}
                   </Pressable>
               </Animated.View>
           </ScrollView>
       </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { 
      paddingHorizontal: 24, 
      paddingVertical: 20,
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: 16, padding: 8, borderRadius: 12, backgroundColor: '#1e293b' },
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  
  scrollContainer: {
      flexGrow: 1,
      alignItems: 'center',
      padding: 24,
  },
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
  cardHeader: { marginBottom: 24, alignItems: 'center' },
  cardTitle: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  cardSubtitle: { fontSize: 14, color: '#94a3b8' },

  // Error Banner
  errorContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)', 
    borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12, padding: 12, marginBottom: 24,
    gap: 10,
  },
  errorText: { color: '#fca5a5', fontSize: 14, fontWeight: '600', flex: 1 },

  // Input Group
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#94a3b8', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  // Input Wrapper (The container with the border)
  inputWrapper: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: '#0f172a', 
      borderRadius: 16, 
      borderWidth: 1, 
      borderColor: '#334155', 
      height: 56,
      paddingHorizontal: 16,
      ...Platform.select({ web: { transition: 'border-color 0.2s ease, box-shadow 0.2s ease' } })
  },
  
  // Focused State
  inputWrapperFocused: {
    borderColor: '#38bdf8',
    ...Platform.select({
      web: { boxShadow: '0 0 0 4px rgba(56, 189, 248, 0.2)' },
      default: { shadowColor: '#38bdf8', shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }
    })
  },
  
  inputErrorBorder: { borderColor: '#ef4444' },
  inputIcon: { marginRight: 12 },
  
  // The actual text input
  input: { 
      flex: 1, 
      height: '100%', 
      color: '#f8fafc', 
      fontSize: 16,
      ...Platform.select({ web: { outlineStyle: 'none' } }) 
  },
  eyeIcon: { padding: 8 },

  roleSection: { marginBottom: 32 },
  roleGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  roleCard: { 
      flex: 1, 
      minWidth: 100,
      backgroundColor: '#0f172a', 
      borderRadius: 16, 
      padding: 16, 
      borderWidth: 1, 
      borderColor: '#334155',
      alignItems: 'center'
  },
  activeRoleCard: { backgroundColor: '#0f172a', borderColor: '#38bdf8', borderWidth: 2 },
  disabledRoleCard: { opacity: 0.4 },
  
  roleIconBox: { 
      width: 48, height: 48, borderRadius: 12, backgroundColor: '#1e293b', 
      justifyContent: 'center', alignItems: 'center', marginBottom: 12 
  },
  activeRoleIconBox: { backgroundColor: '#38bdf8' },
  
  roleLabel: { fontSize: 14, fontWeight: '700', color: '#94a3b8', marginBottom: 4 },
  activeRoleLabel: { color: '#f8fafc' },
  roleDesc: { fontSize: 10, color: '#64748b', textAlign: 'center' },

  createButton: { 
      backgroundColor: '#38bdf8', 
      paddingVertical: 18, 
      borderRadius: 16, 
      alignItems: 'center', 
      flexDirection: 'row', 
      justifyContent: 'center', 
      gap: 8,
      shadowColor: "#38bdf8",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 6,
  },
  createButtonText: { color: '#0f172a', fontWeight: '800', fontSize: 16 },
});