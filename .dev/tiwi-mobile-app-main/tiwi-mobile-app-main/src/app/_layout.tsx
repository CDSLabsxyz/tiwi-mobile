import "../global.css";
import { Slot } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { useManropeFonts } from "@/utils/fonts";
import { colors } from "@/theme";
import * as SplashScreen from "expo-splash-screen";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const { fontsLoaded, fontError } = useManropeFonts();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View className="flex flex-1" style={{ backgroundColor: colors.bg }}>
      <Slot />
    </View>
  );
}
