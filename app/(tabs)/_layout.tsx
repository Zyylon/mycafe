import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* index.tsx will automatically be the first screen */}
      <Stack.Screen name="index" />
    </Stack>
  );
}