import { usePathname } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import MobileBottomNav from './MobileBottomNav';
import Sidebar from './Sidebar';

export default function ResponsiveLayout({ children }: { children: React.ReactNode }) {
    const { width } = useWindowDimensions();
    const pathname = usePathname();
    
    // 1. Breakpoint: Switch to mobile layout if width is less than 768px (iPad Portrait/Tablets)
    const isMobile = width < 768;

    // 2. Blacklist: Routes where NO navigation should be shown (Splash, Login, etc.)
    // We normalize the path to ensure it catches variations
    const isPublicRoute = 
        pathname === '/' || 
        pathname === '/index' || 
        pathname.includes('/auth/login');

    // 3. If it's a public route, just render the content (No Sidebar/No Bottom Bar)
    if (isPublicRoute) {
        return <View style={styles.fullScreen}>{children}</View>;
    }

    return (
        <View style={styles.container}>
            {/* DESKTOP: Render Sidebar on the left */}
            {!isMobile && (
                <View style={styles.sidebarContainer}>
                    <Sidebar />
                </View>
            )}

            {/* CONTENT AREA */}
            <View style={styles.contentContainer}>
                {children}
            </View>

            {/* MOBILE: Render Bottom Nav (Floating Dock) */}
            {isMobile && <MobileBottomNav />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row', // Desktop default: Sidebar | Content
        backgroundColor: '#0f172a', // Match your dark theme background
    },
    fullScreen: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    sidebarContainer: {
        height: '100%',
        zIndex: 10,
        // Sidebar component handles its own width/animation
    },
    contentContainer: {
        flex: 1,
        height: '100%',
        // On mobile, the content is behind the floating dock, 
        // usually we don't need padding because the dock floats over content,
        // but if content gets cut off at bottom, add padding here.
        paddingBottom: Platform.OS === 'ios' ? 0 : 0, 
    }
});