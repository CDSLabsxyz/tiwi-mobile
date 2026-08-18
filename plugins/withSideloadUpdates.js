const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

const PERMISSION = 'android.permission.REQUEST_INSTALL_PACKAGES';

/**
 * Adds REQUEST_INSTALL_PACKAGES only to SIDELOAD builds.
 *
 * The permission lets services/updateService.ts hand a downloaded APK to the
 * Android installer, which is how the directly-distributed build updates
 * itself. Google Play forbids that: an app distributed on Play may not install
 * packages unless doing so is its core purpose (browser, file manager,
 * enterprise device manager), which a wallet is not. Shipping the permission
 * in the Play build fails the REQUEST_INSTALL_PACKAGES declaration outright.
 *
 * So the manifest is built from the EXPO_PUBLIC_SIDELOAD_UPDATES flag rather
 * than hardcoded: the `production` (APK) profile sets it, `playstore` clears
 * it. Keep this in step with the runtime guard in updateService.ts, or the
 * Play build ships an Update button that calls an intent it cannot satisfy.
 */
const withSideloadUpdates = (config) => {
  const sideload = process.env.EXPO_PUBLIC_SIDELOAD_UPDATES === 'true';

  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    manifest['uses-permission'] = manifest['uses-permission'] ?? [];

    const existing = manifest['uses-permission'].findIndex(
      (p) => p.$?.['android:name'] === PERMISSION
    );

    if (sideload) {
      if (existing === -1) {
        manifest['uses-permission'].push({ $: { 'android:name': PERMISSION } });
      }
      console.log('[withSideloadUpdates] sideload build: kept ' + PERMISSION);
    } else if (existing !== -1) {
      manifest['uses-permission'].splice(existing, 1);
      console.log('[withSideloadUpdates] Play build: removed ' + PERMISSION);
    } else {
      console.log('[withSideloadUpdates] Play build: ' + PERMISSION + ' absent');
    }

    return config;
  });
};

module.exports = withSideloadUpdates;
