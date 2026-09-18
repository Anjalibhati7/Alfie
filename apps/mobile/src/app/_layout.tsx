import { SessionProvider } from '../state/session';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { semanticColors } from '../design/tokens';

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: semanticColors.background },
        }}
      />
    </SessionProvider>
  );
}
