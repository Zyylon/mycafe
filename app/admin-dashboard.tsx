import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View, Modal, TextInput, Image, LayoutAnimation, Platform, UIManager } from 'react-native';
import { auth, database } from '../lib/firebaseConfig';
import { ref, onValue, remove, update } from 'firebase/database';
import { signOut } from 'firebase/auth';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

interface StaffUser {
  id: string;
  username: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
}

interface OrderItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

interface Order {
    id: string;
    date: number;
    orderNumber?: string;
    items: OrderItem[];
    total: number;
    customerName?: string;
    customerPhone?: string;
    paymentMethod?: 'Cash' | 'Card';
    orderType?: 'Dine-in' | 'Take Away' | 'Delivery';
    address?: string;
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'users' | 'menu' | 'history'>('users');
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const staffUsersRef = ref(database, 'staff_users');
    const menuItemsRef = ref(database, 'menu_items');
    const ordersRef = ref(database, 'orders');

    const unsubscribeUsers = onValue(staffUsersRef, (snapshot) => {
      const usersList = snapshot.exists() ? Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })) : [];
      setStaffUsers(usersList);
      if (activeTab === 'users') setLoading(false);
    });

    const unsubscribeMenu = onValue(menuItemsRef, (snapshot) => {
      const menuList = snapshot.exists() ? Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })) : [];
      setMenuItems(menuList);
      if (activeTab === 'menu') setLoading(false);
    });
    
    const unsubscribeOrders = onValue(ordersRef, (snapshot) => {
        const ordersList = snapshot.exists() ? Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })).sort((a, b) => b.date - a.date) : [];
        setOrders(ordersList);
        if (activeTab === 'history') setLoading(false);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeMenu();
      unsubscribeOrders();
    };
  }, [activeTab]);

  const handleDeleteUser = useCallback((userId: string, username: string) => {
    Alert.alert('Confirm Deletion', `Delete user "${username || 'user'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(ref(database, `staff_users/${userId}`)) },
    ]);
  }, []);

  const openPasswordModal = (user: StaffUser) => {
    setSelectedUser(user);
    setPasswordModalVisible(true);
  };
  
  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword) {
      Alert.alert('Error', 'Please enter a new password.');
      return;
    }
    try {
      await update(ref(database, `staff_users/${selectedUser.id}`), { password: newPassword });
      Alert.alert('Success', `Password for ${selectedUser.username} updated.`);
      setNewPassword('');
      setPasswordModalVisible(false);
    } catch {
      Alert.alert('Error', 'Failed to update password.');
    }
  };

  const handleDeleteMenuItem = useCallback((itemId: string, name: string) => {
    Alert.alert(
      'Confirm Deletion',
      `Are you sure you want to delete "${name}" from the menu?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            remove(ref(database, `menu_items/${itemId}`))
              .then(() => {
                Alert.alert('Success', `"${name}" has been deleted.`);
              })
              .catch((error) => {
                console.error("Delete failed: ", error);
                Alert.alert('Error', 'Could not delete the item. Please check permissions or try again.');
              });
          },
        },
      ]
    );
  }, []);
  
  const toggleExpandOrder = (orderId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  }

  const handleLogout = () => {
    signOut(auth).then(() => router.replace('/'));
  };

  const renderUserItem = ({ item }: { item: StaffUser }) => (
    <View style={styles.listItem}>
      <Text style={styles.listItemText}>{item.username || '(No Username)'}</Text>
      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.editButton} onPress={() => openPasswordModal(item)}><Text style={styles.buttonText}>Password</Text></TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteUser(item.id, item.username)}><Text style={styles.buttonText}>Delete</Text></TouchableOpacity>
      </View>
    </View>
  );

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <View style={styles.listItem}>
        <Image source={{ uri: item.imageUrl || 'https://via.placeholder.com/80' }} style={styles.itemImage} />
        <View style={styles.itemDetails}>
            <Text style={styles.listItemText}>{item.name}</Text>
            <Text style={styles.listItemSubtitle}>PKR {item.price.toFixed(2)}</Text>
        </View>
        <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.editButton} onPress={() => router.push({ pathname: '/edit-menu-item', params: { id: item.id } })}><Text style={styles.buttonText}>Edit</Text></TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteMenuItem(item.id, item.name)}><Text style={styles.buttonText}>Delete</Text></TouchableOpacity>
        </View>
    </View>
  );
  
  const renderHistoryItem = ({ item, index }: { item: Order; index: number }) => (
    <TouchableOpacity onPress={() => toggleExpandOrder(item.id)} activeOpacity={0.8}>
        <View style={styles.listItem}>
            <View style={styles.itemDetails}>
                <Text style={styles.listItemText}>Order #{item.orderNumber || orders.length - index}</Text>
                <Text style={styles.listItemSubtitle}>{new Date(item.date).toLocaleString()}</Text>
            </View>
            <Text style={styles.totalText}>PKR {item.total.toFixed(2)}</Text>
        </View>
        {expandedOrderId === item.id && (
            <View style={styles.expandedContent}>
                <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Items Ordered</Text>
                    {item.items.map(orderItem => (
                        <View key={orderItem.id} style={styles.detailItem}>
                            <Text style={styles.detailText}>{orderItem.name} (x{orderItem.quantity})</Text>
                            <Text style={styles.detailText}>PKR {(orderItem.price * orderItem.quantity).toFixed(2)}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Customer Details</Text>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Name</Text>
                      <Text style={styles.detailText}>{item.customerName || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Phone</Text>
                      <Text style={styles.detailText}>{item.customerPhone || 'N/A'}</Text>
                    </View>
                    {item.orderType === 'Delivery' && item.address && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Address</Text>
                          <Text style={[styles.detailText, styles.addressText]}>{item.address}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Order Info</Text>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Type</Text>
                      <Text style={styles.detailText}>{item.orderType || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Payment</Text>
                      <Text style={styles.detailText}>{item.paymentMethod || 'N/A'}</Text>
                    </View>
                </View>

                 <View style={styles.detailTotal}>
                    <Text style={styles.detailTotalText}>Total</Text>
                    <Text style={styles.detailTotalText}>PKR {item.total.toFixed(2)}</Text>
                </View>
            </View>
        )}
    </TouchableOpacity>
  );
  
  if (loading) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color="#38bdf8" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <TouchableOpacity onPress={handleLogout}><Text style={styles.logoutText}>Logout</Text></TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'users' && styles.activeTab]} onPress={() => setActiveTab('users')}><Text style={styles.tabText}>Users ({staffUsers.length})</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'menu' && styles.activeTab]} onPress={() => setActiveTab('menu')}><Text style={styles.tabText}>Menu ({menuItems.length})</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'history' && styles.activeTab]} onPress={() => setActiveTab('history')}><Text style={styles.tabText}>History ({orders.length})</Text></TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        {activeTab === 'users' && (
          <><FlatList data={staffUsers} renderItem={renderUserItem} keyExtractor={item => item.id} ListEmptyComponent={<Text style={styles.emptyText}>No staff users found.</Text>} /><TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/create-user')}><Text style={styles.primaryButtonText}>Add New Staff User</Text></TouchableOpacity></>
        )}
        {activeTab === 'menu' && (
            <><FlatList data={menuItems} renderItem={renderMenuItem} keyExtractor={item => item.id} ListEmptyComponent={<Text style={styles.emptyText}>No menu items found.</Text>} /><TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/add-menu-item')}><Text style={styles.primaryButtonText}>Add New Menu Item</Text></TouchableOpacity></>
        )}
        {activeTab === 'history' && (
            <FlatList data={orders} renderItem={renderHistoryItem} keyExtractor={item => item.id} ListEmptyComponent={<Text style={styles.emptyText}>No order history found.</Text>} />
        )}
      </View>

      <Modal visible={passwordModalVisible} transparent={true} animationType="fade" onRequestClose={() => setPasswordModalVisible(false)}>
        <View style={styles.modalContainer}><View style={styles.modalContent}><Text style={styles.modalTitle}>Change Password for {selectedUser?.username}</Text><TextInput style={styles.input} placeholder="New Password" secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholderTextColor="#64748b" /><View style={styles.modalButtonContainer}><TouchableOpacity style={styles.cancelButton} onPress={() => setPasswordModalVisible(false)}><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={styles.confirmButton} onPress={handleChangePassword}><Text style={styles.buttonText}>Update</Text></TouchableOpacity></View></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', paddingTop: 50 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  title: { color: '#f8fafc', fontSize: 28, fontWeight: 'bold' },
  logoutText: { color: '#38bdf8', fontSize: 16 },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20 },
  tab: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, backgroundColor: '#1e293b' , marginRight: 10},
  activeTab: { backgroundColor: '#38bdf8' },
  tabText: { color: '#f8fafc', fontWeight: 'bold' },
  content: { flex: 1, paddingHorizontal: 20 },
  listItem: { backgroundColor: '#1e293b', padding: 15, borderRadius: 12, marginBottom: 10, },
  listItemText: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
  listItemSubtitle: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  buttonGroup: { flexDirection: 'row', position: 'absolute', right: 15, top: 15 },
  editButton: { backgroundColor: '#fbbf24', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginRight: 8 },
  deleteButton: { backgroundColor: '#ef4444', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  buttonText: { color: '#0f172a', fontWeight: 'bold' },
  emptyText: { color: '#94a3b8', textAlign: 'center', marginTop: 50 },
  primaryButton: { backgroundColor: '#38bdf8', padding: 16, borderRadius: 12, alignItems: 'center', marginVertical: 10 },
  primaryButtonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { width: '90%', backgroundColor: '#1e293b', borderRadius: 20, padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#f8fafc', marginBottom: 20, textAlign: 'center' },
  input: { width: '100%', backgroundColor: '#0f172a', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  cancelButton: { backgroundColor: '#475569', padding: 15, borderRadius: 12, flex: 1, marginRight: 10, alignItems: 'center' },
  confirmButton: { backgroundColor: '#38bdf8', padding: 15, borderRadius: 12, flex: 1, marginLeft: 10, alignItems: 'center' },
  itemImage: { width: 50, height: 50, borderRadius: 8, marginRight: 15 },
  itemDetails: { flex: 1 },
  totalText: { color: '#4ade80', fontSize: 16, fontWeight: 'bold', position: 'absolute', right: 15, top: '50%' },
  expandedContent: { backgroundColor: '#16202f', padding: 15, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, marginTop: -10, paddingTop: 20 },
  detailSection: { marginBottom: 15, borderTopWidth: 1, borderColor: '#334155', paddingTop: 15 },
  detailSectionTitle: { color: '#94a3b8', fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
  detailItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 10 },
  detailLabel: { color: '#cbd5e1', fontSize: 14, fontWeight: '500' },
  detailText: { color: '#cbd5e1', fontSize: 14, flexShrink: 1 },
  addressText: { textAlign: 'right' },
  detailTotal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: '#334155' },
  detailTotalText: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
});
