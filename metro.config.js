const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// ADDING 'jslib' to assetExts. 
// This is the "Bypass" extension. Metro will serve .jslib files as 
// raw assets, but the WebView browser will execute them as JavaScript.
config.resolver.assetExts.push('html', 'css', 'jslib', 'json');

module.exports = config;
