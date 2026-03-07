import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { theme } from '@/constants/Colors';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import '@/lib/i18n';

export {
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Customize the dark theme for React Navigation
const BikeProTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: theme.colors.accent,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    notification: theme.colors.accentOrange,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <AuthProvider>
      <ThemeProvider value={BikeProTheme}>
        <AuthGuard>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(features)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="pending" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
        </AuthGuard>
      </ThemeProvider>
    </AuthProvider>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isActive, isAdmin, isLoading, isConfigured } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading || !isConfigured) return;

    const inAuthGroup = segments[0] === 'auth';
    const inPendingGroup = segments[0] === 'pending';

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/auth');
    } else if (user && !isActive && !isAdmin && !inPendingGroup) {
      // Redirect to pending if authenticated but not active
      router.replace('/pending');
    } else if (user && (isActive || isAdmin) && (inAuthGroup || inPendingGroup)) {
      // Redirect to app if authenticated and active
      router.replace('/(tabs)/profile');
    }
  }, [user, isActive, isAdmin, isLoading, isConfigured, segments]);

  return <>{children}</>;
}
