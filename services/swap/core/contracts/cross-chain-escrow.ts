/**
 * Cross-chain escrow (Phase 5) - single source of truth for the TiwiCrossChainOrchestrator
 * + TiwiCrossChainVault deployments, their ABIs, and per-chain config.
 *
 * Isomorphic (addresses are public): imported by the backend relayer
 * (`lib/backend/relayer/cross-chain-relayer.ts`), the frontend swapAndBridge executor,
 * and the setRelayer admin script - so addresses never drift between them.
 *
 * ⚠️ These contracts are UNAUDITED. Do not route real user funds through this path until
 * an audit is complete, the relayer is authorized on both vaults, and dest liquidity is
 * funded. See MEMORY: universal-routing-built-but-disabled (Phase 5).
 */
import { getAddress, type Address } from 'viem';

export interface EscrowChainCfg {
  name: string;
  /** TiwiCrossChainVault on this chain (holds stable liquidity, relayer fulfills from it). */
  vault: Address;
  /** TiwiCrossChainOrchestrator (source side). Omit if this chain is dest-only. */
  orchestrator?: Address;
  /** TiwiMultiSwap on this chain (does the source tokenIn → stable swap). */
  multiSwap: Address;
  /** The vault's stable liquidity token (what the source secures / dest delivers from). */
  stable: { address: Address; symbol: string; decimals: number };
  /** Uniswap/Pancake QuoterV2 for dest-swap pricing. */
  v3Quoter: Address;
  /** V3 SwapRouter (execution router allowlisted on TiwiMultiSwap). */
  v3Router: Address;
  feeTiers: number[];
  /** V2 router (allowlisted on TiwiMultiSwap) - used to build the source tokenIn→stable path. */
  v2Router: Address;
  /** Wrapped native, as the common intermediary hop when tokenIn→stable has no direct pair. */
  wrappedNative: Address;
}

// Deployed addresses (2026-07-01). Extend as more chains go live - see the "add a source
// chain" recipe in MEMORY: universal-routing-built-but-disabled.
export const ESCROW_CHAINS: Record<number, EscrowChainCfg> = {
  56: {
    name: 'BSC',
    vault: getAddress('0x5F52386f8a4BB4c3522fdD84C6A27EF9cfBF5555'),
    orchestrator: getAddress('0x1BeC6053A5928d500Ca958130F553a855fC47d8c'),
    multiSwap: getAddress('0x13291f816bf45A2ef2Ed81D24C37629C8423C4D3'),
    stable: { address: getAddress('0x55d398326f99059fF775485246999027B3197955'), symbol: 'USDT', decimals: 18 },
    v3Quoter: getAddress('0x78D78E420Da98ad378D7799bE8f4AF69033EB077'),
    v3Router: getAddress('0x13f4EA83D0bd40E75C8222255bc855a974568Dd4'),
    feeTiers: [100, 500, 2500, 10000],
    v2Router: getAddress('0x10ED43C718714eb63d5aA57B78B54704E256024E'), // PancakeSwap V2
    wrappedNative: getAddress('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'), // WBNB
  },
  42161: {
    name: 'Arbitrum',
    vault: getAddress('0xba8A1259c2c5Fe5d50785470863b6B81fe19BEb2'),
    orchestrator: getAddress('0xDD2BBF2a3d6C9CDbDB6aE473D81008cd1104b49f'),
    multiSwap: getAddress('0x3296b3B07031Ef8cfCFab581271a8c50eD4EAd11'),
    stable: { address: getAddress('0xaf88d065e77c8cC2239327C5EDb3A432268e5831'), symbol: 'USDC', decimals: 6 },
    v3Quoter: getAddress('0x61fFE014bA17989E743c5F6cB21bF9697530B21e'),
    v3Router: getAddress('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'),
    feeTiers: [500, 3000, 100, 10000],
    v2Router: getAddress('0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24'), // Uniswap V2 (multichain)
    wrappedNative: getAddress('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'), // WETH (Arbitrum)
  },
};

export function getEscrowChain(chainId: number): EscrowChainCfg | undefined {
  return ESCROW_CHAINS[chainId];
}

/** True when a chain can ORIGINATE a swapAndBridge (has an orchestrator deployed). */
export function isEscrowSource(chainId: number): boolean {
  return !!ESCROW_CHAINS[chainId]?.orchestrator;
}

/** True when a chain can RECEIVE a fulfill (has a vault deployed). */
export function isEscrowDest(chainId: number): boolean {
  return !!ESCROW_CHAINS[chainId]?.vault;
}

// The Step tuple shared by TiwiMultiSwap / orchestrator / vault.
const STEP_TUPLE = {
  name: 'swapSteps', type: 'tuple[]', components: [
    { name: 'dexType', type: 'uint8' },   // 0 = V2, 1 = V3
    { name: 'router', type: 'address' },
    { name: 'tokenIn', type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'fee', type: 'uint24' },
  ],
} as const;

/** TiwiCrossChainOrchestrator.swapAndBridge - the one-call source-side entry. */
export const ORCHESTRATOR_ABI = [
  {
    name: 'swapAndBridge', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minStableOut', type: 'uint256' },
      STEP_TUPLE,
      { name: 'destChainId', type: 'uint256' },
      { name: 'destRecipient', type: 'address' },
      { name: 'destToken', type: 'address' },
      { name: 'minDestAmount', type: 'uint256' },
    ],
    outputs: [{ name: 'stableReceived', type: 'uint256' }],
  },
  { name: 'paused', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
] as const;

/** TiwiCrossChainVault admin/read surface used by the setRelayer script + relayer. */
export const VAULT_ADMIN_ABI = [
  { name: 'setRelayer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'relayer', type: 'address' }, { name: 'allowed', type: 'bool' }], outputs: [] },
  { name: 'relayers', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;

// Nested-call gas: orchestrator → TiwiMultiSwap → DEX under-estimates via eth_estimateGas
// and reverts. Executors/scripts MUST set an explicit limit (proven ~900k on BSC + Arbitrum).
export const ESCROW_GAS_LIMIT = BigInt(900_000);
