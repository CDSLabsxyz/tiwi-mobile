import { DexExecutor } from './executors/DexExecutor';
import { LiFiExecutor } from './executors/LiFiExecutor';
import { ExecuteSwapParams, SwapExecutionResult } from './types';

export class UnifiedSwapManager {
    private dexExecutor = new DexExecutor();
    private lifiExecutor = new LiFiExecutor();

    async execute(params: ExecuteSwapParams): Promise<SwapExecutionResult> {
        const { quote } = params;
        const router = quote.router?.toLowerCase() || 'unknown';

        console.log(`[UnifiedSwapManager] Routing swap to ${router} executor`);

        if (router === 'lifi') {
            return this.lifiExecutor.execute(params);
        }

        // Default to DEX executor for PancakeSwap, Uniswap, etc.
        if (router.includes('pancakeswap') || router.includes('uniswap') || router === 'unknown') {
            return this.dexExecutor.execute(params);
        }

        return {
            success: false,
            error: `Unsupported router: ${router}`,
        };
    }
}

export const unifiedSwapManager = new UnifiedSwapManager();
