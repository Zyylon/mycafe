import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { auth, database } from '../lib/firebaseConfig';
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

        window.addEventListener('load', resetTimer);
        events.forEach(event => window.addEventListener(event, resetTimer));
        resetInactivityTimer();

      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);

        events.forEach(event => window.removeEventListener(event, resetTimer));
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      }
    });

    return () => {
      unsubscribe();
      events.forEach(event => window.removeEventListener(event, resetTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const isRoot = segments.length === 0; // Represents the '/' route (Login)

    if (user) {
      // If user is logged in and explicitly on the Login page (root), redirect to Dashboard.
      // We do NOT redirect if they are on other pages (like checkout, create-user), 
      // allowing navigation to those routes.
      if (isRoot) {
        router.replace('/(tabs)/dashboard');
      }
    } else {
      // If user is NOT logged in, they should only be on the Login page.
      // If they are anywhere else, redirect to Login.
      if (!isRoot) {
        router.replace('/');
      }
    }
  }, [user, loading, segments, router]);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
