import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { semanticColors } from '../design/tokens';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: semanticColors.background },
        }}
      />
    </>
  );
}
