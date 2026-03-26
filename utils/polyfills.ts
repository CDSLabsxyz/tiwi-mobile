/**
 * React Native Polyfills for WalletConnect / Web3
 * Must be imported at the very top of the entry file (e.g., app/_layout.tsx)
 */

import { Buffer } from 'buffer';
import process from 'process';

// 0. Manual Node.js Globals (avoiding node-libs-react-native/globals for now due to 'location' error)
global.Buffer = Buffer;
global.process = process;

// Safe location shim
if (typeof global.location === 'undefined') {
    (global as any).location = { protocol: 'file:' };
}

// 0.1 Uint8Array.prototype.copy polyfill (Required for TON SDK)
// Many SDKs expect .copy() on subarray() results which might return plain Uint8Array
if (!(Uint8Array.prototype as any).copy) {
    (Uint8Array.prototype as any).copy = function (
        target: Uint8Array,
        targetStart?: number,
        start?: number,
        end?: number
    ) {
        const actualTargetStart = targetStart || 0;
        const actualStart = start || 0;
        const actualEnd = end !== undefined ? end : this.length;
        if (actualTargetStart >= target.length || actualStart >= this.length) return 0;
        const len = Math.min(actualEnd - actualStart, target.length - actualTargetStart);
        target.set(this.subarray(actualStart, actualStart + len), actualTargetStart);
        return len;
    };
}

import '@walletconnect/react-native-compat';
import 'fast-text-encoding';
import 'react-native-get-random-values';
import 'react-native-gesture-handler';

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
        // Fallback or assumed handled by fast-text-encoding
    }
}
