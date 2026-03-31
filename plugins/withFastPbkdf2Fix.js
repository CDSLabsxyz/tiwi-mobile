const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to fix react-native-fast-pbkdf2 build errors.
 * Patches the library's build.gradle to use a compileSdk string format
 * compatible with modern AGP versions.
 */
const withFastPbkdf2Fix = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const buildGradlePath = path.join(
        config.modRequest.projectRoot,
        'node_modules',
        'react-native-fast-pbkdf2',
        'android',
        'build.gradle'
      );

      if (fs.existsSync(buildGradlePath)) {
        let contents = fs.readFileSync(buildGradlePath, 'utf8');

        // Replace compileSdkVersion with a safe integer fallback
        // that the root project's ext will override
        contents = contents.replace(
          /compileSdkVersion safeExtGet\('Pbkdf2_compileSdkVersion', \d+\)/,
          "compileSdkVersion safeExtGet('compileSdkVersion', 31)"
        );
        contents = contents.replace(
          /buildToolsVersion safeExtGet\('Pbkdf2_buildToolsVersion', '[^']*'\)/,
          "buildToolsVersion safeExtGet('buildToolsVersion', '31.0.0')"
        );
        contents = contents.replace(
          /targetSdkVersion safeExtGet\('Pbkdf2_targetSdkVersion', \d+\)/,
          "targetSdkVersion safeExtGet('targetSdkVersion', 31)"
        );
        contents = contents.replace(
          /minSdkVersion safeExtGet\('Pbkdf2_minSdkVersion', \d+\)/,
          "minSdkVersion safeExtGet('minSdkVersion', 24)"
        );

        fs.writeFileSync(buildGradlePath, contents);
      }

      return config;
    },
  ]);
};

module.exports = withFastPbkdf2Fix;
