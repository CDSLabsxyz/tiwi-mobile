module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            'stream': 'stream-browserify',
            'buffer': 'buffer',
            'crypto': 'react-native-crypto',
            'http': 'stream-http',
            'https': 'https-browserify',
            'os': 'os-browserify/browser.js',
            'path': 'path-browserify',
            'process': 'process/browser.js',
            'vm': 'vm-browserify',
            'zlib': 'browserify-zlib',
          },
        },
      ],
    ],
  };
};