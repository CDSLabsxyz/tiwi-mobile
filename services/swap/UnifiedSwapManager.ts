import { AcrossExecutor } from './executors/AcrossExecutor';
import { DexExecutor } from './executors/DexExecutor';
import { LiFiExecutor } from './executors/LiFiExecutor';
import { RelayExecutor } from './executors/RelayExecutor';
import { RelayerExecutor } from './executors/RelayerExecutor';
import { TiwiExecutor } from './executors/TiwiExecutor';
import { ExecuteSwapParams, SwapExecutionResult } from './types';

const TWC_ADDRESS = '0xda1060158f7d593667cce0a15db346bb3ffb3596';

export class UnifiedSwapManager {
    private dexExecutor = new DexExecutor();
    private lifiExecutor = new LiFiExecutor();
    private relayerExecutor = new RelayerExecutor();
    private acrossExecutor = new AcrossExecutor();
    private relayExecutor = new RelayExecutor();
    private tiwiExecutor = new TiwiExecutor();

    private isTwcSwap(params: ExecuteSwapParams): boolean {
        return params.fromToken.address.toLowerCase() === TWC_ADDRESS ||
               params.toToken.address.toLowerCase() === TWC_ADDRESS;
    }

    async execute(params: ExecuteSwapParams): Promise<SwapExecutionResult> {
        const { quote } = params;
        const router = quote.router?.toLowerCase() || 'unknown';
        console.log("🚀 ~ UnifiedSwapManager ~ execute ~ router:", router)

        console.log(`[UnifiedSwapManager] Routing swap to ${router} executor`);

        // TWC is a fee-on-transfer token (5% tax) — force DexExecutor which uses
        // swapExactTokensForTokensSupportingFeeOnTransferTokens
        if (this.isTwcSwap(params)) {
            console.log('[UnifiedSwapManager] TWC detected — routing to DexExecutor for fee-on-transfer support');
            // Clear pre-built txData so DexExecutor rebuilds with SupportingFeeOnTransfer functions
            params.quote.txData = undefined as any;
            return this.dexExecutor.execute(params);
        }

        if (router === 'error' || router === 'none') {
            const errorMsg = (quote as any).error || "Cannot execute a failed quote. Please try again.";
            return { success: false, error: errorMsg };
        }

        if (router === 'relay') {
            return this.relayExecutor.execute(params);
        }

        // 1. Priority: If SDK returned a specific transaction request, use TiwiExecutor
        if (quote.transactionRequest || router === 'aggregator' || router === 'tiwi') {
            return this.tiwiExecutor.execute(params);
        }

        if (router === 'across') {
            return this.acrossExecutor.execute(params);
        }

        if (router === 'lifi') {
            return this.lifiExecutor.execute(params);
        }

        if (router.includes('relayer') || router === 'managed') {
            // Relayer executor DISABLED per user request
            return { success: false, error: "Managed relayer execution is currently disabled. Please use a standard router." };
        }

        // Jupiter (Solana) — use TiwiExecutor with Solana chain family
        if (router === 'jupiter' || router === 'jup') {
            // Jupiter returns a serialized transaction — route through TiwiExecutor
            // which will detect the Solana chain and use the Solana signer
            return this.tiwiExecutor.execute(params);
        }

        // Default to DEX executor
        if (router.includes('pancakeswap') || router.includes('uniswap') || router === 'dex' || router === 'unknown') {
            return this.dexExecutor.execute(params);
        }

        return {
            success: false,
            error: `Unsupported router: ${router}`,
        };
    }
}

export const unifiedSwapManager = new UnifiedSwapManager();
