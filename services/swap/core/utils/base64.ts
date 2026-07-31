/**
 * Lenient base64 → bytes decode for aggregator-returned Solana transactions.
 *
 * The browser's strict `atob()` throws "The string to be decoded is not correctly encoded" on
 * URL-safe base64 (`-`/`_`), embedded whitespace/newlines, or missing padding — all of which
 * various swap APIs (Rubic, Relay, …) emit. Normalize to the standard alphabet + pad first.
 */
export function base64ToBytes(input: string): Uint8Array {
  if (typeof input !== 'string') {
    throw new Error(`base64ToBytes: expected a base64 string, got ${typeof input}`);
  }
  const clean = input.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = clean.padEnd(Math.ceil(clean.length / 4) * 4, '=');
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
