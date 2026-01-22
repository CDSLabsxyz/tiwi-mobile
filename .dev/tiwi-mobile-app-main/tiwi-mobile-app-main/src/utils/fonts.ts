import { useFonts } from 'expo-font';

// Using relative paths from src/utils to src/assets
const fontPaths = {
  'Manrope-Regular': require('../assets/Manrope/static/Manrope-Regular.ttf'),
  'Manrope-Medium': require('../assets/Manrope/static/Manrope-Medium.ttf'),
  'Manrope-SemiBold': require('../assets/Manrope/static/Manrope-SemiBold.ttf'),
  'Manrope-Bold': require('../assets/Manrope/static/Manrope-Bold.ttf'),
};

export const useManropeFonts = () => {
  const [fontsLoaded, fontError] = useFonts(fontPaths);

  return { fontsLoaded, fontError };
};
