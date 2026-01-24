/**
 * React Native Polyfills for WalletConnect / Web3
 * Must be imported at the very top of the entry file (e.g., app/_layout.tsx)
 */

import '@walletconnect/react-native-compat';
import 'fast-text-encoding';
import 'react-native-get-random-values';

// Optional: Additional polyfills if needed for older environments
// but @walletconnect/react-native-compat handles most of it now.
