import { createPublicClient, http, erc20Abi, formatUnits } from 'viem';
import { mainnet, bsc, polygon, base, arbitrum, optimism, avalanche } from 'viem/chains';

const CHAIN_CONFIG: Record<number, { chain: any; rpcUrl?: string }> = {
    1: { chain: mainnet, rpcUrl: 'https://eth.llamarpc.com' },
    56: { chain: bsc, rpcUrl: 'https://bsc-dataseed.binance.org' },
    137: { chain: polygon, rpcUrl: 'https://polygon-rpc.com' },
    8453: { chain: base, rpcUrl: 'https://mainnet.base.org' },
    42161: { chain: arbitrum, rpcUrl: 'https://arb1.arbitrum.io/rpc' },
    10: { chain: optimism, rpcUrl: 'https://mainnet.optimism.io' },
    43114: { chain: avalanche, rpcUrl: 'https://api.avax.network/ext/bc/C/rpc' },
};

export async function fetchEvmTokenBalance(chainId: number, contractAddr: string, walletAddr: string) {
    const config = CHAIN_CONFIG[chainId];
    if (!config) return null;

    try {
        const client = createPublicClient({
            chain: config.chain,
            transport: http(config.rpcUrl),
        });

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

        return formatUnits(balance as bigint, decimals as number);
    } catch {
        return null;
    }
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
