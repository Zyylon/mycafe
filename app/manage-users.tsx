import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, Platform, Modal } from 'react-native';
import { database, auth } from '../lib/firebaseConfig';
import { ref, onValue, update } from 'firebase/database';
import { onAuthStateChanged, User as FirebaseUser, sendPasswordResetEmail } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';

interface User {
    uid: string;
    username: string;
    email: string;
    role: string;
}

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
    
    // Modal state for role selection
    const [roleModalVisible, setRoleModalVisible] = useState(false);
    const [selectedUserForRole, setSelectedUserForRole] = useState<User | null>(null);

    // Modal state for confirmations (Delete / Reset Password)
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'delete' | 'reset' | null>(null);
    const [confirmUser, setConfirmUser] = useState<User | null>(null);
    const [confirmMessage, setConfirmMessage] = useState({ title: '', body: '', confirmText: 'Confirm', confirmColor: '#38bdf8' });

    useEffect(() => {
        const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                setCurrentUser(firebaseUser);
                const userRoleRef = ref(database, `users/${firebaseUser.uid}/role`);
                
                onValue(userRoleRef, (snapshot) => {
                    const role = snapshot.val();
                    setCurrentUserRole(role);

                    if (role === 'admin' || role === 'superadmin') {
                        const usersRef = ref(database, 'users');
                        onValue(usersRef, (usersSnapshot) => {
                            const usersData = usersSnapshot.val() || {};
                            const usersList: User[] = Object.keys(usersData).map(uid => ({ uid, ...usersData[uid] }));
                            setUsers(usersList);
                            setLoading(false);
                        });
                    } else {
                        setLoading(false);
                        Alert.alert('Permission Denied', "You don't have permission to view this page.");
                        router.back();
                    }
                });
            } else {
                setLoading(false);
                router.replace('/');
            }
        });

        return () => authUnsubscribe();
    }, []);

    // --- Action Initiators ---

    const initiateDeleteUser = (user: User) => {
        if (user.uid === currentUser?.uid) {
            return showAlert("Action Forbidden", "You cannot delete your own account.");
        }
        if (currentUserRole === 'admin' && user.role === 'superadmin') {
            return showAlert("Permission Denied", "Admins cannot delete Superadmins.");
        }
        if (currentUserRole === 'admin' && user.role === 'admin') {
             return showAlert("Permission Denied", "Admins cannot delete other Admins.");
        }

        setConfirmUser(user);
        setConfirmAction('delete');
        setConfirmMessage({
            title: `Delete ${user.username}?`,
            body: `This will remove the user's access. They will not be able to log in.\n\nNote: The email address will remain registered in the authentication system.`,
            confirmText: 'Delete User',
            confirmColor: '#ef4444' // Red for delete
        });
        setConfirmModalVisible(true);
    };

    const initiateResetPassword = (user: User) => {
        setConfirmUser(user);
        setConfirmAction('reset');
        setConfirmMessage({
            title: "Reset Password",
            body: `Send a password reset email to ${user.email}?`,
            confirmText: 'Send Email',
            confirmColor: '#38bdf8' // Blue for reset
        });
        setConfirmModalVisible(true);
    };

    // --- Action Executors ---

    const performConfirmedAction = async () => {
        if (!confirmUser || !confirmAction) return;

        setConfirmModalVisible(false); // Close modal immediately

        if (confirmAction === 'delete') {
            try {
                const hashedUsername = await hashUsername(confirmUser.username);
                const updates = {};
                updates[`/users/${confirmUser.uid}`] = null;
                updates[`/username_map/${hashedUsername}`] = null;
                await update(ref(database), updates);
                showAlert("Success", "User deleted successfully.");
            } catch (error: any) {
                console.error("Delete Error", error);
                showAlert("Error", error.message);
            }
        } else if (confirmAction === 'reset') {
            try {
                await sendPasswordResetEmail(auth, confirmUser.email);
                showAlert("Success", `Password reset email sent to ${confirmUser.email}.`);
            } catch (error: any) {
                console.error("Reset Password Error", error);
                showAlert("Error", error.message);
            }
        }

        setConfirmUser(null);
        setConfirmAction(null);
    };

    const showAlert = (title: string, message: string) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}: ${message}`);
        } else {
            Alert.alert(title, message);
        }
    };

    // --- Role Management ---

    const openRoleModal = (user: User) => {
        if (currentUserRole === 'admin' && (user.role === 'superadmin' || user.role === 'admin')) {
             return showAlert("Permission Denied", "Admins cannot modify the role of Superadmins or other Admins.");
        }
        setSelectedUserForRole(user);
        setRoleModalVisible(true);
    };

    const handleChangeRole = async (newRole: string) => {
        if (!selectedUserForRole) return;
        try {
            await update(ref(database, `users/${selectedUserForRole.uid}`), { role: newRole });
            showAlert("Success", `User role updated to ${newRole}.`);
            setRoleModalVisible(false);
            setSelectedUserForRole(null);
        } catch (error: any) {
            console.error("Change Role Error", error);
            showAlert("Error", error.message);
        }
    };

    const renderUserItem = ({ item }: { item: User }) => {
        const canModify = (currentUserRole === 'superadmin' && item.uid !== currentUser?.uid) || 
                          (currentUserRole === 'admin' && item.role !== 'superadmin' && item.role !== 'admin');

        return (
            <View style={styles.userItem}>
                <View style={styles.userInfoContainer}>
                    <Ionicons name="person-circle-outline" size={40} color="#94a3b8" />
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{item.username}</Text>
                        <Text style={styles.userEmail}>{item.email}</Text>
                        <Text style={[styles.userRole, { color: item.role === 'superadmin' ? '#f43f5e' : item.role === 'admin' ? '#38bdf8' : '#94a3b8' }]}>
                            {item.role.toUpperCase()}
                        </Text>
                    </View>
                </View>
                
                {canModify && (
                    <View style={styles.actionButtons}>
                        <Pressable onPress={() => openRoleModal(item)} style={styles.iconButton}>
                            <Ionicons name="create-outline" size={22} color="#fbbf24" />
                        </Pressable>
                        <Pressable onPress={() => initiateResetPassword(item)} style={styles.iconButton}>
                            <Ionicons name="key-outline" size={22} color="#38bdf8" />
                        </Pressable>
                        <Pressable onPress={() => initiateDeleteUser(item)} style={styles.iconButton}>
                            <Ionicons name="trash-bin-outline" size={22} color="#ef4444" />
                        </Pressable>
                    </View>
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
                    ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>No users found.</Text></View>}
                />
            )}

            {/* Role Selection Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={roleModalVisible}
                onRequestClose={() => setRoleModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setRoleModalVisible(false)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Change Role for {selectedUserForRole?.username}</Text>
                        <Pressable style={styles.modalOption} onPress={() => handleChangeRole('staff')}>
                            <Text style={styles.modalOptionText}>Staff</Text>
                        </Pressable>
                        <Pressable style={styles.modalOption} onPress={() => handleChangeRole('admin')}>
                            <Text style={styles.modalOptionText}>Admin</Text>
                        </Pressable>
                        {currentUserRole === 'superadmin' && (
                            <Pressable style={styles.modalOption} onPress={() => handleChangeRole('superadmin')}>
                                <Text style={styles.modalOptionText}>Superadmin</Text>
                            </Pressable>
                        )}
                        <Pressable style={[styles.modalOption, styles.cancelOption]} onPress={() => setRoleModalVisible(false)}>
                            <Text style={[styles.modalOptionText, { color: '#ef4444' }]}>Cancel</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

            {/* Confirmation Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={confirmModalVisible}
                onRequestClose={() => setConfirmModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setConfirmModalVisible(false)}>
                    <View style={styles.modalContent}>
                        <Ionicons 
                            name={confirmAction === 'delete' ? "alert-circle-outline" : "information-circle-outline"} 
                            size={50} 
                            color={confirmMessage.confirmColor} 
                            style={{ marginBottom: 10, alignSelf: 'center' }}
                        />
                        <Text style={styles.modalTitle}>{confirmMessage.title}</Text>
                        <Text style={styles.modalBody}>{confirmMessage.body}</Text>
                        
                        <View style={styles.modalButtonContainer}>
                            <Pressable 
                                style={[styles.modalButton, { backgroundColor: '#334155' }]} 
                                onPress={() => setConfirmModalVisible(false)}
                            >
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </Pressable>
                            <Pressable 
                                style={[styles.modalButton, { backgroundColor: confirmMessage.confirmColor }]} 
                                onPress={performConfirmedAction}
                            >
                                <Text style={[styles.modalButtonText, { color: '#0f172a' }]}>{confirmMessage.confirmText}</Text>
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 15, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
    title: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc' },
    backButton: { padding: 5 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
    userItem: { backgroundColor: '#1e293b', padding: 15, borderRadius: 12, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
    userInfoContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    userInfo: { marginLeft: 15 },
    userName: { fontSize: 17, fontWeight: 'bold', color: '#f1f5f9' },
    userEmail: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
    userRole: { fontSize: 12, fontWeight: 'bold', marginTop: 4 },
    actionButtons: { flexDirection: 'row' },
    iconButton: { padding: 8, marginLeft: 5 },
    emptyText: { color: '#94a3b8', fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#1e293b', borderRadius: 16, padding: 24, width: '85%', maxWidth: 400, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#f8fafc', marginBottom: 10, textAlign: 'center' },
    modalBody: { fontSize: 16, color: '#cbd5e1', marginBottom: 24, textAlign: 'center', lineHeight: 24 },
    modalOption: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#334155', alignItems: 'center', width: '100%' },
    modalOptionText: { color: '#f1f5f9', fontSize: 16, fontWeight: '500' },
    cancelOption: { borderBottomWidth: 0, marginTop: 10 },
    modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 15 },
    modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    modalButtonText: { color: '#f8fafc', fontWeight: 'bold', fontSize: 16 },
});
