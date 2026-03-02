import { AcrossExecutor } from './executors/AcrossExecutor';
import { DexExecutor } from './executors/DexExecutor';
import { LiFiExecutor } from './executors/LiFiExecutor';
import { RelayExecutor } from './executors/RelayExecutor';
import { RelayerExecutor } from './executors/RelayerExecutor';
import { ExecuteSwapParams, SwapExecutionResult } from './types';

export class UnifiedSwapManager {
    private dexExecutor = new DexExecutor();
    private lifiExecutor = new LiFiExecutor();
    private relayerExecutor = new RelayerExecutor();
    private acrossExecutor = new AcrossExecutor();
    private relayExecutor = new RelayExecutor();

    async execute(params: ExecuteSwapParams): Promise<SwapExecutionResult> {
        const { quote } = params;
        const router = quote.router?.toLowerCase() || 'unknown';
        console.log("🚀 ~ UnifiedSwapManager ~ execute ~ router:", router)

        console.log(`[UnifiedSwapManager] Routing swap to ${router} executor`);

        if (router === 'error' || router === 'none') {
            const errorMsg = (quote as any).error || "Cannot execute a failed quote. Please try again.";
            return { success: false, error: errorMsg };
        }

        if (router === 'relay') {
            return this.relayExecutor.execute(params);
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
