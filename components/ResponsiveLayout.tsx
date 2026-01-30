import { usePathname } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import MobileBottomNav from './MobileBottomNav';
import Sidebar from './Sidebar';

export default function ResponsiveLayout({ children }: { children: React.ReactNode }) {
    const { width } = useWindowDimensions();
    const pathname = usePathname();
    
    // Switch to Mobile Bottom Nav if width is less than 1024px (Small Tablets/Phones)
    // Larger Tablets, Laptops, TV Boxes get Sidebar
    const isMobile = width < 1024;

    const isPublicRoute = 
        pathname === '/' || 
        pathname === '/index' || 
        pathname.includes('/auth/login');

    if (isPublicRoute) {
        return <View style={styles.fullScreen}>{children}</View>;
    }

    return (
        <View style={styles.container}>
            {/* DESKTOP/TV: Vertical Sidebar */}
            {!isMobile && (
                <View style={styles.sidebarContainer}>
                    <Sidebar />
                </View>
            )}

            {/* CONTENT AREA */}
            <View style={styles.contentContainer}>
                {children}
            </View>

            {/* MOBILE: Floating Bottom Dock */}
            {isMobile && <MobileBottomNav />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row', 
        backgroundColor: '#0f172a', 
    },
    fullScreen: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    sidebarContainer: {
        height: '100%',
        zIndex: 50, // Ensure sidebar flyouts float above content
    },
    contentContainer: {
        flex: 1,
        height: '100%',
        paddingBottom: Platform.OS === 'ios' ? 0 : 0, 
    }
});