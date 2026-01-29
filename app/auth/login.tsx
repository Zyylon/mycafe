import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { browserSessionPersistence, setPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { get, ref, push, set } from 'firebase/database';
import React, { useState, useRef, useEffect } from 'react';
import { 
  ActivityIndicator, 
  Image, 
  KeyboardAvoidingView, 
  LayoutAnimation,
  Platform, 
  Pressable, 
  StyleSheet, 
  Text, 
  TextInput, 
  UIManager,
  View,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, database } from '../../services/firebase';

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

export default function LoginScreen() {
  const router = useRouter();
  const [loginInput, setLoginInput] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [focusedField, setFocusedField] = useState<'identity' | 'password' | null>(null);

  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (errorMessage) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setErrorMessage(null);
    }
  }, [loginInput, password]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  const handleLogin = async () => {
    if (loginInput === '' || password === '') {
      triggerShake();
      setErrorMessage('Please enter both identity and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await setPersistence(auth, browserSessionPersistence);
      let email = loginInput;

      if (!loginInput.includes('@')) {
        const hashedUsername = await hashUsername(loginInput);
        const mapRef = ref(database, `username_map/${hashedUsername}`);
        const mapSnapshot = await get(mapRef);

        if (!mapSnapshot.exists()) {
           throw { code: 'custom/user-not-found' }; 
        }
        email = mapSnapshot.val();
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userData.disabled) {
            await signOut(auth);
            throw { code: 'custom/account-disabled' };
        }

        // --- RECORD LOGIN HISTORY WITH IP ---
        try {
            // Fetch public IP with a timeout
            const ipPromise = fetch('https://api.ipify.org?format=json')
                .then(res => res.json())
                .then(data => data.ip)
                .catch(() => 'Unknown IP');
                
            // Race against a 2-second timeout to prevent hanging
            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('Timeout IP'), 2000));
            const ipAddress = await Promise.race([ipPromise, timeoutPromise]);

            const historyRef = ref(database, `users/${user.uid}/loginHistory`);
            const newHistoryRef = push(historyRef);
            
            const deviceInfo = Platform.OS === 'web' 
                ? navigator.userAgent 
                : `${Platform.OS} ${Platform.Version}`;

            await set(newHistoryRef, {
                timestamp: Date.now(),
                date: new Date().toISOString(),
                device: deviceInfo,
                platform: Platform.OS,
                ip: ipAddress
            });
        } catch (logError) {
            console.warn("Failed to log login history:", logError);
        }
        // -----------------------------

        router.replace('/(tabs)/dashboard');
      } else {
        await signOut(auth);
        throw { code: 'custom/user-data-missing' };
      }
    } catch (error: any) {
      console.error(error);
      triggerShake();
      
      let msg = 'An unexpected error occurred.';
      switch (error.code) {
          case 'auth/invalid-credential':
          case 'auth/wrong-password':
          case 'auth/user-not-found':
          case 'custom/user-not-found':
              msg = 'Incorrect username or password.';
              break;
          case 'auth/invalid-email':
              msg = 'The email address format is invalid.';
              break;
          case 'auth/too-many-requests':
              msg = 'Too many attempts. Please try again later.';
              break;
          case 'auth/network-request-failed':
              msg = 'Network error. Check your internet connection.';
              break;
          case 'custom/account-disabled':
              msg = 'Your account has been disabled by an admin.';
              break;
          case 'custom/user-data-missing':
              msg = 'User profile not found. Contact support.';
              break;
          default:
              msg = error.message || msg;
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.mainContent}>
          
          <View style={styles.logoContainer}>
            <Image 
                source={require('../../assets/images/sns.png')} 
                style={styles.logo}
            />
            <Text style={styles.appName}>Slice n' Spice</Text>
          </View>

          <Animated.View style={[styles.floatingCard, { transform: [{ translateX: shakeAnimation }] }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.headerText}>Welcome Back</Text>
              <Text style={styles.subHeaderText}>Sign in to continue</Text>
            </View>

            {errorMessage && (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color="#f87171" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            )}

            {/* IDENTITY INPUT */}
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Identity</Text>
                <View style={[
                    styles.inputWrapper, 
                    errorMessage && styles.inputErrorBorder,
                    focusedField === 'identity' && styles.inputWrapperFocused
                ]}>
                    <Ionicons 
                        name="person-outline" 
                        size={20} 
                        color={focusedField === 'identity' ? "#38bdf8" : "#64748b"} 
                        style={styles.inputIcon} 
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Email or Username"
                        placeholderTextColor="#64748b"
                        value={loginInput}
                        onChangeText={setLoginInput}
                        autoCapitalize="none"
                        returnKeyType="next"
                        onSubmitEditing={() => passwordInputRef.current?.focus()}
                        onFocus={() => setFocusedField('identity')}
                        onBlur={() => setFocusedField(null)}
                    />
                </View>
            </View>

            {/* PASSWORD INPUT */}
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
                        ref={passwordInputRef}
                        style={styles.input}
                        placeholder="Enter Password"
                        placeholderTextColor="#64748b"
                        secureTextEntry={!isPasswordVisible}
                        value={password}
                        onChangeText={setPassword}
                        returnKeyType="go"
                        onSubmitEditing={handleLogin}
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

            <Pressable
                style={({ pressed }) => [
                  styles.button, 
                  { opacity: pressed || loading ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }
                ]}
                onPress={handleLogin}
                disabled={loading}
            >
                {loading ? (
                <ActivityIndicator color="#0f172a" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={20} color="#0f172a" style={{marginLeft: 8}} />
                  </>
                )}
            </Pressable>
          </Animated.View>
        </View>

        <View style={styles.footerBranding}>
            <Text style={styles.footerCredit}>Designed by Infinity Crafters</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  keyboardView: { flex: 1 },
  mainContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 90, height: 90, resizeMode: 'contain', marginBottom: 16, shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 20 },
  appName: { fontSize: 32, fontWeight: '800', color: '#f8fafc', letterSpacing: 1, textShadowColor: 'rgba(56, 189, 248, 0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },

  floatingCard: { width: '100%', maxWidth: 420, backgroundColor: '#1e293b', paddingHorizontal: 32, paddingVertical: 40, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 10 },
  cardHeader: { marginBottom: 24, alignItems: 'center' },
  headerText: { fontSize: 24, fontWeight: '700', color: '#f1f5f9', marginBottom: 8 },
  subHeaderText: { fontSize: 15, color: '#94a3b8' },

  errorContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', borderRadius: 12, padding: 12, marginBottom: 20, gap: 10 },
  errorText: { color: '#fca5a5', fontSize: 14, fontWeight: '600', flex: 1 },
  
  inputGroup: { marginBottom: 24, width: '100%' },
  label: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  // Wrapper Base Style
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a',
    borderRadius: 16, borderWidth: 1, borderColor: '#334155', height: 56, paddingHorizontal: 16,
    ...Platform.select({ web: { transition: 'border-color 0.2s ease, box-shadow 0.2s ease' } })
  },
  
  // FOCUSED STATE
  inputWrapperFocused: {
    borderColor: '#38bdf8', // Sky Blue Border
    ...Platform.select({
      web: { boxShadow: '0 0 0 4px rgba(56, 189, 248, 0.2)' },
      default: { shadowColor: '#38bdf8', shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }
    })
  },
  
  inputErrorBorder: { borderColor: '#ef4444' },
  inputIcon: { marginRight: 12 },
  
  input: { 
      flex: 1, height: '100%', fontSize: 16, color: '#f8fafc',
      ...Platform.select({ web: { outlineStyle: 'none' } })
  },
  
  eyeIcon: { padding: 8 },
  button: { backgroundColor: '#38bdf8', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginTop: 8, width: '100%', shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  buttonText: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  footerBranding: { padding: 24, alignItems: 'center' },
  footerCredit: { fontSize: 13, fontWeight: '500', color: '#475569' },
});
