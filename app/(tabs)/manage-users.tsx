import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, Platform, Modal, useWindowDimensions, KeyboardAvoidingView } from 'react-native';
import { database, auth } from '../../services/firebase';
import { ref, onValue, update } from 'firebase/database';
import { onAuthStateChanged, User as FirebaseUser, sendPasswordResetEmail } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';

interface User {
    uid: string;
    username: string;
    email: string;
    role: string;
    disabled?: boolean; // New field for disable functionality
}

// Web-specific scrollbar styles (Consistent with Dashboard)
const WebScrollbarStyles = () => {
    if (Platform.OS !== 'web') return null;
    return (
        <style type="text/css">
            {`
            ::-webkit-scrollbar {
                width: 10px;
                height: 10px;
            }
            ::-webkit-scrollbar-track {
                background: #0f172a; 
            }
            ::-webkit-scrollbar-thumb {
                background: #334155; 
                border-radius: 5px;
                border: 2px solid #0f172a;
            }
            ::-webkit-scrollbar-thumb:hover {
                background: #475569; 
            }
            /* Firefox */
            * {
                scrollbar-width: thin;
                scrollbar-color: #334155 #0f172a;
            }
            `}
        </style>
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

    // Modal state for confirmations
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'toggleDisable' | 'reset' | null>(null);
    const [confirmUser, setConfirmUser] = useState<User | null>(null);
    const [confirmMessage, setConfirmMessage] = useState({ title: '', body: '', confirmText: 'Confirm', confirmColor: '#38bdf8' });

    const { width } = useWindowDimensions();

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

    const initiateToggleDisableUser = (user: User) => {
        if (user.uid === currentUser?.uid) {
            return showAlert("Action Forbidden", "You cannot disable your own account.");
        }
        if (currentUserRole === 'admin' && user.role === 'superadmin') {
            return showAlert("Permission Denied", "Admins cannot modify Superadmins.");
        }
        if (currentUserRole === 'admin' && user.role === 'admin') {
             return showAlert("Permission Denied", "Admins cannot modify other Admins.");
        }

        const isDisabling = !user.disabled;
        setConfirmUser(user);
        setConfirmAction('toggleDisable');
        setConfirmMessage({
            title: isDisabling ? `Disable ${user.username}?` : `Enable ${user.username}?`,
            body: isDisabling 
                ? `This will prevent the user from logging in immediately.` 
                : `This will restore the user's access. A password reset email will also be sent to ${user.email} so they can set a new password.`,
            confirmText: isDisabling ? 'Disable User' : 'Enable User',
            confirmColor: isDisabling ? '#ef4444' : '#22c55e'
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
            confirmColor: '#38bdf8' 
        });
        setConfirmModalVisible(true);
    };

    // --- Action Executors ---

    const performConfirmedAction = async () => {
        if (!confirmUser || !confirmAction) return;

        setConfirmModalVisible(false);

        if (confirmAction === 'toggleDisable') {
            try {
                const isDisabling = !confirmUser.disabled;
                
                // Update the disabled status in database
                await update(ref(database, `users/${confirmUser.uid}`), { disabled: isDisabling });

                if (!isDisabling) {
                    // If enabling, also send reset email
                    try {
                        await sendPasswordResetEmail(auth, confirmUser.email);
                    } catch (e) {
                        console.warn("Could not send reset email automatically:", e);
                    }
                }

                showAlert("Success", `User ${isDisabling ? 'disabled' : 'enabled'} successfully.`);
            } catch (error: any) {
                console.error("Disable/Enable Error", error);
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
        const isSelf = item.uid === currentUser?.uid;

        return (
            <View style={[styles.userItem, item.disabled && styles.disabledUserItem]}>
                <View style={styles.userInfoContainer}>
                    <View style={styles.avatarContainer}>
                         <Ionicons name="person-circle-outline" size={48} color={item.disabled ? "#64748b" : "#94a3b8"} />
                         {item.disabled && (
                            <View style={styles.disabledBadge}>
                                <Ionicons name="ban" size={14} color="white" />
                            </View>
                         )}
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={[styles.userName, item.disabled && styles.disabledText]}>
                            {item.username} {isSelf && "(You)"}
                        </Text>
                        <Text style={[styles.userEmail, item.disabled && styles.disabledText]}>{item.email}</Text>
                        <Text style={[
                            styles.userRole, 
                            { color: item.disabled ? '#64748b' : (item.role === 'superadmin' ? '#f43f5e' : item.role === 'admin' ? '#38bdf8' : '#94a3b8') }
                        ]}>
                            {item.role.toUpperCase()} {item.disabled && "- DISABLED"}
                        </Text>
                    </View>
                </View>
                
                {canModify && (
                    <View style={styles.actionButtons}>
                        <Pressable onPress={() => openRoleModal(item)} style={styles.iconButton}>
                            <Ionicons name="create-outline" size={24} color={item.disabled ? "#64748b" : "#fbbf24"} />
                        </Pressable>
                        <Pressable onPress={() => initiateResetPassword(item)} style={styles.iconButton}>
                            <Ionicons name="key-outline" size={24} color={item.disabled ? "#64748b" : "#38bdf8"} />
                        </Pressable>
                        <Pressable onPress={() => initiateToggleDisableUser(item)} style={styles.iconButton}>
                            <Ionicons 
                                name={item.disabled ? "checkmark-circle-outline" : "ban-outline"} 
                                size={24} 
                                color={item.disabled ? "#22c55e" : "#ef4444"} 
                            />
                        </Pressable>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#0f172a' }}>
             <WebScrollbarStyles />
             <KeyboardAvoidingView
               behavior={Platform.OS === 'ios' ? 'padding' : undefined}
               style={styles.container}
             >
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
                        contentContainerStyle={styles.listContent}
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
                                name={confirmAction === 'toggleDisable' && confirmMessage.confirmText.includes('Disable') ? "ban-outline" : "information-circle-outline"} 
                                size={50} 
                                color={confirmMessage.confirmColor} 
                                style={{ marginBottom: 16, alignSelf: 'center' }}
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
            </KeyboardAvoidingView>
        </View>
       
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    
    // Header - matching Dashboard style
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 24, 
        paddingTop: Platform.OS === 'ios' ? 50 : 24,
        paddingBottom: 24,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderBottomWidth: 1, 
        borderBottomColor: 'rgba(255,255,255,0.05)',
        zIndex: 10,
    },
    title: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
    backButton: { padding: 8, borderRadius: 20, backgroundColor: '#1e293b' },
    
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
    listContent: { padding: 24 },

    // User Item - matching Dashboard Cards
    userItem: { 
        backgroundColor: '#1e293b', 
        padding: 20, 
        borderRadius: 24, 
        marginBottom: 16, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderWidth: 1, 
        borderColor: '#334155',
        ...Platform.select({
            web: { 
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
            },
            default: { elevation: 4 }
        }),
    },
    disabledUserItem: { backgroundColor: '#1e293b', borderColor: '#475569', opacity: 0.6 },
    
    userInfoContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatarContainer: { position: 'relative', marginRight: 16 },
    disabledBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#ef4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1e293b' },
    
    userInfo: { flex: 1 },
    userName: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
    disabledText: { color: '#94a3b8' },
    userEmail: { fontSize: 14, color: '#94a3b8', marginBottom: 6 },
    userRole: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
    
    actionButtons: { flexDirection: 'row', gap: 8 },
    iconButton: { padding: 10, borderRadius: 12, backgroundColor: '#0f172a' },
    
    emptyText: { color: '#94a3b8', fontSize: 16 },
    
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' },
    modalContent: { backgroundColor: '#1e293b', borderRadius: 24, padding: 32, width: '90%', maxWidth: 450, borderWidth: 1, borderColor: '#38bdf8', alignItems: 'center', shadowColor: '#38bdf8', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    modalTitle: { fontSize: 22, fontWeight: '800', color: '#f8fafc', marginBottom: 12, textAlign: 'center' },
    modalBody: { fontSize: 16, color: '#cbd5e1', marginBottom: 32, textAlign: 'center', lineHeight: 24 },
    
    modalOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#334155', alignItems: 'center', width: '100%' },
    modalOptionText: { color: '#f1f5f9', fontSize: 18, fontWeight: '600' },
    cancelOption: { borderBottomWidth: 0, marginTop: 12 },
    
    modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 16 },
    modalButton: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    modalButtonText: { color: '#f8fafc', fontWeight: '800', fontSize: 16 },
});
