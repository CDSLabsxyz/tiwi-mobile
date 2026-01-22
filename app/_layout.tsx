import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    'Manrope-Light': require('../assets/Manrope/static/Manrope-Light.ttf'),
    'Manrope-Regular': require('../assets/Manrope/static/Manrope-Regular.ttf'),
    'Manrope-Medium': require('../assets/Manrope/static/Manrope-Medium.ttf'),
    'Manrope-SemiBold': require('../assets/Manrope/static/Manrope-SemiBold.ttf'),
    'Manrope-Bold': require('../assets/Manrope/static/Manrope-Bold.ttf'),
    'Manrope-ExtraBold': require('../assets/Manrope/static/Manrope-ExtraBold.ttf'),
    'Manrope-ExtraLight': require('../assets/Manrope/static/Manrope-ExtraLight.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
