import { signerController } from '@/services/signer/SignerController';
import { useDAppRequestStore } from '@/store/dappRequestStore';
import { useWalletStore } from '@/store/walletStore';
import { EVM_CHAINS } from '@/services/signer/SignerUtils';
import type { WebView } from 'react-native-webview';

export const NETWORK_ID_TO_CHAIN_ID: Record<string, number> = {
    ETH: 1,
    BSC: 56,
    POLYGON: 137,
    BASE: 8453,
    OPTIMISM: 10,
    ARBITRUM: 42161,
    AVALANCHE: 43114,
};

export function getActiveChainId(): number {
    const { activeChain, activeNetworkId } = useWalletStore.getState();
    if (activeChain !== 'EVM') return 1;
    if (activeNetworkId && NETWORK_ID_TO_CHAIN_ID[activeNetworkId]) {
        return NETWORK_ID_TO_CHAIN_ID[activeNetworkId];
    }
    return 1;
}

export function toHex(n: number | bigint): string {
    return '0x' + BigInt(n).toString(16);
}

export interface BridgeContext {
    webviewRef: { current: WebView | null };
    origin: string;
    // Called when the bridge wants to update the page with new chain/accounts.
    injectEvent: (event: 'chainChanged' | 'accountsChanged', data: unknown) => void;
}

interface IncomingMessage {
    id: number;
    method: string;
    params: any[];
}

function ok(ctx: BridgeContext, id: number, result: unknown) {
    sendResponse(ctx.webviewRef, id, result, undefined);
}

function fail(ctx: BridgeContext, id: number, code: number, message: string) {
    sendResponse(ctx.webviewRef, id, null, { code, message });
}

function sendResponse(
    ref: { current: WebView | null },
    id: number,
    result: unknown,
    error: { code: number; message: string } | undefined,
) {
    const payload = JSON.stringify({ result: result ?? null, error: error || null });
    const js = `(function(){try{var p=${payload};window.ethereum&&window.ethereum._handleResponse(${id},p.result,p.error);}catch(e){}})();true;`;
    try {
        ref.current?.injectJavaScript(js);
    } catch (e) {
        console.warn('[providerBridge] injectJavaScript failed', e);
    }
}

async function publicRpc(method: string, params: any[]): Promise<unknown> {
    const chainId = getActiveChainId();
    const client = await signerController.getPublicClient(chainId);
    return (client.transport as any).request({ method, params });
}

async function requestAccounts(ctx: BridgeContext): Promise<string[]> {
    const { address } = useWalletStore.getState();
    if (!address) {
        throw { code: 4100, message: 'Wallet is not connected' };
    }

    await useDAppRequestStore.getState().enqueue({
        kind: 'connect',
        origin: ctx.origin,
        method: 'eth_requestAccounts',
        params: [],
    });

    return [address];
}

export async function handleDAppMessage(raw: string, ctx: BridgeContext): Promise<void> {
    let msg: IncomingMessage;
    try {
        msg = JSON.parse(raw);
    } catch {
        return;
    }
    if (!msg || typeof msg.id !== 'number' || typeof msg.method !== 'string') return;

    const { id, method, params = [] } = msg;
    const { address } = useWalletStore.getState();
    const chainId = getActiveChainId();

    try {
        switch (method) {
            case 'eth_chainId':
                return ok(ctx, id, toHex(chainId));

            case 'net_version':
                return ok(ctx, id, String(chainId));

            case 'eth_accounts':
                return ok(ctx, id, address ? [address] : []);

            case 'eth_requestAccounts':
            case 'wallet_requestPermissions': {
                const accounts = await requestAccounts(ctx);
                ctx.injectEvent('accountsChanged', accounts);
                return ok(ctx, id, method === 'wallet_requestPermissions'
                    ? [{ parentCapability: 'eth_accounts' }]
                    : accounts);
            }

            case 'wallet_getPermissions':
                return ok(ctx, id, address ? [{ parentCapability: 'eth_accounts' }] : []);

            case 'personal_sign':
            case 'eth_sign': {
                if (!address) throw { code: 4100, message: 'Wallet not connected' };
                await useDAppRequestStore.getState().enqueue({
                    kind: 'personal_sign',
                    origin: ctx.origin,
                    method,
                    params,
                });
                const message = method === 'personal_sign' ? params[0] : params[1];
                const walletClient = await signerController.getWalletClient(chainId, address);
                const signature = await walletClient.signMessage({
                    account: walletClient.account!,
                    message: typeof message === 'string' && message.startsWith('0x')
                        ? { raw: message as `0x${string}` }
                        : message,
                });
                return ok(ctx, id, signature);
            }

            case 'eth_signTypedData':
            case 'eth_signTypedData_v3':
            case 'eth_signTypedData_v4': {
                if (!address) throw { code: 4100, message: 'Wallet not connected' };
                await useDAppRequestStore.getState().enqueue({
                    kind: 'signTypedData',
                    origin: ctx.origin,
                    method,
                    params,
                });
                const rawTyped = params[1];
                const typed = typeof rawTyped === 'string' ? JSON.parse(rawTyped) : rawTyped;
                const walletClient = await signerController.getWalletClient(chainId, address);
                const signature = await walletClient.signTypedData({
                    account: walletClient.account!,
                    domain: typed.domain,
                    types: typed.types,
                    primaryType: typed.primaryType,
                    message: typed.message,
                });
                return ok(ctx, id, signature);
            }

            case 'eth_sendTransaction': {
                if (!address) throw { code: 4100, message: 'Wallet not connected' };
                const tx = params[0] || {};
                await useDAppRequestStore.getState().enqueue({
                    kind: 'sendTransaction',
                    origin: ctx.origin,
                    method,
                    params,
                });

                const result = await signerController.executeTransaction(
                    {
                        chainFamily: 'evm',
                        chainId,
                        to: tx.to,
                        data: tx.data,
                        value: tx.value ? BigInt(tx.value).toString() : '0',
                    } as any,
                    address,
                );

                if (result.status !== 'success') {
                    throw { code: -32603, message: result.error || 'Transaction failed' };
                }
                return ok(ctx, id, result.hash);
            }

            case 'wallet_switchEthereumChain': {
                const requested = parseInt((params[0]?.chainId || '0x1').toString(), 16);
                if (!EVM_CHAINS[requested]) {
                    throw { code: 4902, message: 'Chain not supported by Tiwi' };
                }
                await useDAppRequestStore.getState().enqueue({
                    kind: 'switchChain',
                    origin: ctx.origin,
                    method,
                    params,
                });

                const networkId = Object.keys(NETWORK_ID_TO_CHAIN_ID).find(
                    (k) => NETWORK_ID_TO_CHAIN_ID[k] === requested,
                );
                if (networkId) {
                    useWalletStore.getState().setActiveChain('EVM', networkId);
                    ctx.injectEvent('chainChanged', toHex(requested));
                }
                return ok(ctx, id, null);
            }

            case 'wallet_addEthereumChain': {
                await useDAppRequestStore.getState().enqueue({
                    kind: 'addChain',
                    origin: ctx.origin,
                    method,
                    params,
                });
                return ok(ctx, id, null);
            }

            case 'wallet_watchAsset': {
                await useDAppRequestStore.getState().enqueue({
                    kind: 'watchAsset',
                    origin: ctx.origin,
                    method,
                    params,
                });
                return ok(ctx, id, true);
            }

            // Read-only methods forwarded to our RPC
            case 'eth_blockNumber':
            case 'eth_getBalance':
            case 'eth_getCode':
            case 'eth_getStorageAt':
            case 'eth_getTransactionByHash':
            case 'eth_getTransactionReceipt':
            case 'eth_getTransactionCount':
            case 'eth_call':
            case 'eth_estimateGas':
            case 'eth_gasPrice':
            case 'eth_feeHistory':
            case 'eth_getBlockByHash':
            case 'eth_getBlockByNumber':
            case 'eth_getLogs':
            case 'eth_maxPriorityFeePerGas': {
                const result = await publicRpc(method, params);
                return ok(ctx, id, result);
            }

            default:
                // Fallback: try forwarding unknown methods to our RPC.
                try {
                    const result = await publicRpc(method, params);
                    return ok(ctx, id, result);
                } catch {
                    return fail(ctx, id, 4200, `Method ${method} not supported`);
                }
        }
    } catch (err: any) {
        const code = typeof err?.code === 'number' ? err.code : -32603;
        const message = err?.message || 'Request failed';
        return fail(ctx, id, code, message);
    }
}
