const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Ensure .ttf and .otf fonts are supported (they should be by default, but being explicit)
if (!config.resolver.assetExts.includes('ttf')) {
  config.resolver.assetExts.push('ttf');
}
if (!config.resolver.assetExts.includes('otf')) {
  config.resolver.assetExts.push('otf');
}

// Add SVG as an asset extension (for expo-image compatibility)
if (!config.resolver.assetExts.includes('svg')) {
  config.resolver.assetExts.push('svg');
}

// Ensure CSS files are processed by NativeWind's PostCSS transformer
// Remove CSS from asset extensions if it's there
if (config.resolver.assetExts.includes('css')) {
  config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'css');
}
// Ensure CSS is in source extensions so it gets transformed by NativeWind
if (!config.resolver.sourceExts.includes('css')) {
  config.resolver.sourceExts.push('css');
}

// Get the config with NativeWind
const finalConfig = withNativewind(config, {
  inlineVariables: false,
});

// Intercept CSS files to prevent react-native-css from processing them
// react-native-css doesn't support Tailwind v4 syntax, so we need NativeWind to handle CSS
const originalTransform = finalConfig.transformer?.transform;
if (originalTransform) {
  finalConfig.transformer.transform = async (params) => {
    const { filename } = params;
    
    // For CSS files, especially global.css with Tailwind v4 syntax,
    // we need to ensure NativeWind processes them, not react-native-css
    if (filename.endsWith('.css')) {
      // Check if this is being processed by react-native-css
      // If so, we need to bypass it and use NativeWind's transformer
      try {
        // NativeWind's transformer should be available via withNativewind
        // But if react-native-css is intercepting, we need to handle it differently
        // The issue is that react-native-css's transformer runs and fails on layer() syntax
        
        // Try to get NativeWind's transformer and use it directly
        // This bypasses any react-native-css transformer that might be in the chain
        const nativewind = require('nativewind/metro');
        if (nativewind && nativewind.transformer && nativewind.transformer.transform) {
          return nativewind.transformer.transform(params);
        }
      } catch (e) {
        // If NativeWind transformer isn't available directly, fall through
        console.warn('Could not use NativeWind transformer directly:', e.message);
      }
    }
    
    // For non-CSS files, use the original transformer
    return originalTransform(params);
  };
}

module.exports = finalConfig;
