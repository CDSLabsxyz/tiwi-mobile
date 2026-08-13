import { getCachedPublicClient } from '@/services/swap/core/platform/viem-clients';
import { erc20Abi, formatUnits } from 'viem';

export interface EvmTokenBalanceDetails {
    balance: string;
    balanceFormatted: string;
    decimals: number;
}

export async function fetchEvmTokenBalanceDetails(
    chainId: number,
    contractAddr: string,
    walletAddr: string,
): Promise<EvmTokenBalanceDetails | null> {
    try {
        const client = getCachedPublicClient(chainId);

        const [balance, decimals] = await Promise.all([
            client.readContract({
                address: contractAddr as `0x${string}`,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [walletAddr as `0x${string}`],
            }),
            client.readContract({
                address: contractAddr as `0x${string}`,
                abi: erc20Abi,
                functionName: 'decimals',
            }).catch(() => 18),
        ]);

        const dec = Number(decimals) || 18;
        return {
            balance: (balance as bigint).toString(),
            balanceFormatted: formatUnits(balance as bigint, dec),
            decimals: dec,
        };
    } catch {
        return null;
    }
}

export async function fetchEvmTokenBalance(chainId: number, contractAddr: string, walletAddr: string) {
    return (await fetchEvmTokenBalanceDetails(chainId, contractAddr, walletAddr))?.balanceFormatted ?? null;
}

export async function fetchSolanaTokenBalance(mintAddr: string, walletAddr: string): Promise<string | null> {
    try {
        const resp = await fetch('https://api.mainnet-beta.solana.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getTokenAccountsByOwner',
                params: [walletAddr, { mint: mintAddr }, { encoding: 'jsonParsed' }],
            }),
        });
        const data = await resp.json();
        const accounts = data?.result?.value || [];
        if (accounts.length === 0) return '0';
        return accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmountString || '0';
    } catch {
        return null;
    }
}
