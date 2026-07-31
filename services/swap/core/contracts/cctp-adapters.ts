/**
 * CCTP VM-adapter contracts — the seam that lets one CCTP rail span every VM family.
 *
 * The `cctp_transfers` state machine, Circle attestation polling, and route quoting are all
 * VM-agnostic and live outside these adapters. Only the two chain-touching halves are polymorphic:
 *
 *   SOURCE (frontend, user-signed)  → CctpSourceAdapter.burn(...)
 *   DEST   (backend relayer-signed) → CctpDestAdapter.receiveMint(...) then .deliver(...)
 *
 * Each new chain implements one of each, plus its recipient encoder (encodeRecipientBytes32 in
 * cctp.ts). Everything else — DB, Iris, finality — is shared. See docs/cctp-non-evm-adapters.md.
 */
import type { Hex } from 'viem';
import type { CctpVm } from './cctp';

/** Mirror of a `cctp_transfers` row (the relayer's unit of work). */
export interface CctpTransferRow {
  id: string;
  src_chain_id: number; src_domain: number; src_tx_hash: string;
  dest_chain_id: number; dest_domain: number;
  recipient: string; dest_token: string; dest_token_decimals: number | null;
  min_out: string; amount_usdc: string; finality_mode: string;
  status: string; message: string | null; attestation: string | null;
  mint_tx_hash: string | null; attempts: number;
}

// ─────────────────────────── SOURCE (frontend, user signs) ───────────────────────────

export interface CctpSourceBurnParams {
  fromChainId: number;
  userAddress: string;
  usdcAmount: bigint;             // USDC to burn (already swapped into, 6dp smallest units)
  destDomain: number;            // Circle domain of the destination chain
  mintRecipientBytes32: Hex;     // relayer-on-dest, encoded for the DEST vm
  maxFee: bigint;                // Fast-finality fee ceiling (0 for Standard)
  minFinality: number;          // 1000 Fast | 2000 Standard
  walletClient?: any;            // viem WalletClient (EVM) / VM-specific signer
  // Status sink for UI. Typed loosely so any executor's status-updater (whose `stage` is a
  // narrower union) is assignable, without coupling lib/contracts to frontend swap-executor types.
  onStatusUpdate?: (s: any) => void;
}

export interface CctpSourceAdapter {
  vm: CctpVm;
  /** Approve (if needed) + burn USDC to `destDomain`. Returns the burn tx used as the Iris key. */
  burn(p: CctpSourceBurnParams): Promise<{ srcTxHash: string; receipt?: unknown }>;
}

// ─────────────────────────── DEST (backend relayer signs) ───────────────────────────

export interface CctpReceiveMintResult {
  mintTxHash?: string;    // set when this pass actually minted
  alreadyMinted?: boolean; // true when a prior pass already minted (idempotent no-op)
}

export interface CctpDeliverResult {
  deliverTxHash: string;
  actualOut: string;      // delivered amount in the dest token's smallest units
}

export interface CctpDestAdapter {
  vm: CctpVm;
  /** The relayer's address on THIS destination chain (used as mintRecipient by the source burn). */
  relayerAddress(): string;
  /** Call receiveMessage/receive_message; USDC mints to the relayer. Idempotent-aware. */
  receiveMint(row: CctpTransferRow, message: Hex, attestation: Hex): Promise<CctpReceiveMintResult>;
  /** Deliver to the user: transfer USDC, or swap USDC → dest token. */
  deliver(row: CctpTransferRow, amountUsdc: bigint): Promise<CctpDeliverResult>;
}
