import { DISPERSE_CONTRACTS } from '@/constants/contracts';
import { getCosmosConfig } from '@/constants/cosmosChains';
import { createTransportForChain } from '@/constants/rpc';
import { useWalletStore } from '@/store/walletStore';
import { toSmallestUnit } from '@/utils/formatting';
import { waitForReceiptSuccess } from '@/utils/txReceipt';
import { createPublicClient, encodeFunctionData } from 'viem';
import { activityService } from './activityService';
import { apiClient } from './apiClient';
import { signerController } from './signer/SignerController';
import { TransactionRequest } from './signer/SignerTypes';
import { getChainById } from './signer/SignerUtils';

// Minimal ERC20 ABI
const ERC20_ABI = [
    {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'recipient', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
] as const;

// Minimal Disperse ABI
const DISPERSE_ABI = [
    {
        name: 'disperseEther',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
            { name: 'recipients', type: 'address[]' },
            { name: 'values', type: 'uint256[]' },
        ],
        outputs: [],
    },
    {
        name: 'disperseTokenSimple',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'token', type: 'address' },
            { name: 'recipients', type: 'address[]' },
            { name: 'values', type: 'uint256[]' },
        ],
        outputs: [],
    },
] as const;

export interface SendTokenParams {
    tokenAddress: string;
    symbol: string;
    decimals: number;
    recipientAddress: string;
    amount: string;
    chainId: number;
    isNative: boolean;
    isMultiSend?: boolean;
    recipientCount?: number;
}

/**
 * TransactionService handles high-level transaction logic
 * It integrates with SignerController for execution and ApiClient for logging
 */
export const transactionService = {
    /**
     * Sends a token (Native or ERC20) to a recipient
     */
    async sendToken(params: SendTokenParams): Promise<{ hash: string; status: 'success' | 'failed'; error?: string }> {
        const { walletGroups, activeGroupId, address: legacyAddress } =
            useWalletStore.getState();
        if (!legacyAddress) throw new Error('No active wallet found');

        // Solana mainnet/devnet — pulled from the same constant used elsewhere
        // in the swap layer. Non-EVM recipients are base58 (Solana) or other
        // formats and must NOT be sent through the EVM signer (viem rejects
        // anything that isn't a 0x-prefixed 20-byte hex with InvalidAddressError,
        // which is exactly the failure on the user's screen).
        const SOLANA_CHAIN_IDS = [7565164, 1399811149];
        const isSolana = SOLANA_CHAIN_IDS.includes(Number(params.chainId));
        // Canonical ids: Sui = 101, Aptos = 637. These are non-EVM (Move) chains
        // signed by their own engines — never route them through the EVM signer.
        const isSui = Number(params.chainId) === 101;
        const isAptos = Number(params.chainId) === 637;
        // Injective (8000001) — eth_secp256k1, its own engine (NOT the cosmjs path).
        const isInjective = Number(params.chainId) === 8000001;
        // Bitcoin (8332, UTXO) & Starknet (account-abstraction).
        const isBitcoin = Number(params.chainId) === 8332;
        const isStarknet = Number(params.chainId) === 23448594291968334;
        // Cosmos-family (ATOM/OSMO/juno/…) — standard secp256k1 via @cosmjs.
        const cosmosCfg = getCosmosConfig(params.chainId);
        const isCosmos = !!cosmosCfg;
        // TRON (base58 addresses, tronweb) & TON (ed25519, V4R2 external message).
        // Both have their own engines — routing them to the EVM signer made viem
        // reject the recipient outright.
        const isTron = Number(params.chainId) === 728126428;
        const isTon = [1100, 99999].includes(Number(params.chainId));

        // Fallback: If decimals is missing for native, assume the chain default
        // (18 EVM, 9 SOL, 9 SUI/MIST, 8 APT/octas, per-chain Cosmos, 18 INJ,
        // 8 BTC/sats, 18 STRK).
        const decimals = (params.decimals === undefined || params.decimals === null)
            ? (isSolana || isSui || isTon ? 9 : isAptos || isBitcoin ? 8 : isTron ? 6 : isCosmos ? cosmosCfg!.decimals : 18)
            : params.decimals;

        const amountBIStr = toSmallestUnit(params.amount, decimals);

        let txRequest: TransactionRequest;
        // For Solana, the active address from `useWalletStore` is the EVM
        // address (legacy field). The signer needs the SOLANA address — pull
        // it from the active wallet group.
        let fromAddress = legacyAddress;
        if (isSolana) {
            const activeGroup = walletGroups.find(g => g.id === activeGroupId)
                ?? walletGroups.find(g => Object.values(g.addresses).some(
                    a => a?.toLowerCase() === legacyAddress.toLowerCase()
                ));
            const solAddr = activeGroup?.addresses.SOLANA;
            if (!solAddr) throw new Error('No Solana address in this wallet');
            fromAddress = solAddr;

            // `params.isNative` is computed by `isNativeToken()` which only
            // recognises EVM sentinels (0x0…0 / 0xee…ee). For Solana, native
            // SOL is also expressed as the wrapped-SOL mint, the literal
            // "native"/"SOL" sentinel, or an empty token address depending
            // on the data source. Fall back to a Solana-aware check so a
            // straight SOL→wallet transfer doesn't get misrouted into the
            // SPL-not-supported branch.
            const SOL_MINT = 'So11111111111111111111111111111111111111112';
            const tokenAddr = (params.tokenAddress || '').trim();
            const isNativeSol = params.isNative
                || !tokenAddr
                || tokenAddr.toLowerCase() === 'native'
                || tokenAddr === SOL_MINT
                || (params.symbol || '').toUpperCase() === 'SOL';

            if (!isNativeSol) {
                // SPL token transfers need a serialized program instruction
                // — not wired through this generic helper yet.
                throw new Error('SPL token transfers are not supported here yet');
            }

            txRequest = {
                chainFamily: 'solana',
                to: params.recipientAddress,
                value: amountBIStr, // lamports
                chainId: params.chainId,
            };
        } else if (isSui || isAptos) {
            // Move chains — pull the chain-specific address from the active group
            // (the legacy `address` field is the EVM address).
            const activeGroup = walletGroups.find(g => g.id === activeGroupId)
                ?? walletGroups.find(g => Object.values(g.addresses).some(
                    a => a?.toLowerCase() === legacyAddress.toLowerCase()
                ));
            const chainAddr = isSui ? activeGroup?.addresses.SUI : activeGroup?.addresses.APTOS;
            if (!chainAddr) throw new Error(`No ${isSui ? 'Sui' : 'Aptos'} address in this wallet`);
            fromAddress = chainAddr;

            // Native token sentinels: Sui `0x2::sui::SUI` (9dp), Aptos
            // `0x1::aptos_coin::AptosCoin` (8dp). `params.isNative` only knows EVM
            // sentinels, so fall back to a chain-aware check.
            const tokenAddr = (params.tokenAddress || '').trim().toLowerCase();
            const nativeSym = isSui ? 'SUI' : 'APT';
            const nativeAddr = isSui ? '0x2::sui::sui' : '0x1::aptos_coin::aptoscoin';
            const isNativeMove = params.isNative
                || !tokenAddr
                || tokenAddr === 'native'
                || tokenAddr === nativeAddr
                || (params.symbol || '').toUpperCase() === nativeSym;
            if (!isNativeMove) {
                throw new Error(`${isSui ? 'Sui' : 'Aptos'} token transfers are not supported here yet`);
            }

            txRequest = {
                chainFamily: isSui ? 'sui' : 'aptos',
                to: params.recipientAddress,
                value: amountBIStr, // MIST (Sui) / octas (Aptos)
                chainId: params.chainId,
            };
        } else if (isBitcoin || isStarknet) {
            const activeGroup = walletGroups.find(g => g.id === activeGroupId)
                ?? walletGroups.find(g => Object.values(g.addresses).some(
                    a => a?.toLowerCase() === legacyAddress.toLowerCase()
                ));
            const chainAddr = isBitcoin ? activeGroup?.addresses.BITCOIN : activeGroup?.addresses.STARKNET;
            if (!chainAddr) throw new Error(`No ${isBitcoin ? 'Bitcoin' : 'Starknet'} address in this wallet`);
            fromAddress = chainAddr;

            // Both send only their native asset here (BTC / STRK). Non-native
            // (BRC-20 / Starknet ERC20) isn't wired through this helper yet.
            const tokenAddr = (params.tokenAddress || '').trim().toLowerCase();
            const nativeSym = isBitcoin ? 'BTC' : 'STRK';
            const isNativeUtxoOrSn = params.isNative
                || !tokenAddr
                || tokenAddr === 'native'
                || tokenAddr === '0x0000000000000000000000000000000000000000'
                || (params.symbol || '').toUpperCase() === nativeSym;
            if (!isNativeUtxoOrSn) {
                throw new Error(`${isBitcoin ? 'Bitcoin' : 'Starknet'} token transfers are not supported here yet`);
            }

            txRequest = {
                chainFamily: isBitcoin ? 'bitcoin' : 'starknet',
                to: params.recipientAddress,
                value: amountBIStr, // sats (BTC) / wei-equivalent (STRK, 18dp)
                chainId: params.chainId,
            };
        } else if (isInjective) {
            const activeGroup = walletGroups.find(g => g.id === activeGroupId)
                ?? walletGroups.find(g => Object.values(g.addresses).some(
                    a => a?.toLowerCase() === legacyAddress.toLowerCase()
                ));
            fromAddress = activeGroup?.addresses.INJECTIVE ?? legacyAddress;

            const tokenAddr = (params.tokenAddress || '').trim().toLowerCase();
            const isNativeInj = params.isNative
                || !tokenAddr
                || tokenAddr === 'native'
                || tokenAddr === 'inj'
                || tokenAddr === '0x0000000000000000000000000000000000000000'
                || (params.symbol || '').toUpperCase() === 'INJ';
            if (!isNativeInj) {
                throw new Error('Injective CW20/token transfers are not supported here yet');
            }

            txRequest = {
                chainFamily: 'injective',
                to: params.recipientAddress,
                value: amountBIStr, // inj base units (18 decimals)
                chainId: params.chainId,
            };
        } else if (isTron || isTon) {
            const activeGroup = walletGroups.find(g => g.id === activeGroupId)
                ?? walletGroups.find(g => Object.values(g.addresses).some(
                    a => a?.toLowerCase() === legacyAddress.toLowerCase()
                ));
            const chainAddr = isTron ? activeGroup?.addresses.TRON : activeGroup?.addresses.TON;
            if (!chainAddr) throw new Error(`No ${isTron ? 'TRON' : 'TON'} address in this wallet`);
            fromAddress = chainAddr;

            // Native sentinels differ per source: `params.isNative` only knows the
            // EVM ones, so treat the usual placeholders as native too.
            const tokenAddr = (params.tokenAddress || '').trim();
            const lowered = tokenAddr.toLowerCase();
            const nativeSym = isTron ? 'TRX' : 'TON';
            const isNativeHere = params.isNative
                || !tokenAddr
                || lowered === 'native'
                || lowered === '0x0000000000000000000000000000000000000000'
                || (params.symbol || '').toUpperCase() === nativeSym;

            // The contract/jetton-master address rides in `data` — the engines
            // read it to decide between a native transfer and a token transfer.
            txRequest = {
                chainFamily: isTron ? 'tron' : 'ton',
                to: params.recipientAddress,
                value: amountBIStr, // sun (TRX, 6dp) / nanotons (TON, 9dp)
                ...(isNativeHere ? {} : { data: tokenAddr }),
                chainId: params.chainId,
            };
        } else if (isCosmos) {
            // Pull the chain-specific bech32 address for logging (the engine
            // re-derives the authoritative sender from the mnemonic + prefix).
            const activeGroup = walletGroups.find(g => g.id === activeGroupId)
                ?? walletGroups.find(g => Object.values(g.addresses).some(
                    a => a?.toLowerCase() === legacyAddress.toLowerCase()
                ));
            fromAddress = activeGroup?.addresses[cosmosCfg!.addressKey] ?? legacyAddress;

            // Cosmos native tokens reach here as the zero-address, an empty
            // string, the native denom, or the native symbol — `params.isNative`
            // (EVM sentinels) misses them, so use a chain-aware check.
            const tokenAddr = (params.tokenAddress || '').trim().toLowerCase();
            const rawToken = (params.tokenAddress || '').trim();
            const isNativeCosmos = params.isNative
                || !tokenAddr
                || tokenAddr === 'native'
                || tokenAddr === '0x0000000000000000000000000000000000000000'
                || tokenAddr === cosmosCfg!.nativeDenom.toLowerCase();

            // Non-native balances on Cosmos are bank denoms (ibc/…, factory/…,
            // or a plain u-denom) and send through the very same MsgSend — the
            // engine reads the denom off `data`. CW20 contracts are the one
            // shape that needs a different message, so they still stop here.
            const isCw20 = /^[a-z0-9]+1[a-z0-9]{38,}$/.test(rawToken);
            if (!isNativeCosmos && isCw20) {
                throw new Error('Cosmos CW20 token transfers are not supported here yet');
            }

            txRequest = {
                chainFamily: 'cosmos',
                to: params.recipientAddress,
                value: amountBIStr, // base denom (uatom, uosmo, …)
                ...(isNativeCosmos ? {} : { data: rawToken }),
                chainId: params.chainId,
            };
        } else if (params.isNative) {
            txRequest = {
                chainFamily: 'evm',
                to: params.recipientAddress,
                value: amountBIStr,
                chainId: params.chainId,
            };
        } else {
            // Encode ERC20 transfer data (matches transferERC20Token in reference)
            const data = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [params.recipientAddress as `0x${string}`, BigInt(amountBIStr)],
            });

            txRequest = {
                chainFamily: 'evm',
                to: params.tokenAddress,
                data,
                value: '0', // EXPLICIT: prevents the wallet from sending native value by mistake
                chainId: params.chainId,
            };
        }

        // Execute via SignerController.
        // skipAuthorize: the user has already approved this action via the in-app
        // passcode/biometric prompt before reaching this point — don't re-prompt.
        const result = await signerController.executeTransaction(txRequest, fromAddress, { skipAuthorize: true });

        if (result.status === 'success' && result.hash) {
            // A broadcasted tx is NOT the same as a successful tx. Wait for
            // the receipt before logging — reverts/OOG would otherwise get
            // recorded as "Sent Successfully". If the receipt confirms a
            // revert, roll the returned status to 'failed' so the UI toast
            // surfaces the real outcome.
            //
            // Solana: skip the EVM receipt poller — `sendRawTransaction` already
            // returns a signature and the SOL signer engine surfaces failures
            // synchronously.
            const mined = (isSolana || isSui || isAptos || isCosmos || isInjective || isBitcoin || isStarknet || isTron || isTon)
                ? true
                : await waitForReceiptSuccess({ hash: result.hash, chainId: params.chainId });
            if (mined === false) {
                return { hash: result.hash, status: 'failed', error: 'Transaction reverted on-chain' };
            }
            if (mined === null) {
                // Receipt unavailable — don't log a claim we can't verify.
                return result;
            }
            try {
                await apiClient.logTransaction({
                    walletAddress: fromAddress,
                    transactionHash: result.hash,
                    chainId: params.chainId,
                    type: 'Sent',
                    fromTokenAddress: params.tokenAddress,
                    fromTokenSymbol: params.symbol,
                    amount: params.amount,
                    amountFormatted: `${params.amount} ${params.symbol}`,
                    toTokenAddress: params.recipientAddress,
                });

                // Log to local activity. The `txType` is used as the row's
                // category + feeds the activityService typeMap — passing
                // 'transaction' would fall through to the 'Swap' default
                // and mis-label every send as a swap in the list.
                await activityService.logTransaction(
                    fromAddress,
                    'sent',
                    'Sent Successfully',
                    `You sent ${params.amount} ${params.symbol} to ${params.recipientAddress}`,
                    result.hash,
                    {
                        symbol: params.symbol,
                        amount: params.amount,
                        chainId: params.chainId,
                    },
                );
            } catch (logError) {
                console.error('Failed to log transaction metadata:', logError);
                // We don't fail the whole function if logging fails, as the tx is already on-chain
            }
        }

        return result;
    },

    /**
     * Multi-sends a token to multiple recipients
     */
    async multiSend(
        params: Omit<SendTokenParams, 'recipientAddress' | 'amount'> & { recipients: string[]; amounts: string[] }
    ): Promise<{ hash: string; status: 'success' | 'failed'; error?: string }> {
        const { address: fromAddress } = useWalletStore.getState();
        if (!fromAddress) throw new Error('No active wallet found');

        const disperseAddress = DISPERSE_CONTRACTS[params.chainId];
        if (!disperseAddress) throw new Error(`Disperse contract not found for chain ${params.chainId}`);

        const amountsBI = params.amounts.map(a => BigInt(toSmallestUnit(a, params.decimals)));
        const totalAmountBI = amountsBI.reduce((a, b) => a + b, 0n);

        let txRequest: TransactionRequest;

        if (params.isNative) {
            txRequest = {
                chainFamily: 'evm',
                to: disperseAddress,
                value: totalAmountBI.toString(),
                data: encodeFunctionData({
                    abi: DISPERSE_ABI,
                    functionName: 'disperseEther',
                    args: [params.recipients as `0x${string}`[], amountsBI],
                }),
                chainId: params.chainId,
            };
        } else {
            // ERC20 multi-send goes through disperseTokenSimple, which calls
            // transferFrom on the token. We must approve the disperse contract
            // for the total amount first or the call reverts with 0x.
            try {
                const chain = getChainById(params.chainId);
                // Use the multi-provider fallback transport so an Alchemy 429
                // on the allowance pre-check doesn't tank the whole multi-send.
                const publicClient = createPublicClient({ chain, transport: createTransportForChain(params.chainId) });

                const ERC20_ALLOWANCE_ABI = [{
                    name: 'allowance',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [
                        { name: 'owner', type: 'address' },
                        { name: 'spender', type: 'address' },
                    ],
                    outputs: [{ name: '', type: 'uint256' }],
                }] as const;

                const ERC20_APPROVE_ABI = [{
                    name: 'approve',
                    type: 'function',
                    stateMutability: 'nonpayable',
                    inputs: [
                        { name: 'spender', type: 'address' },
                        { name: 'amount', type: 'uint256' },
                    ],
                    outputs: [{ name: '', type: 'bool' }],
                }] as const;

                const currentAllowance = (await publicClient.readContract({
                    address: params.tokenAddress as `0x${string}`,
                    abi: ERC20_ALLOWANCE_ABI,
                    functionName: 'allowance',
                    args: [fromAddress as `0x${string}`, disperseAddress as `0x${string}`],
                })) as bigint;

                if (currentAllowance < totalAmountBI) {
                    // Approve max so subsequent multi-sends of the same token are gas-free.
                    const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
                    const approveData = encodeFunctionData({
                        abi: ERC20_APPROVE_ABI,
                        functionName: 'approve',
                        args: [disperseAddress as `0x${string}`, MAX_UINT256],
                    });

                    const approveResult = await signerController.executeTransaction({
                        chainFamily: 'evm',
                        to: params.tokenAddress,
                        data: approveData,
                        value: '0',
                        chainId: params.chainId,
                    }, fromAddress, { skipAuthorize: true });

                    if (approveResult.status !== 'success') {
                        return {
                            hash: '',
                            status: 'failed',
                            error: approveResult.error || 'Token approval failed',
                        };
                    }

                    // Wait for the approval to be mined before the disperse call.
                    try {
                        await publicClient.waitForTransactionReceipt({
                            hash: approveResult.hash as `0x${string}`,
                            confirmations: 1,
                        });
                    } catch (waitErr) {
                        console.warn('[multiSend] approve receipt wait failed, retrying disperse anyway:', waitErr);
                    }
                }
            } catch (allowanceErr: any) {
                console.error('[multiSend] allowance/approve flow failed:', allowanceErr);
                return {
                    hash: '',
                    status: 'failed',
                    error: allowanceErr?.message || 'Failed to approve token before multi-send',
                };
            }

            txRequest = {
                chainFamily: 'evm',
                to: disperseAddress,
                data: encodeFunctionData({
                    abi: DISPERSE_ABI,
                    functionName: 'disperseTokenSimple',
                    args: [params.tokenAddress as `0x${string}`, params.recipients as `0x${string}`[], amountsBI],
                }),
                value: '0', // EXPLICIT: prevents the wallet from sending native value by mistake
                chainId: params.chainId,
            };
        }

        // skipAuthorize: user already approved via the in-app passcode/biometric prompt.
        const result = await signerController.executeTransaction(txRequest, fromAddress, { skipAuthorize: true });
        return result;
    },

    /**
     * Estimates gas for a send transaction.
     *
     * EVM-only: viem's `encodeFunctionData` / `estimateGas` reject non-hex
     * addresses (Solana base58, Tron base58check, TON friendly form, Cosmos
     * bech32). Without this gate we'd surface "InvalidAddressError" the moment
     * a user opens Confirm on a SOL/TRON/TON/COSMOS/OSMOSIS send. Non-EVM
     * chains compute fees inside their own signer engine — short-circuit here
     * with zeroed values so the review screen renders cleanly.
     */
    async estimateGas(params: SendTokenParams): Promise<{ gasLimit: bigint; gasCostNative: bigint; gasCostUSD: number }> {
        const isEvmRecipient = /^0x[a-fA-F0-9]{40}$/.test(params.recipientAddress || '');
        if (!isEvmRecipient) {
            return { gasLimit: 0n, gasCostNative: 0n, gasCostUSD: 0 };
        }

        const chain = getChainById(params.chainId);
        if (!chain) {
            return { gasLimit: 0n, gasCostNative: 0n, gasCostUSD: 0 };
        }
        const client = createPublicClient({
            chain,
            transport: createTransportForChain(params.chainId)
        });

        const amountBI = BigInt(toSmallestUnit(params.amount, params.decimals));
        let gasLimit = 21000n;

        try {
            const account = useWalletStore.getState().address as `0x${string}`;

            if (params.isMultiSend && params.recipientCount) {
                const disperseAddress = DISPERSE_CONTRACTS[params.chainId];
                if (!disperseAddress) throw new Error("Disperse not supported");

                const mockRecipients = Array(params.recipientCount).fill(params.recipientAddress);
                const mockValues = Array(params.recipientCount).fill(amountBI);

                if (params.isNative) {
                    gasLimit = await client.estimateGas({
                        account,
                        to: disperseAddress as `0x${string}`,
                        value: amountBI * BigInt(params.recipientCount),
                        data: encodeFunctionData({
                            abi: DISPERSE_ABI,
                            functionName: "disperseEther",
                            args: [mockRecipients, mockValues],
                        }),
                    });
                } else {
                    gasLimit = await client.estimateGas({
                        account,
                        to: disperseAddress as `0x${string}`,
                        data: encodeFunctionData({
                            abi: DISPERSE_ABI,
                            functionName: "disperseTokenSimple",
                            args: [params.tokenAddress as `0x${string}`, mockRecipients, mockValues],
                        }),
                    });
                }
            } else if (params.isNative) {
                gasLimit = await client.estimateGas({
                    account,
                    to: params.recipientAddress as `0x${string}`,
                    value: amountBI,
                });
            } else {
                const data = encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: 'transfer',
                    args: [params.recipientAddress as `0x${string}`, amountBI],
                });

                gasLimit = await client.estimateGas({
                    account,
                    to: params.tokenAddress as `0x${string}`,
                    data,
                });
            }

            const gasPrice = await client.getGasPrice();
            const gasCostNative = gasLimit * gasPrice;

            // Simplified USD conversion
            const gasCostUSD = 0.05;

            return { gasLimit, gasCostNative, gasCostUSD };
        } catch (error) {
            console.error('Gas estimation failed:', error);
            return { gasLimit: 21000n, gasCostNative: 0n, gasCostUSD: 0 };
        }
    },

    /**
     * Simulates a send transaction to check for errors/gas
     */
    async simulateSend(params: SendTokenParams): Promise<{ success: boolean; error?: string; gasEstimate?: string }> {
        try {
            const { gasLimit } = await this.estimateGas(params);
            return { success: true, gasEstimate: gasLimit.toString() };
        } catch (error: any) {
            console.error('Simulation failed:', error);
            return { success: false, error: error.message || 'Simulation failed' };
        }
    }
};
