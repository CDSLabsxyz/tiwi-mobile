/**
 * React Native Polyfills for WalletConnect / Web3
 * Must be imported at the very top of the entry file (e.g., app/_layout.tsx)
 */

import '@walletconnect/react-native-compat';
import 'fast-text-encoding';
import 'react-native-get-random-values';

// Shim window and environment for libraries like 'mipd' and 'wagmi' that assume a Web environment
if (typeof window === 'undefined') {
  // @ts-ignore
  global.window = global;
}

// @ts-ignore
const win = global.window;

// 1. Event Listeners
if (!win.addEventListener) {
  // @ts-ignore
  win.addEventListener = () => {};
}
if (!win.removeEventListener) {
  // @ts-ignore
  win.removeEventListener = () => {};
}
if (!win.dispatchEvent) {
  // @ts-ignore
  win.dispatchEvent = () => true;
}

// 2. CustomEvent (Fix for 'mipd' ReferenceError)
if (typeof win.CustomEvent === 'undefined' || typeof global.CustomEvent === 'undefined') {
  class CustomEvent {
    constructor(event: any, params: any = {}) {
      // @ts-ignore
      this.type = event;
      // @ts-ignore
      this.detail = params.detail || {};
    }
  }
  // @ts-ignore
  win.CustomEvent = CustomEvent;
  // @ts-ignore
  global.CustomEvent = CustomEvent;
}

// 3. Additional shims for text encoding
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('text-encoding');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
