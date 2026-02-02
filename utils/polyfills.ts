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
const win = global.window || global;

// 1. Event Listeners
if (!win.addEventListener) {
  // @ts-ignore
  win.addEventListener = () => { };
}
if (!win.removeEventListener) {
  // @ts-ignore
  win.removeEventListener = () => { };
}
if (!win.dispatchEvent) {
  // @ts-ignore
  win.dispatchEvent = () => true;
}

// 2. CustomEvent (Fix for 'mipd' ReferenceError)
if (typeof win.CustomEvent === 'undefined' || typeof global.CustomEvent === 'undefined') {
  class CustomEvent {
    type: string;
    detail: any;
    constructor(event: string, params: any = {}) {
      this.type = event;
      this.detail = params.detail || {};
    }
  }
  // @ts-ignore
  win.CustomEvent = CustomEvent;
  // @ts-ignore
  global.CustomEvent = CustomEvent;
}

// 3. Event (Fix for '@wallet-standard/app' ReferenceError within @lifi/sdk)
if (typeof global.Event === 'undefined' || typeof win.Event === 'undefined') {
  class Event {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  }
  // @ts-ignore
  global.Event = Event;
  // @ts-ignore
  win.Event = Event;
}

// 4. EventTarget (Wagmi / LiFi necessity)
if (typeof global.EventTarget === 'undefined' || typeof win.EventTarget === 'undefined') {
  class EventTarget {
    addEventListener() { }
    removeEventListener() { }
    dispatchEvent() { return true; }
  }
  // @ts-ignore
  global.EventTarget = EventTarget;
  // @ts-ignore
  win.EventTarget = EventTarget;
}

// 5. Additional shims for text encoding
if (typeof TextEncoder === 'undefined') {
  try {
    const { TextEncoder, TextDecoder } = require('text-encoding');
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
  } catch (e) {
    // If text-encoding is not available, we assume fast-text-encoding handled it via import
  }
}
