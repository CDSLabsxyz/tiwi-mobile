/**
 * Circle CCTP V2 configuration — single source of truth for the CCTP cross-chain USDC rail.
 *
 * WHY CCTP: it moves USDC across chains by burn-and-mint (Circle attestation), so the
 * cross-chain hop needs ZERO bridge liquidity and costs ~nothing. We use it as the backbone
 * of any-token→any-token: source token → USDC (source, local swap) → CCTP → USDC (dest) →
 * dest token (local swap). Only the two LOCAL swap legs need DEX liquidity, which is findable;
 * the crossing itself never depends on a liquidity pool.
 *
 * All addresses VERIFIED on-chain 2026-07-13 (see scratchpad/cctp-reference.md):
 *  - TokenMessengerV2 / MessageTransmitterV2 are the SAME address on every supported chain here.
 *  - Each USDC is Circle-native, symbol()=='USDC', decimals()==6 (confirmed via eth_call).
 *
 * DELIBERATELY EXCLUDED: BNB Chain (56). The USDC in the app's token maps there
 * (0x8AC7…, 18-dp Binance-peg) is NOT the CCTP-burnable native USDC, and Circle-native
 * CCTP-out from BSC is unconfirmed. Adding it on the wrong token would burn funds that never
 * mint. BSC stays on the aggregator + hub-router path (its best-covered path anyway) until a
 * CCTP-native BSC USDC is verified on-chain (read TokenMinter's registered local token).
 */

/**
 * VM family of a CCTP chain — selects the source/dest adapter (see docs/cctp-non-evm-adapters.md).
 * Every chain wired today is 'evm'; the others are added as their adapters land.
 */
export type CctpVm = 'evm' | 'svm' | 'cosmos' | 'move' | 'cairo' | 'stellar';

export interface CctpChainConfig {
  chainId: number;          // canonical chainId (synthetic for non-EVM, e.g. Solana 7565164)
  domain: number;           // Circle CCTP domain id (NOT the chainId)
  vm: CctpVm;               // adapter family — 'evm' for all currently-wired chains
  cctpVersion: 1 | 2;       // Circle protocol version (Aptos/Sui/Noble are V1-only)
  usdc: string;             // Circle-native USDC identifier (0x address on EVM; mint/denom on non-EVM)
  usdcDecimals: 6;
  // EVM message contracts. Non-EVM adapters carry their own program/module ids in `programs`.
  tokenMessenger?: string;   // TokenMessengerV2 (depositForBurn)
  messageTransmitter?: string; // MessageTransmitterV2 (receiveMessage)
  programs?: Record<string, string>; // per-VM program/module ids (svm/cosmos/move/…)
}

// CCTP V2 shared contracts (identical on all chains configured below).
const TOKEN_MESSENGER_V2 = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d';
const MESSAGE_TRANSMITTER_V2 = '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64';

/** chainId → CCTP config. Add a chain only after verifying its native USDC on-chain. */
export const CCTP_CHAINS: Record<number, CctpChainConfig> = {
  1: { chainId: 1, domain: 0, vm: 'evm', cctpVersion: 2, usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', usdcDecimals: 6, tokenMessenger: TOKEN_MESSENGER_V2, messageTransmitter: MESSAGE_TRANSMITTER_V2 },
  43114: { chainId: 43114, domain: 1, vm: 'evm', cctpVersion: 2, usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', usdcDecimals: 6, tokenMessenger: TOKEN_MESSENGER_V2, messageTransmitter: MESSAGE_TRANSMITTER_V2 },
  10: { chainId: 10, domain: 2, vm: 'evm', cctpVersion: 2, usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', usdcDecimals: 6, tokenMessenger: TOKEN_MESSENGER_V2, messageTransmitter: MESSAGE_TRANSMITTER_V2 },
  42161: { chainId: 42161, domain: 3, vm: 'evm', cctpVersion: 2, usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', usdcDecimals: 6, tokenMessenger: TOKEN_MESSENGER_V2, messageTransmitter: MESSAGE_TRANSMITTER_V2 },
  8453: { chainId: 8453, domain: 6, vm: 'evm', cctpVersion: 2, usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', usdcDecimals: 6, tokenMessenger: TOKEN_MESSENGER_V2, messageTransmitter: MESSAGE_TRANSMITTER_V2 },
  137: { chainId: 137, domain: 7, vm: 'evm', cctpVersion: 2, usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', usdcDecimals: 6, tokenMessenger: TOKEN_MESSENGER_V2, messageTransmitter: MESSAGE_TRANSMITTER_V2 },
  59144: { chainId: 59144, domain: 11, vm: 'evm', cctpVersion: 2, usdc: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff', usdcDecimals: 6, tokenMessenger: TOKEN_MESSENGER_V2, messageTransmitter: MESSAGE_TRANSMITTER_V2 },
  // Solana mainnet (synthetic chainId) — non-EVM CCTP dest. Mint proven on-chain 2026-07-16.
  // NOTE: EVM→Solana is only EXECUTABLE once NEXT_PUBLIC_CCTP_RELAYER_SOLANA is set (the source
  // needs the relayer's Solana USDC ATA as mintRecipient); until then routes fall back to aggregators.
  7565164: { chainId: 7565164, domain: 5, vm: 'svm', cctpVersion: 2, usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', usdcDecimals: 6, programs: { tokenMessengerMinterV2: 'CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe', messageTransmitterV2: 'CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC' } },
};

/** Circle Iris attestation API (mainnet). V2: GET /v2/messages/{srcDomain}?transactionHash=… */
export const CCTP_IRIS_API_BASE = 'https://iris-api.circle.com';

/** minFinalityThreshold values for depositForBurn. */
export const CCTP_FINALITY = {
  FAST: 1000,      // soft finality (seconds) — charges a fee via maxFee
  STANDARD: 2000,  // hard finality (~13–19 min) — free
} as const;

/** Nested-call gas headroom for depositForBurn / receiveMessage. */
export const CCTP_GAS_LIMIT = BigInt(300_000);

/**
 * The relayer EOA that receives the CCTP-minted USDC on the destination chain, then swaps it to
 * the final token and delivers to the user (relayer-driven, one-signature model). depositForBurn's
 * `mintRecipient` is set to this address. Server relayer signs with RELAYER_PRIVATE_KEY, whose
 * address MUST equal this. Exposed as NEXT_PUBLIC so the frontend can encode the burn.
 */
export function getCctpRelayerAddress(): string | undefined {
  return process.env.EXPO_PUBLIC_CCTP_RELAYER_ADDRESS || process.env.EXPO_PUBLIC_CCTP_RELAYER_ADDRESS;
}

/**
 * The relayer's Solana WALLET pubkey (public counterpart of SOLANA_RELAYER_SECRET). Exposed as
 * NEXT_PUBLIC so the source burn can derive the relayer's USDC ATA to use as mintRecipient for a
 * Solana destination (on Solana, CCTP mints into a token account, not a wallet).
 */
export function getCctpRelayerSolanaAddress(): string | undefined {
  return process.env.EXPO_PUBLIC_CCTP_RELAYER_SOLANA || process.env.EXPO_PUBLIC_CCTP_RELAYER_SOLANA;
}

/** Left-pad a 20-byte EVM address to a 32-byte word (CCTP mintRecipient / destinationCaller). */
export function addressToBytes32(address: string): string {
  const clean = address.toLowerCase().replace(/^0x/, '');
  if (clean.length !== 40) throw new Error(`addressToBytes32: bad address ${address}`);
  return '0x' + '0'.repeat(24) + clean;
}

/**
 * Encode a recipient/caller as CCTP's 32-byte word, in the DESTINATION chain's format.
 * `mintRecipient` and `destinationCaller` are always the destination-chain address, so the
 * encoder is chosen by the *destination* VM even though it's set during the source burn.
 * Only 'evm' is implemented today; each non-EVM adapter adds its encoder (svm=base58→32B,
 * cosmos=bech32→32B, move=already 32B, cairo=felt→32B, stellar=Circle's scheme).
 */
export function encodeRecipientBytes32(vm: CctpVm, address: string): string {
  switch (vm) {
    case 'evm':
      return addressToBytes32(address);
    case 'svm':
      // Solana pubkeys are already 32 bytes — base58-decode and hex-encode directly.
      return svmAddressToBytes32(address);
    default:
      throw new Error(`encodeRecipientBytes32: CCTP vm '${vm}' not implemented yet`);
  }
}

/** Base58 Solana address → 32-byte hex word (Solana pubkeys are natively 32 bytes). */
export function svmAddressToBytes32(address: string): string {
  const bytes = base58Decode(address);
  if (bytes.length !== 32) throw new Error(`svmAddressToBytes32: '${address}' is not a 32-byte Solana pubkey`);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return '0x' + hex;
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Minimal, dependency-free base58 decode (Bitcoin/Solana alphabet). Returns raw bytes. */
function base58Decode(str: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of str) {
    const value = BASE58_ALPHABET.indexOf(ch);
    if (value === -1) throw new Error(`base58Decode: invalid character '${ch}'`);
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Each leading '1' in base58 encodes one leading zero byte.
  for (let k = 0; k < str.length && str[k] === '1'; k++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

export function getCctpChain(chainId: number): CctpChainConfig | undefined {
  return CCTP_CHAINS[chainId];
}

export function getCctpVm(chainId: number): CctpVm | undefined {
  return CCTP_CHAINS[chainId]?.vm;
}

export function isCctpChain(chainId: number): boolean {
  return chainId in CCTP_CHAINS;
}

/**
 * A pair is CCTP-eligible when it's cross-chain and BOTH endpoints are CCTP chains.
 * (The tokens themselves need not be USDC — the local legs swap into/out of USDC.)
 */
export function isCctpPair(fromChainId: number, toChainId: number): boolean {
  return fromChainId !== toChainId && isCctpChain(fromChainId) && isCctpChain(toChainId);
}

/**
 * Master gate. The CCTP rail stays DORMANT until execution is built + funded, exactly like the
 * escrow (NEXT_PUBLIC_ESCROW_ENABLED). Server code reads CCTP_ENABLED; set to 'true' to activate.
 * Kept as a function so tests can flip process.env before importing route logic.
 */
export function isCctpEnabled(): boolean {
  return process.env.EXPO_PUBLIC_CCTP_ENABLED === 'true' || process.env.EXPO_PUBLIC_CCTP_ENABLED === 'true';
}

// --- ABIs (used by the executor + relayer in the execution phase) ---

export const TOKEN_MESSENGER_V2_ABI = [
  {
    type: 'function', name: 'depositForBurn', stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' },
    ],
    outputs: [],
  },
] as const;

export const MESSAGE_TRANSMITTER_V2_ABI = [
  {
    type: 'function', name: 'receiveMessage', stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    type: 'event', name: 'MessageSent', anonymous: false,
    inputs: [{ name: 'message', type: 'bytes', indexed: false }],
  },
] as const;
