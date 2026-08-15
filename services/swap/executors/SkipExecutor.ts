import { COSMOS_CHAIN_CONFIG, cosmosRpcUrls } from '@/constants/cosmosChains';
import { getSecureMnemonic } from '@/services/walletCreationService';
import { useWalletStore } from '@/store/walletStore';
import {
    buildSkipAddressList,
    fetchSkipCosmosTx,
    toEncodeObject,
    type SkipRoute,
} from '../skipSwap';
import { ExecuteSwapParams, SwapExecutionResult } from '../types';

/**
 * SkipExecutor - executes Cosmos IBC swaps quoted by Skip, signing on the SOURCE
 * chain with the wallet's cosmjs key. Calls Skip's /v2/fungible/msgs DIRECTLY
 * (the backend proxy is 404 on prod) and broadcasts via a public RPC.
 *
 * Scope: cosmos SOURCE (cosmos→cosmos, cosmos→injective). Injective-SOURCE and
 * same-chain wasm-DEX routes fail honestly (need the injective msg path / extra
 * registries - matches the web's in-app limits).
 */
export class SkipExecutor {
    async execute(params: ExecuteSwapParams): Promise<SwapExecutionResult> {
        try {
            const { quote, fromAddress, fromToken } = params;
            const route = (quote as any).raw as SkipRoute;
            if (!route || !Array.isArray(route.operations)) {
                return { success: false, error: 'Skip route missing operations.' };
            }

            const sourceChainId = Number(fromToken.chainId);
            if (sourceChainId === 8000001) {
                return { success: false, error: 'Injective-source swaps aren\'t supported in-app yet - try the reverse direction.' };
            }
            const config = COSMOS_CHAIN_CONFIG[sourceChainId];
            if (!config) {
                return { success: false, error: `Swaps from chain ${sourceChainId} aren't supported yet.` };
            }

            // Resolve the wallet mnemonic + the inj recipient (for cosmos→injective hops).
            const { walletGroups, activeGroupId } = useWalletStore.getState();
            const lowered = fromAddress?.toLowerCase();
            const group = (lowered
                ? walletGroups.find(g => Object.values(g.addresses).some(a => a?.toLowerCase() === lowered))
                : undefined) ?? walletGroups.find(g => g.id === activeGroupId);
            if (!group?.addresses?.EVM) return { success: false, error: 'No mnemonic found for this wallet.' };
            const mnemonic = await getSecureMnemonic(group.addresses.EVM);
            if (!mnemonic) return { success: false, error: 'Mnemonic not found for signing.' };

            const ethSecpAddresses: Record<string, string> = {};
            if (group.addresses.INJECTIVE?.startsWith('inj1')) ethSecpAddresses.inj = group.addresses.INJECTIVE;

            const nowMs = Date.now();
            const slippage = Number((quote as any).slippage ?? 1);

            // 1. Per-hop address list, 2. Skip msgs, 3. cosmjs encode objects.
            const addressList = await buildSkipAddressList(route, fromAddress, nowMs, ethSecpAddresses);
            const cosmosTx = await fetchSkipCosmosTx(route, addressList, slippage);
            const encodeObjects = cosmosTx.msgs.map((m: any) => toEncodeObject(m));

            // 4. Sign + broadcast on the source chain.
            const { SigningStargateClient, GasPrice } = await import('@cosmjs/stargate');
            const { DirectSecp256k1HdWallet } = await import('@cosmjs/proto-signing');
            const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic.trim(), { prefix: config.prefix });
            const [account] = await wallet.getAccounts();
            const sender = account.address;

            let client: Awaited<ReturnType<typeof SigningStargateClient.connectWithSigner>> | null = null;
            let lastErr: any = null;
            for (const url of cosmosRpcUrls(config)) {
                try {
                    client = await SigningStargateClient.connectWithSigner(url, wallet, { gasPrice: GasPrice.fromString(config.gasPrice) });
                    break;
                } catch (e) { lastErr = e; }
            }
            if (!client) return { success: false, error: `Could not connect to a ${config.registryName} RPC: ${lastErr?.message || lastErr}` };

            const result = await client.signAndBroadcast(sender, encodeObjects, 'auto');
            if (result.code !== 0) {
                return { success: false, error: result.rawLog || `Swap failed (code ${result.code})` };
            }
            return { success: true, txHash: result.transactionHash };
        } catch (error: any) {
            console.warn('[SkipExecutor] Execution failed:', error?.message);
            return { success: false, error: error?.message || 'Skip swap execution failed' };
        }
    }
}
