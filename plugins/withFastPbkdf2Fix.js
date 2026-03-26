const { withGradleProperties } = require('@expo/config-plugins');

/**
 * Config plugin to fix react-native-fast-pbkdf2 build errors
 * by forcing it to use a modern compileSdkVersion.
 */
const withFastPbkdf2Fix = (config) => {
  return withGradleProperties(config, (config) => {
    config.modResults.push({
      type: 'property',
      key: 'Pbkdf2_compileSdkVersion',
      value: '36',
    });
    config.modResults.push({
      type: 'property',
      key: 'Pbkdf2_targetSdkVersion',
      value: '36',
    });
    config.modResults.push({
      type: 'property',
      key: 'Pbkdf2_buildToolsVersion',
      value: '36.0.0',
    });
    return config;
  });
};

module.exports = withFastPbkdf2Fix;
