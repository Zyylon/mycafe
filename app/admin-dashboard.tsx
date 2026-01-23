import { useRouter } from "expo-router";
import React from "react";
import { View, Text, StyleSheet, Pressable, Alert, Platform, ScrollView } from "react-native";
import { ref, update } from 'firebase/database';
import * as Crypto from 'expo-crypto';
import { auth, database } from '../lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';

const hashUsername = async (username: string) => {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    username.toLowerCase()
  );
  return digest;
};

export default function AdminDashboard() {
  const router = useRouter();

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const runAdminMigration = async () => {
    Alert.alert(
      "Confirm Migration",
      "This will create a user profile for the current logged-in user and link the 'superadmin' username to it. This should only be done once.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Proceed",
          style: "default",
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (!user) {
                Alert.alert("Error", "You must be logged in to perform this migration.");
                return;
              }

              const usernameToMigrate = 'superadmin';
              const hashedUsername = await hashUsername(usernameToMigrate);

              const updates = {};
              updates[`users/${user.uid}`] = {
                email: user.email,
                role: 'superadmin',
                username: usernameToMigrate,
              };
              updates[`username_map/${hashedUsername}`] = user.email.toLowerCase();

              await update(ref(database), updates);

              Alert.alert(
                "Migration Complete",
                "Your superadmin account is now configured. You might need to restart the app to see all changes."
              );

            } catch (error: any) {
              console.error("Migration failed:", error);
              const errorMessage = error?.message ? String(error.message) : String(error);
              Alert.alert("Migration Failed", errorMessage);
            }
          },
        },
      ]
    );
  };

  const adminActions = [
    { title: 'Manage Users', path: '/manage-users', icon: 'people-outline' },
    { title: 'Add Menu Item', path: '/add-menu-item', icon: 'add-circle-outline' },
    { title: 'Order History', path: '/order-history', icon: 'receipt-outline' },
    { title: 'Create User', path: '/create-user', icon: 'person-add-outline' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name="close-outline" size={28} color="#94a3b8" />
          </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Select an action to continue</Text>
        <View style={styles.grid}>
          {adminActions.map((action) => (
            <Pressable key={action.path} style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]} onPress={() => handleNavigation(action.path)}>
              <Ionicons name={action.icon as any} size={32} color="#38bdf8" />
              <Text style={styles.buttonText}>{action.title}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.migrationContainer}>
          <Text style={styles.migrationTitle}>Legacy Superadmin Migration</Text>
          <Text style={styles.migrationInfo}>
            If you are the original administrator, press this button once to finalize your account setup and grant superadmin privileges.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.migrationButton, { opacity: pressed ? 0.7 : 1 }]}
            onPress={runAdminMigration}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color="#f8fafc" />
            <Text style={styles.migrationButtonText}>Run Superadmin Migration</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 20, 
        paddingTop: Platform.OS === 'ios' ? 50 : 20, 
        paddingBottom: 15, 
        backgroundColor: '#1e293b',
        borderBottomWidth: 1,
        borderBottomColor: '#334155'
    },
    title: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc' },
    backButton: { padding: 5 },
    content: { padding: 20 },
    subtitle: { fontSize: 16, color: '#94a3b8', marginBottom: 20, textAlign: 'center' },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    button: {
      backgroundColor: '#1e293b',
      width: '48%',
      padding: 20,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 15,
      borderWidth: 1,
      borderColor: '#334155',
    },
    buttonText: {
      color: '#f1f5f9',
      fontWeight: 'bold',
      fontSize: 14,
      marginTop: 10,
      textAlign: 'center',
    },
    migrationContainer: {
      marginTop: 30,
      backgroundColor: '#1e293b',
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: '#f59e0b',
    },
    migrationTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#f59e0b',
      textAlign: 'center',
      marginBottom: 10,
    },
    migrationInfo: {
      color: '#cbd5e1',
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 20,
      lineHeight: 20,
    },
    migrationButton: {
      backgroundColor: '#f59e0b',
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    migrationButtonText: {
      color: '#f8fafc',
      fontWeight: 'bold',
      fontSize: 16,
      marginLeft: 10,
    },
});
