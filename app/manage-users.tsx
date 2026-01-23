import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { database, auth } from '../lib/firebaseConfig';
import { ref, onValue, off, remove, update } from 'firebase/database';
import * as Crypto from 'expo-crypto';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';

interface User {
    uid: string;
    username: string;
    email: string;
    role: string;
}

// Hash function to find the username in the username_map
const hashUsername = async (username: string) => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    username.toLowerCase()
  );
};

export default function ManageUsersScreen() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

    useEffect(() => {
        let roleListenerOff = () => {};
        let usersListenerOff = () => {};

        const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            // Clean up previous listeners if auth state changes or on re-render
            roleListenerOff();
            usersListenerOff();
            
            setLoading(true);

            if (firebaseUser) {
                setCurrentUser(firebaseUser);
                const userRoleRef = ref(database, `users/${firebaseUser.uid}/role`);

                roleListenerOff = onValue(userRoleRef, (snapshot) => {
                    usersListenerOff(); // Detach previous users listener if role changes
                    const role = snapshot.val();
                    setCurrentUserRole(role);

                    if (role === 'admin' || role === 'superadmin') {
                        const usersRef = ref(database, 'users');
                        usersListenerOff = onValue(usersRef, (usersSnapshot) => {
                            const usersData = usersSnapshot.val() || {};
                            const usersList: User[] = Object.keys(usersData).map(uid => ({ uid, ...usersData[uid] }));
                            setUsers(usersList);
                            setLoading(false);
                        }, (error) => {
                            console.error("Firebase (users) read error:", error);
                            Alert.alert("Network Error", "Failed to fetch user list. Please check your connection and database rules.");
                            setLoading(false);
                        });
                    } else {
                        setLoading(false);
                        // Avoid showing alert if role is just loading (null)
                        if (role) {
                             Alert.alert('Permission Denied', "You don't have the required permissions to view this page.");
                             router.back();
                        }
                    }
                }, (error) => {
                    console.error("Firebase (role) read error:", error);
                    Alert.alert("Network Error", "Failed to verify user permissions.");
                    setLoading(false);
                });
            } else {
                setLoading(false);
                router.replace('/');
            }
        });

        return () => {
            authUnsubscribe();
            roleListenerOff();
            usersListenerOff();
        };
    }, [router]);

    const handleDeleteUser = useCallback(async (userToDelete: User) => {
        if (userToDelete.uid === currentUser?.uid) {
            return Alert.alert("Action Forbidden", "You cannot delete your own account.");
        }
        if (currentUserRole === 'admin' && userToDelete.role === 'superadmin') {
            return Alert.alert("Permission Denied", "Admins cannot delete Superadmins.");
        }

        Alert.alert(
            `Delete ${userToDelete.username}`,
            `This will permanently delete the user and their associated data. This action is irreversible.`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            const hashedUsername = await hashUsername(userToDelete.username);

                            // Atomically remove user from `users` and `username_map`
                            const updates = {};
                            updates[`/users/${userToDelete.uid}`] = null;
                            updates[`/username_map/${hashedUsername}`] = null;
                            
                            await update(ref(database), updates);
                            
                            Alert.alert("Success", `User ${userToDelete.username} has been deleted.`);
                        } catch (error) {
                            console.error("Delete user error:", error);
                            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
                            Alert.alert("Deletion Failed", errorMessage);
                        }
                    }
                }
            ]
        );
    }, [currentUser, currentUserRole]);


    const renderUserItem = ({ item }: { item: User }) => {
        const canModify = (currentUserRole === 'superadmin' && item.uid !== currentUser?.uid) || 
                          (currentUserRole === 'admin' && item.role !== 'superadmin' && item.uid !== currentUser?.uid);

        return (
            <View style={styles.userItem}>
                <Ionicons name="person-circle-outline" size={40} color="#94a3b8" />
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.username}</Text>
                    <Text style={styles.userEmail}>{item.email}</Text>
                </View>
                <View style={[styles.userRoleContainer, styles[`role_${item.role}`]]}>
                    <Text style={styles.userRole}>{item.role}</Text>
                </View>
                {canModify && (
                     <Pressable onPress={() => handleDeleteUser(item)} style={({ pressed }) => [styles.deleteButton, { opacity: pressed ? 0.7 : 1 }]}>
                        <Ionicons name="trash-bin-outline" size={22} color="#ef4444" />
                    </Pressable>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Manage Users</Text>
                <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}>
                    <Ionicons name="close-outline" size={28} color="#94a3b8" />
                </Pressable>
            </View>
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#38bdf8" /></View>
            ) : (
                <FlatList
                    data={users}
                    renderItem={renderUserItem}
                    keyExtractor={(item) => item.uid}
                    contentContainerStyle={{ padding: 20 }}
                    ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>No users found in the database.</Text></View>}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 15, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
    title: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc' },
    backButton: { padding: 5 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
    userItem: { backgroundColor: '#1e293b', padding: 15, borderRadius: 12, marginBottom: 15, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
    userInfo: { flex: 1, marginLeft: 15 },
    userName: { fontSize: 17, fontWeight: 'bold', color: '#f1f5f9' },
    userEmail: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
    userRoleContainer: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, minWidth: 80, alignItems: 'center', marginHorizontal: 10 },
    role_user: { backgroundColor: '#374151' },
    role_admin: { backgroundColor: '#1d4ed8' },
    role_superadmin: { backgroundColor: '#be123c' },
    userRole: { color: '#f1f5f9', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' },
    deleteButton: { padding: 8 },
    emptyText: { color: '#94a3b8', textAlign: 'center', fontSize: 16 }
});
