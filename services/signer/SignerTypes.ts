export type ChainFamily = 'evm' | 'solana';

export interface TransactionRequest {
    chainFamily: ChainFamily;
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    nonce?: number;
    chainId?: number | string; // Solana uses strings sometimes
}

export interface ExecutionResult {
    hash: string;
    status: 'success' | 'failed';
    error?: string;
}

export interface SignerEngine {
    signTransaction(tx: TransactionRequest, address: string): Promise<string>;
    sendTransaction(tx: TransactionRequest, address: string): Promise<ExecutionResult>;
}
