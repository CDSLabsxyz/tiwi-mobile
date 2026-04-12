import { getRpcUrl } from "@/constants/rpc";
import { createPublicClient, encodeFunctionData, http, type Address, type Chain } from "viem";
import { arbitrum, base, bsc, mainnet, optimism, polygon } from "viem/chains";

// Chain mapping
const CHAIN_MAP: Record<number, Chain> = {
    1: mainnet,
    42161: arbitrum,
    10: optimism,
    137: polygon,
    8453: base,
    56: bsc,
};

/**
 * Get public client for EVM chain
 */
export function getPublicClient(chainId: number) {
    const chain = CHAIN_MAP[chainId];
    if (!chain) {
        throw new Error(`Unsupported chain: ${chainId}`);
    }
    return createPublicClient({
        chain,
        transport: http(getRpcUrl(chainId), { timeout: 15000 }),
    });
}

/**
 * Check if address is native token (ETH, MATIC, etc.)
 */
export function isNativeToken(address: string): boolean {
    const lower = address.toLowerCase();
    return (
        lower === "0x0000000000000000000000000000000000000000" ||
        lower === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
        lower === "native"
    );
}

/**
 * Transfer native token (ETH, MATIC, etc.) on EVM
 */
export async function transferNativeToken(
    walletClient: any,
    toAddress: string,
    amount: bigint
): Promise<`0x${string}`> {
    const hash = await walletClient.sendTransaction({
        to: toAddress as `0x${string}`,
        value: amount,
    });
    return hash as `0x${string}`;
}

/**
 * Transfer ERC20 token on EVM
 */
export async function transferERC20Token(
    walletClient: any,
    tokenAddress: string,
    toAddress: string,
    amount: bigint
): Promise<`0x${string}`> {
    const transferABI = [
        {
            constant: false,
            inputs: [
                { name: "_to", type: "address" },
                { name: "_value", type: "uint256" },
            ],
            name: "transfer",
            outputs: [{ name: "", type: "bool" }],
            type: "function",
        },
    ] as const;

    const data = encodeFunctionData({
        abi: transferABI,
        functionName: "transfer",
        args: [toAddress as Address, amount],
    });

    const hash = await walletClient.sendTransaction({
        to: tokenAddress as `0x${string}`,
        data,
    });

    return hash as `0x${string}`;
}
