import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { auth, database } from '../services/firebase';
import { useRouter, useSegments } from 'expo-router';

// --- Updated Types ---
export type UserRole = 'superadmin' | 'admin' | 'staff' | 'kitchen' | 'customer';

interface MenuItem {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    categoryId: string;
    description?: string;
    isKitchenItem?: boolean;
}

interface CartItem extends MenuItem {
    quantity: number;
}

interface UserData {
    role: UserRole;
    username: string;
    email?: string;
}

interface AuthState {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  clearCart: () => void;
}

const AuthContext = createContext<AuthState>({ 
    user: null, 
    userData: null, 
    loading: true, 
    cart: [], 
    setCart: () => {}, 
    clearCart: () => {} 
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // GLOBAL CART STATE
  const [cart, setCart] = useState<CartItem[]>([]);

  const router = useRouter();
  const segments = useSegments();
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  const clearCart = () => {
      setCart([]);
  };

  const handleSignOut = () => {
    auth.signOut();
  };

  const resetInactivityTimer = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    // Kitchen screens usually stay on forever, so maybe increase timeout for them or check role
    if (userData?.role === 'kitchen') return; 
    inactivityTimer.current = setTimeout(handleSignOut, 900000); // 15 mins
  };

  const events = ['mousemove', 'keydown', 'scroll', 'touchstart'];
  const resetTimer = () => resetInactivityTimer();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userRef = ref(database, `users/${currentUser.uid}`);
        onValue(userRef, (snapshot) => {
          const dbUserData = snapshot.exists() ? snapshot.val() : {};
          setUserData({ 
              role: dbUserData.role || 'staff', 
              username: dbUserData.username || 'Guest',
              email: dbUserData.email
          });
          setLoading(false);
        });

        if (typeof window !== 'undefined') {
            window.addEventListener('load', resetTimer);
            events.forEach(event => window.addEventListener(event, resetTimer));
            resetInactivityTimer();
        }

      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
        setCart([]);

        if (typeof window !== 'undefined') {
            events.forEach(event => window.removeEventListener(event, resetTimer));
        }
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      }
    });

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        events.forEach(event => window.removeEventListener(event, resetTimer));
      }
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, []);

  // --- Protected Routes Logic ---
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth'; 
    // Check if user is currently inside the /kitchen route
    const inKitchenRoute = segments[0] === 'kitchen';

    if (user && userData) {
      if (inAuthGroup) {
        // Redirect logic after login
        if (userData.role === 'kitchen') {
            router.replace('/kitchen');
        } else {
            router.replace('/(tabs)/dashboard');
        }
      } else {
        // Enforce Role Boundaries
        if (userData.role === 'kitchen' && !inKitchenRoute) {
            // Kick Kitchen user back to kitchen if they wander off
            router.replace('/kitchen');
        }
      }

    } else if (!user && !inAuthGroup) {
      router.replace('/auth/login');
    }
  }, [user, userData, loading, segments]);

  return (
    <AuthContext.Provider value={{ user, userData, loading, cart, setCart, clearCart }}>
      {children}
    </AuthContext.Provider>
  );
}