/**
 * Byte-level base64 codecs (browser-safe, via atob/btoa).
 *
 * NOTE: `@injectivelabs/sdk-ts`'s exported `toBase64`/`fromBase64` are JSON
 * helpers (they base64 a `JSON.stringify`), NOT byte codecs — don't use those
 * for pubkeys/signatures. Use these instead.
 */

/** Encode raw bytes to a base64 string. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Decode a base64 string to raw bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
