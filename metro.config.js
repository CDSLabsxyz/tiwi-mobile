const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// ADDING 'jslib' to assetExts. 
// This is the "Bypass" extension. Metro will serve .jslib files as 
// raw assets, but the WebView browser will execute them as JavaScript.
config.resolver.assetExts.push('html', 'css', 'jslib', 'json');

const path = require('path');

config.resolver.unstable_enablePackageExports = true;
config.resolver.sourceExts.push('mjs');

config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'react-native-gesture-handler': path.resolve(__dirname, 'node_modules/react-native-gesture-handler'),
};

module.exports = config;
