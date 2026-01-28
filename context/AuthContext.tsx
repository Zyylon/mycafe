import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { auth, database } from '../services/firebase';
import { useRouter, useSegments } from 'expo-router';

interface AuthState {
  user: User | null;
  userData: { role?: string; username?: string } | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, userData: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<{ role?: string; username?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  const handleSignOut = () => {
    auth.signOut();
  };

  const resetInactivityTimer = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(handleSignOut, 900000); // 900 seconds
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
          setUserData({ role: dbUserData.role || 'staff', username: dbUserData.username || 'Guest' });
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

  useEffect(() => {
    if (loading) return;

    // Check if we are in the auth group (e.g. login page)
    const inAuthGroup = segments[0] === 'auth'; 

    if (user && inAuthGroup) {
      // If user is logged in but on the auth pages (login), redirect to dashboard
      router.replace('/(tabs)/dashboard');
    } else if (!user && !inAuthGroup) {
      // If user is NOT logged in and NOT on an auth page, redirect to login
      router.replace('/auth/login');
    }
  }, [user, loading, segments]);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
