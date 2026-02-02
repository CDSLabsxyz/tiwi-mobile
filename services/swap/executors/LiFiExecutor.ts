import type { Route } from '@lifi/sdk';
import { ExecuteSwapParams, SwapExecutionResult } from '../types';

/**
 * LiFi Executor handles cross-chain and multi-step swaps using the LiFi SDK.
 * It leverages the SDK's internal state machine for polling bridges and multi-step execution.
 */
export class LiFiExecutor {
    async execute(params: ExecuteSwapParams): Promise<SwapExecutionResult> {
        // Dynamic import to avoid top-level evaluation issues in React Native
        const { executeRoute, convertQuoteToRoute } = await import('@lifi/sdk');
        console.log("[LiFiExecutor] Execution started", {
            fromToken: params.fromToken.symbol,
            toToken: params.toToken.symbol,
            fromAmount: params.fromAmount
        });

        const { fromAddress, recipientAddress, quote } = params;
        console.log("🚀 ~ LiFiExecutor ~ execute ~ quote:", quote)

        try {
            if (!quote.raw) {
                throw new Error("LiFi execution requires the raw quote data from the API");
            }

            // 1. Prepare the Route object
            // The backend sends the LI.FI quote in quote.raw.
            // If it's just a step, we convert it to a full route.
            let lifiRoute: Route;
            if (quote.raw.steps) {
                lifiRoute = quote.raw as Route;
            } else {
                lifiRoute = convertQuoteToRoute(quote.raw);
            }
            console.log("🚀 ~ LiFiExecutor ~ execute ~ lifiRoute:", lifiRoute, {steps: lifiRoute.steps})

            // 2. Ensure addresses are properly set
            // Note: LiFi SDK needs these to know which wallet to use
            lifiRoute.fromAddress = fromAddress;
            lifiRoute.toAddress = recipientAddress || fromAddress;

            console.log("[LiFiExecutor] Executing route with SDK...");

            // 3. Execute with SDK
            // This will trigger the getWalletClient callback in lifiConfig.ts
            const executedRoute = await executeRoute(lifiRoute, {
                updateRouteHook: (updatedRoute) => {
                    console.log("🚀 ~ LiFiExecutor ~ execute ~ updatedRoute:", updatedRoute)
                    console.log(`[LiFi Step Status] ${updatedRoute.steps[0]?.execution?.status}`);
                }
            });
            console.log("🚀 ~ LiFiExecutor ~ execute ~ executedRoute:", executedRoute)

            // 4. Extract transaction hash
            // Complex routes might have multiple hashes; we usually return the first or last
            const lastStep = executedRoute.steps[executedRoute.steps.length - 1];
            console.log("🚀 ~ LiFiExecutor ~ execute ~ lastStep:", lastStep)
            const txHash = lastStep?.execution?.process?.find(p => p.txHash)?.txHash;

            console.log("[LiFiExecutor] Route execution completed", { txHash });

            return {
                success: true,
                txHash: txHash || '0x' // Fallback if hash isn't directly available
            };

        } catch (error: any) {
            console.error("[LiFiExecutor] execution failed", error);

            // Handle specific LI.FI errors if needed
            let errorMessage = error.message;
            if (error.errors && error.errors.length > 0) {
                errorMessage = error.errors[0].message;
            }

            return {
                success: false,
                error: errorMessage
            };
        }
    }
}
