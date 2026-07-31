/**
 * TIWI Liquidity Hub contract ABIs (copied from tiwi-user-app
 * lib/contracts/abis/*). The pair contract is itself the LP ERC20 token.
 */
import FactoryJson from './TiwiLiquidityFactory.json';
import PairJson from './TiwiLiquidityPair.json';
import RouterJson from './TiwiLiquidityRouter.json';

const unwrap = (j: any): readonly any[] => (Array.isArray(j) ? j : j.abi) as readonly any[];

export const TIWI_LIQUIDITY_FACTORY_ABI = unwrap(FactoryJson);
export const TIWI_LIQUIDITY_PAIR_ABI = unwrap(PairJson);
export const TIWI_LIQUIDITY_ROUTER_ABI = unwrap(RouterJson);

/** Minimal ERC20 ABI for allowance/approve/decimals/balanceOf used by liquidity flows. */
export const LIQUIDITY_ERC20_ABI = [
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
] as const;

/** Wrapped-native deposit()/withdraw() for the router-less native flow. */
export const WRAPPED_NATIVE_ABI = [
  { inputs: [], name: 'deposit', outputs: [], stateMutability: 'payable', type: 'function' },
  { inputs: [{ name: 'wad', type: 'uint256' }], name: 'withdraw', outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const;
