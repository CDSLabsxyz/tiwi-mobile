const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// ADDING 'jslib' to assetExts. 
config.resolver.assetExts.push('html', 'css', 'jslib', 'json');

config.resolver.unstable_enablePackageExports = true;
config.resolver.sourceExts.push('mjs', 'cjs');

// Node.js polyfills for Metro
config.resolver.extraNodeModules = {
    'stream': require.resolve('stream-browserify'),
    'buffer': require.resolve('buffer'),
    'crypto': require.resolve('react-native-crypto'),
    'http': require.resolve('stream-http'),
    'https': require.resolve('https-browserify'),
    'os': require.resolve('os-browserify/browser.js'),
    'path': require.resolve('path-browserify'),
    'process': require.resolve('process/browser.js'),
    'vm': require.resolve('vm-browserify'),
    'zlib': require.resolve('browserify-zlib'),
    'react-native-gesture-handler': path.resolve(__dirname, 'node_modules/react-native-gesture-handler'),
};

module.exports = config;
