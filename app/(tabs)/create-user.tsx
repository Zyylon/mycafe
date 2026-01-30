import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, Platform, Modal, useWindowDimensions, KeyboardAvoidingView, LayoutAnimation, UIManager, TextInput } from 'react-native';
import { database, auth } from '../../services/firebase';
import { ref, onValue, update, get, remove, set } from 'firebase/database';
import { onAuthStateChanged, User as FirebaseUser, sendPasswordResetEmail } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';

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

interface LoginEvent {
    timestamp: number;
    date: string;
    device?: string;
    platform?: string;
    ip?: string;
}

interface User {
    uid: string;
    username: string;
    email: string;
    role: string;
    disabled?: boolean;
    loginHistory?: Record<string, LoginEvent>;
}

// Web-specific scrollbar styles
const WebScrollbarStyles = () => {
    if (Platform.OS !== 'web') return null;
    return (
        <style type="text/css">
            {`
            ::-webkit-scrollbar { width: 8px; height: 8px; }
            ::-webkit-scrollbar-track { background: #0f172a; }
            ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
            ::-webkit-scrollbar-thumb:hover { background: #475569; }
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
    
    // UI State
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

    // Modal states
    const [roleModalVisible, setRoleModalVisible] = useState(false);
    const [selectedUserForRole, setSelectedUserForRole] = useState<User | null>(null);

    const [editUserModalVisible, setEditUserModalVisible] = useState(false);
    const [editUser, setEditUser] = useState<User | null>(null);
    const [newUsername, setNewUsername] = useState('');
    const [isUpdatingUser, setIsUpdatingUser] = useState(false);

    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'toggleDisable' | 'reset' | null>(null);
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

    const toggleExpand = (uid: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedUserId(expandedUserId === uid ? null : uid);
    };

    const showAlert = (title: string, message: string) => {
        if (Platform.OS === 'web') window.alert(`${title}: ${message}`);
        else Alert.alert(title, message);
    };

    // --- Action Initiators ---

    const initiateToggleDisableUser = (user: User) => {
        if (user.uid === currentUser?.uid) return showAlert("Action Forbidden", "You cannot disable your own account.");
        if (currentUserRole === 'admin' && (user.role === 'superadmin' || user.role === 'admin')) {
            return showAlert("Permission Denied", "Admins cannot modify other Admins or Superadmins.");
        }

        const isDisabling = !user.disabled;
        setConfirmUser(user);
        setConfirmAction('toggleDisable');
        setConfirmMessage({
            title: isDisabling ? `Disable User?` : `Enable User?`,
            body: isDisabling 
                ? `Disable access for ${user.username}?` 
                : `Restore access for ${user.username}? A reset email will be sent.`,
            confirmText: isDisabling ? 'Disable' : 'Enable',
            confirmColor: isDisabling ? '#ef4444' : '#22c55e'
        });
        setConfirmModalVisible(true);
    };

    const initiateResetPassword = (user: User) => {
        setConfirmUser(user);
        setConfirmAction('reset');
        setConfirmMessage({
            title: "Reset Password",
            body: `Send password reset email to ${user.email}?`,
            confirmText: 'Send Email',
            confirmColor: '#38bdf8' 
        });
        setConfirmModalVisible(true);
    };

    const openEditUserModal = (user: User) => {
        if (currentUserRole !== 'superadmin') return;
        setEditUser(user);
        setNewUsername(user.username);
        setEditUserModalVisible(true);
    };

    // --- Action Executors ---

    const performConfirmedAction = async () => {
        if (!confirmUser || !confirmAction) return;
        setConfirmModalVisible(false);

        try {
            if (confirmAction === 'toggleDisable') {
                const isDisabling = !confirmUser.disabled;
                await update(ref(database, `users/${confirmUser.uid}`), { disabled: isDisabling });
                if (!isDisabling) await sendPasswordResetEmail(auth, confirmUser.email).catch(console.warn);
                showAlert("Success", `User ${isDisabling ? 'disabled' : 'enabled'}.`);
            } else if (confirmAction === 'reset') {
                await sendPasswordResetEmail(auth, confirmUser.email);
                showAlert("Success", `Reset email sent.`);
            }
        } catch (error: any) {
            showAlert("Error", error.message);
        }
        setConfirmUser(null);
        setConfirmAction(null);
    };

    const handleUpdateUsername = async () => {
        if (!editUser || !newUsername.trim()) return;
        if (newUsername.trim().toLowerCase() === editUser.username.toLowerCase()) {
            setEditUserModalVisible(false);
            return;
        }

        setIsUpdatingUser(true);
        try {
            const oldHash = await hashUsername(editUser.username);
            const newHash = await hashUsername(newUsername.trim());

            // Check collision
            const newUsernameRef = ref(database, `username_map/${newHash}`);
            const snapshot = await get(newUsernameRef);
            if (snapshot.exists()) {
                throw new Error("Username already taken.");
            }

            // Perform Update
            await remove(ref(database, `username_map/${oldHash}`));
            await set(ref(database, `username_map/${newHash}`), editUser.email.toLowerCase());
            await update(ref(database, `users/${editUser.uid}`), { username: newUsername.trim() });

            showAlert("Success", "Username updated successfully.");
            setEditUserModalVisible(false);
        } catch (error: any) {
            showAlert("Update Failed", error.message);
        } finally {
            setIsUpdatingUser(false);
        }
    };

    // --- Role Management ---

    const openRoleModal = (user: User) => {
        if (currentUserRole === 'admin' && (user.role === 'superadmin' || user.role === 'admin')) {
             return showAlert("Permission Denied", "Admins cannot modify higher roles.");
        }
        setSelectedUserForRole(user);
        setRoleModalVisible(true);
    };

    const handleChangeRole = async (newRole: string) => {
        if (!selectedUserForRole) return;
        try {
            await update(ref(database, `users/${selectedUserForRole.uid}`), { role: newRole });
            setRoleModalVisible(false);
            setSelectedUserForRole(null);
        } catch (error: any) {
            showAlert("Error", error.message);
        }
    };

    const renderUserItem = ({ item }: { item: User }) => {
        const isSelf = item.uid === currentUser?.uid;
        const isExpanded = expandedUserId === item.uid;
        
        const canModify = (currentUserRole === 'superadmin' && !isSelf) || 
                          (currentUserRole === 'admin' && item.role === 'staff' && !isSelf);

        const canViewHistory = currentUserRole === 'superadmin' || (currentUserRole === 'admin' && item.role === 'staff');

        const loginHistoryList = item.loginHistory ? Object.values(item.loginHistory).sort((a, b) => b.timestamp - a.timestamp) : [];

        // Role Color Mapping
        const getRoleColor = (role: string) => {
            switch(role) {
                case 'superadmin': return '#f43f5e';
                case 'admin': return '#fbbf24';
                case 'kitchen': return '#22c55e'; // Green for Kitchen
                case 'customer': return '#a78bfa'; // Purple for Customer
                default: return '#94a3b8'; // Gray for Staff
            }
        };

        return (
            <View style={[styles.userItem, item.disabled && styles.disabledUserItem]}>
                <Pressable 
                    style={styles.itemHeader} 
                    onPress={() => canViewHistory && toggleExpand(item.uid)}
                    disabled={!canViewHistory}
                >
                    <View style={styles.userInfoContainer}>
                        <View style={styles.avatarContainer}>
                             <Ionicons name="person-circle" size={48} color={item.disabled ? "#64748b" : "#38bdf8"} />
                             {item.disabled && (
                                <View style={styles.disabledBadge}>
                                    <Ionicons name="ban" size={12} color="white" />
                                </View>
                             )}
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={[styles.userName, item.disabled && styles.disabledText]}>
                                {item.username} {isSelf && "(You)"}
                            </Text>
                            <Text style={[styles.userEmail, item.disabled && styles.disabledText]}>{item.email}</Text>
                            <View style={styles.roleBadge}>
                                <Text style={[styles.userRole, { color: getRoleColor(item.role) }]}>
                                    {item.role.toUpperCase()}
                                </Text>
                            </View>
                        </View>
                    </View>
                    
                    {canViewHistory && (
                        <Ionicons 
                            name={isExpanded ? "chevron-up" : "chevron-down"} 
                            size={20} 
                            color="#64748b" 
                            style={{ marginLeft: 10 }}
                        />
                    )}
                </Pressable>
                
                {canModify && (
                    <View style={styles.actionRow}>
                        <Pressable onPress={() => openRoleModal(item)} style={styles.actionBtn}>
                            <Ionicons name="create-outline" size={18} color="#fbbf24" />
                            <Text style={[styles.actionText, { color: '#fbbf24' }]}>Role</Text>
                        </Pressable>
                        
                        {currentUserRole === 'superadmin' && (
                            <Pressable onPress={() => openEditUserModal(item)} style={styles.actionBtn}>
                                <Ionicons name="pencil-outline" size={18} color="#38bdf8" />
                                <Text style={[styles.actionText, { color: '#38bdf8' }]}>Edit</Text>
                            </Pressable>
                        )}

                        <Pressable onPress={() => initiateResetPassword(item)} style={styles.actionBtn}>
                            <Ionicons name="key-outline" size={18} color="#38bdf8" />
                            <Text style={[styles.actionText, { color: '#38bdf8' }]}>Reset</Text>
                        </Pressable>
                        
                        <Pressable onPress={() => initiateToggleDisableUser(item)} style={styles.actionBtn}>
                            <Ionicons 
                                name={item.disabled ? "checkmark-circle-outline" : "ban-outline"} 
                                size={18} 
                                color={item.disabled ? "#22c55e" : "#ef4444"} 
                            />
                            <Text style={[styles.actionText, { color: item.disabled ? "#22c55e" : "#ef4444" }]}>
                                {item.disabled ? 'Enable' : 'Disable'}
                            </Text>
                        </Pressable>
                    </View>
                )}

                {isExpanded && canViewHistory && (
                    <View style={styles.historyContainer}>
                        <View style={styles.separator} />
                        <Text style={styles.historyTitle}>Login Activity</Text>
                        {loginHistoryList.length > 0 ? (
                            loginHistoryList.slice(0, 5).map((log, index) => (
                                <View key={index} style={styles.historyRow}>
                                    <View style={{flex: 1}}>
                                        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 2}}>
                                            <Ionicons name={log.platform === 'web' ? 'globe-outline' : 'phone-portrait-outline'} size={14} color="#64748b" style={{marginRight: 6}} />
                                            <Text style={styles.historyDevice} numberOfLines={1}>{log.device || 'Unknown Device'}</Text>
                                        </View>
                                        <Text style={styles.historyIp}>IP: {log.ip || 'N/A'}</Text>
                                    </View>
                                    <Text style={styles.historyDate}>
                                        {new Date(log.timestamp).toLocaleString(undefined, {
                                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </Text>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.noHistoryText}>No recent login activity recorded.</Text>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
             <WebScrollbarStyles />
             <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
                <View style={styles.header}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Ionicons name="people" size={28} color="#38bdf8" style={{marginRight: 12}} />
                        <Text style={styles.title}>Manage Users</Text>
                    </View>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="close" size={24} color="#94a3b8" />
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
                <Modal animationType="fade" transparent={true} visible={roleModalVisible} onRequestClose={() => setRoleModalVisible(false)}>
                    <Pressable style={styles.modalOverlay} onPress={() => setRoleModalVisible(false)}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Assign Role</Text>
                            <Text style={styles.modalSubtitle}>For {selectedUserForRole?.username}</Text>
                            
                            {/* Standard Roles */}
                            <Pressable style={styles.modalOption} onPress={() => handleChangeRole('staff')}>
                                <Ionicons name="id-card-outline" size={20} color="#94a3b8" style={{marginRight: 10}} />
                                <Text style={styles.modalOptionText}>Staff</Text>
                            </Pressable>
                            
                            <Pressable style={styles.modalOption} onPress={() => handleChangeRole('kitchen')}>
                                <Ionicons name="restaurant-outline" size={20} color="#22c55e" style={{marginRight: 10}} />
                                <Text style={styles.modalOptionText}>Kitchen</Text>
                            </Pressable>

                            <Pressable style={styles.modalOption} onPress={() => handleChangeRole('customer')}>
                                <Ionicons name="people-outline" size={20} color="#a78bfa" style={{marginRight: 10}} />
                                <Text style={styles.modalOptionText}>Customer</Text>
                            </Pressable>
                            
                            {currentUserRole === 'superadmin' && (
                                <>
                                    <View style={{height: 1, backgroundColor: '#334155', marginVertical: 8}} />
                                    <Pressable style={styles.modalOption} onPress={() => handleChangeRole('admin')}>
                                        <Ionicons name="shield-outline" size={20} color="#fbbf24" style={{marginRight: 10}} />
                                        <Text style={styles.modalOptionText}>Admin</Text>
                                    </Pressable>
                                    <Pressable style={styles.modalOption} onPress={() => handleChangeRole('superadmin')}>
                                        <Ionicons name="shield-checkmark-outline" size={20} color="#f43f5e" style={{marginRight: 10}} />
                                        <Text style={styles.modalOptionText}>Superadmin</Text>
                                    </Pressable>
                                </>
                            )}
                            
                            <Pressable style={[styles.modalOption, styles.cancelOption]} onPress={() => setRoleModalVisible(false)}>
                                <Text style={[styles.modalOptionText, { color: '#ef4444' }]}>Cancel</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Modal>

                {/* Edit User Modal */}
                <Modal animationType="fade" transparent={true} visible={editUserModalVisible} onRequestClose={() => setEditUserModalVisible(false)}>
                    <Pressable style={styles.modalOverlay} onPress={() => !isUpdatingUser && setEditUserModalVisible(false)}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Edit Profile</Text>
                            <Text style={styles.modalSubtitle}>Update details for {editUser?.username}</Text>
                            
                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>New Username</Text>
                                <TextInput 
                                    style={styles.input}
                                    value={newUsername}
                                    onChangeText={setNewUsername}
                                    placeholder="Enter username"
                                    placeholderTextColor="#64748b"
                                    autoCapitalize="none"
                                />
                            </View>
                            
                            <Pressable 
                                style={[styles.saveBtn, isUpdatingUser && { opacity: 0.7 }]} 
                                onPress={handleUpdateUsername}
                                disabled={isUpdatingUser}
                            >
                                {isUpdatingUser ? (
                                    <ActivityIndicator color="#0f172a" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Save Changes</Text>
                                )}
                            </Pressable>
                            
                            {!isUpdatingUser && (
                                <Pressable style={[styles.modalOption, styles.cancelOption]} onPress={() => setEditUserModalVisible(false)}>
                                    <Text style={[styles.modalOptionText, { color: '#ef4444' }]}>Cancel</Text>
                                </Pressable>
                            )}
                        </View>
                    </Pressable>
                </Modal>
    
                {/* Confirmation Modal */}
                <Modal animationType="fade" transparent={true} visible={confirmModalVisible} onRequestClose={() => setConfirmModalVisible(false)}>
                    <Pressable style={styles.modalOverlay} onPress={() => setConfirmModalVisible(false)}>
                        <View style={styles.confirmContent}>
                            <View style={[styles.iconCircle, { backgroundColor: confirmMessage.confirmColor + '20' }]}>
                                <Ionicons 
                                    name="alert" 
                                    size={32} 
                                    color={confirmMessage.confirmColor} 
                                />
                            </View>
                            <Text style={styles.confirmTitle}>{confirmMessage.title}</Text>
                            <Text style={styles.confirmBody}>{confirmMessage.body}</Text>
                            
                            <View style={styles.confirmBtnRow}>
                                <Pressable style={styles.cancelBtn} onPress={() => setConfirmModalVisible(false)}>
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </Pressable>
                                <Pressable 
                                    style={[styles.confirmBtn, { backgroundColor: confirmMessage.confirmColor }]} 
                                    onPress={performConfirmedAction}
                                >
                                    <Text style={[styles.confirmBtnText, { color: '#0f172a' }]}>{confirmMessage.confirmText}</Text>
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
    
    // Header
    header: { 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
        paddingHorizontal: 24, paddingVertical: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
        zIndex: 10,
    },
    title: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
    backButton: { padding: 8, borderRadius: 20, backgroundColor: '#1e293b' },
    
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
    listContent: { padding: 24, paddingBottom: 100 },

    // User Card
    userItem: { 
        backgroundColor: '#1e293b', borderRadius: 20, marginBottom: 16, 
        borderWidth: 1, borderColor: '#334155', overflow: 'hidden',
        ...Platform.select({
            web: { boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
            default: { elevation: 3 }
        }),
    },
    disabledUserItem: { opacity: 0.7, borderColor: '#475569' },
    
    itemHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, justifyContent: 'space-between' },
    userInfoContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatarContainer: { position: 'relative', marginRight: 16 },
    disabledBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#ef4444', borderRadius: 10, width: 16, height: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1e293b' },
    
    userInfo: { flex: 1 },
    userName: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginBottom: 2 },
    disabledText: { color: '#94a3b8' },
    userEmail: { fontSize: 13, color: '#94a3b8', marginBottom: 6 },
    
    roleBadge: { alignSelf: 'flex-start', backgroundColor: '#0f172a', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
    userRole: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    
    // Actions Row
    actionRow: { 
        flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#334155', 
        backgroundColor: 'rgba(15, 23, 42, 0.3)' 
    },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
    actionText: { fontSize: 13, fontWeight: '600' },

    // History Section
    historyContainer: { backgroundColor: '#0f172a', padding: 16, borderTopWidth: 1, borderTopColor: '#334155' },
    historyTitle: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    historyDevice: { color: '#cbd5e1', fontSize: 13, fontWeight: '600', maxWidth: 180 },
    historyIp: { color: '#38bdf8', fontSize: 11, marginTop: 2 },
    historyDate: { color: '#94a3b8', fontSize: 11, textAlign: 'right' },
    noHistoryText: { color: '#64748b', fontSize: 13, fontStyle: 'italic' },
    separator: { height: 1, backgroundColor: '#334155', marginBottom: 16 },

    emptyText: { color: '#94a3b8', fontSize: 16 },
    
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    
    // Role Modal
    modalContent: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#334155' },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#f8fafc', textAlign: 'center', marginBottom: 4 },
    modalSubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 24 },
    modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
    modalOptionText: { color: '#f1f5f9', fontSize: 16, fontWeight: '600' },
    cancelOption: { borderBottomWidth: 0, justifyContent: 'center', marginTop: 8 },

    // Edit Modal specific
    inputWrapper: { marginBottom: 20 },
    inputLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
    input: { backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#334155', color: '#f8fafc', padding: 12, fontSize: 16 },
    saveBtn: { backgroundColor: '#38bdf8', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
    saveBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 16 },

    // Confirm Modal
    confirmContent: { backgroundColor: '#1e293b', borderRadius: 24, padding: 32, width: '100%', maxWidth: 380, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
    iconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    confirmTitle: { fontSize: 22, fontWeight: '800', color: '#f8fafc', marginBottom: 12, textAlign: 'center' },
    confirmBody: { fontSize: 15, color: '#cbd5e1', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
    confirmBtnRow: { flexDirection: 'row', gap: 16, width: '100%' },
    cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#334155', alignItems: 'center' },
    cancelBtnText: { color: '#f8fafc', fontWeight: '700', fontSize: 16 },
    confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
    confirmBtnText: { fontWeight: '800', fontSize: 16 },
});