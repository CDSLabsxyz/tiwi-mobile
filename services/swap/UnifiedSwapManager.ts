import { AcrossExecutor } from './executors/AcrossExecutor';
import { DexExecutor } from './executors/DexExecutor';
import { LiFiExecutor } from './executors/LiFiExecutor';
import { RelayerExecutor } from './executors/RelayerExecutor';
import { ExecuteSwapParams, SwapExecutionResult } from './types';

export class UnifiedSwapManager {
    private dexExecutor = new DexExecutor();
    private lifiExecutor = new LiFiExecutor();
    private relayerExecutor = new RelayerExecutor();
    private acrossExecutor = new AcrossExecutor();

    async execute(params: ExecuteSwapParams): Promise<SwapExecutionResult> {
        const { quote } = params;
        const router = quote.router?.toLowerCase() || 'unknown';
        console.log("🚀 ~ UnifiedSwapManager ~ execute ~ router:", router)

        console.log(`[UnifiedSwapManager] Routing swap to ${router} executor`);

        if (router === 'error' || router === 'none') {
            const errorMsg = (quote as any).error || "Cannot execute a failed quote. Please try again.";
            return { success: false, error: errorMsg };
        }

        if (router === 'across') {
            return this.acrossExecutor.execute(params);
        }

        if (router === 'lifi') {
            return this.lifiExecutor.execute(params);
        }

        if (router.includes('relayer') || router === 'relay' || router === 'managed') {
            return this.relayerExecutor.execute(params);
        }

        // Default to DEX executor for PancakeSwap, Uniswap, etc.
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
