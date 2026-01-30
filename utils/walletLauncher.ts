import * as Linking from 'expo-linking';

/**
 * Precision Redirection Utility
 * Maps a WalletConnect URI and a wallet's native scheme to a direct launch command
 */
export const launchWallet = async (uri: string, walletScheme?: string) => {
  if (!uri) return;

  // 1. Format the WalletConnect URI for deep linking
  const encodedUri = encodeURIComponent(uri);
  
  // 2. Determine the target URL based on the wallet's scheme
  // Standard format: [scheme]://wc?uri=[uri]
  let targetUrl = '';
  
  if (walletScheme) {
    // If we have a specific scheme (e.g. metamask://)
    const cleanScheme = walletScheme.includes('://') ? walletScheme : `${walletScheme}://`;
    targetUrl = `${cleanScheme}wc?uri=${encodedUri}`;
  } else {
    // Fallback to generic walletconnect scheme if no specific wallet selected
    targetUrl = `wc:wc?uri=${encodedUri}`;
  }

  try {
    console.log('TIWI Launcher: Opening', targetUrl);
    const supported = await Linking.canOpenURL(targetUrl);
    
    if (supported) {
      await Linking.openURL(targetUrl);
    } else {
      // If the app isn't installed, we could show a fallback 
      // or redirect to universal link/store in a more advanced version
      console.warn('TIWI Launcher: Scheme not supported, trying universal fallback');
      await Linking.openURL(uri);
    }
  } catch (error) {
    console.error('TIWI Launcher Error:', error);
    // Final fallback
    await Linking.openURL(uri);
  }
};
