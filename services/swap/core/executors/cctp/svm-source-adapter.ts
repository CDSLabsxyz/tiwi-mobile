/**
 * Solana (SVM) CCTP SOURCE adapter — burns USDC on Solana to a remote (EVM) domain.
 *
 *   swapToUsdc: Jupiter swap source token → USDC on Solana (skip if already USDC), return USDC in.
 *   depositForBurn: TokenMessengerMinterV2.deposit_for_burn — burns USDC; Circle mints it to
 *     `mintRecipient` (the relayer's address) on the destination chain. Generates a fresh
 *     MessageSent event account (a signer keypair) that the program initializes.
 *
 * mintRecipient for an EVM dest is the relayer's EVM address as bytes32 → a Solana `pubkey` arg.
 * deposit_for_burn fits a LEGACY tx (~18 accounts, tiny data) — no ALT needed (unlike receive).
 *
 * ⚠️ NOT verified end-to-end yet — see scripts/harness. The account layout + PDA seeds come from the
 * on-chain IDL and are the same set proven on the dest side.
 */
import {
  Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, ComputeBudgetProgram,
  VersionedTransaction, type TransactionInstruction,
} from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import {
  SVM_USDC_MINT, deriveMessageTransmitter, deriveTokenMessenger, deriveRemoteTokenMessenger,
  deriveTokenMinter,
} from '@/services/swap/core/contracts/cctp-svm';
import tmmIdl from '@/services/swap/core/contracts/idl/token_messenger_minter_v2.json';
import { apiUrl } from '@/services/swap/core/platform/api-base';

const JUPITER_API = 'https://public.jupiterapi.com';
const ZERO_PUBKEY = PublicKey.default; // destinationCaller = anyone

export interface SvmDepositForBurnParams {
  amount: bigint;                 // USDC to burn (6dp smallest units)
  destinationDomain: number;      // Circle domain of the EVM destination
  mintRecipientBytes32: string;   // relayer address on dest, 32-byte hex (0x…)
  maxFee: bigint;                 // fast-finality fee ceiling (0 for standard)
  minFinality: number;           // 1000 Fast | 2000 Standard
}

function pubkeyFromBytes32(hex: string): PublicKey {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return new PublicKey(Buffer.from(clean, 'hex'));
}

/**
 * Minimal Anchor wallet backed by a Keypair. Replaces `@coral-xyz/anchor`'s `Wallet`
 * (a NodeWallet that depends on `fs` and is excluded from the browser bundle in 0.32+).
 * Signs both legacy and versioned transactions.
 */
function keypairWallet(kp: Keypair) {
  const sign = <T extends Transaction | VersionedTransaction>(tx: T): T => {
    if ('version' in tx) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  };
  return {
    publicKey: kp.publicKey,
    payer: kp,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T) => sign(tx),
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]) => txs.map(sign),
  };
}

/** Build the deposit_for_burn instruction. `messageSent` is a fresh keypair the program initializes. */
export async function buildDepositForBurnInstruction(
  ctx: { tmm: Program; owner: PublicKey; usdcMint?: PublicKey },
  p: SvmDepositForBurnParams,
  messageSent: PublicKey,
): Promise<TransactionInstruction> {
  const usdcMint = ctx.usdcMint ?? SVM_USDC_MINT;
  const burnTokenAccount = getAssociatedTokenAddressSync(usdcMint, ctx.owner);

  return ctx.tmm.methods
    .depositForBurn({
      amount: new BN(p.amount.toString()),
      destinationDomain: p.destinationDomain,
      mintRecipient: pubkeyFromBytes32(p.mintRecipientBytes32),
      destinationCaller: ZERO_PUBKEY,
      maxFee: new BN(p.maxFee.toString()),
      minFinalityThreshold: p.minFinality,
    })
    .accountsPartial({
      owner: ctx.owner,
      eventRentPayer: ctx.owner,
      burnTokenAccount,
      messageTransmitter: deriveMessageTransmitter(),
      tokenMessenger: deriveTokenMessenger(),
      remoteTokenMessenger: deriveRemoteTokenMessenger(p.destinationDomain),
      tokenMinter: deriveTokenMinter(),
      burnTokenMint: usdcMint,
      messageSentEventData: messageSent,
      // Anchor auto-resolves: senderAuthorityPda, denylistAccount, localToken, eventAuthority, programs.
    })
    .instruction();
}

/** Full source burn: sign + send deposit_for_burn on Solana. Returns the burn signature (Iris key). */
export async function svmDepositForBurn(
  connection: Connection,
  owner: Keypair,
  p: SvmDepositForBurnParams,
  usdcMint?: PublicKey,
): Promise<{ srcTxHash: string }> {
  const provider = new AnchorProvider(connection, keypairWallet(owner), { commitment: 'confirmed' });
  const tmm = new Program(tmmIdl as any, provider);
  const messageSent = Keypair.generate(); // MessageSent event account — program initializes it

  const ix = await buildDepositForBurnInstruction({ tmm, owner: owner.publicKey, usdcMint }, p, messageSent.publicKey);
  const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }), ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [owner, messageSent], { commitment: 'confirmed' });
  return { srcTxHash: sig };
}

/**
 * Browser-wallet variant of deposit_for_burn: signs via a wallet-adapter (publicKey +
 * signTransaction) instead of a Keypair. Used by the live executor for user Solana→EVM swaps.
 * ⚠️ Browser-signing path is UNTESTED headless — verify in-app before relying on it.
 */
export async function svmDepositForBurnWithWallet(
  connection: Connection,
  wallet: any, // Solana wallet-adapter { publicKey, signTransaction, signAllTransactions }
  p: SvmDepositForBurnParams,
  usdcMint?: PublicKey,
): Promise<{ srcTxHash: string }> {
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const tmm = new Program(tmmIdl as any, provider);
  const messageSent = Keypair.generate();
  const ix = await buildDepositForBurnInstruction({ tmm, owner: wallet.publicKey, usdcMint }, p, messageSent.publicKey);
  const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }), ix);
  // provider (browser wallet) signs owner/feePayer; messageSent co-signs the new event account.
  const sig = await provider.sendAndConfirm(tx, [messageSent]);
  return { srcTxHash: sig };
}

/** Browser-wallet variant of swapToUsdc (Jupiter), signing via wallet-adapter. */
export async function svmSwapToUsdcWithWallet(
  connection: Connection,
  wallet: any,
  fromMint: PublicKey,
  amountIn: bigint,
  usdcMint: PublicKey = SVM_USDC_MINT,
): Promise<bigint> {
  if (fromMint.equals(usdcMint)) return amountIn;
  const ownerUsdcAta = getAssociatedTokenAddressSync(usdcMint, wallet.publicKey);
  const before = await connection.getTokenAccountBalance(ownerUsdcAta).then((b) => BigInt(b.value.amount)).catch(() => BigInt(0));
  // Browser path: go through the app's Jupiter proxies (public.jupiterapi.com blocks browser CORS).
  const quote = await fetch(apiUrl(`/api/v1/jupiter/quote?inputMint=${fromMint.toBase58()}&outputMint=${usdcMint.toBase58()}&amount=${amountIn.toString()}&slippageBps=100`)).then((r) => r.json());
  if (!quote?.outAmount) throw new Error('Jupiter: no route for source token → USDC');
  const swap = await fetch(apiUrl(`/api/v1/jupiter/swap`), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quoteResponse: quote, userPublicKey: wallet.publicKey.toBase58(), wrapAndUnwrapSol: true }),
  }).then((r) => r.json());
  if (!swap?.swapTransaction) throw new Error('Jupiter: no swap transaction');
  const vtx = VersionedTransaction.deserialize(Buffer.from(swap.swapTransaction, 'base64'));
  const signed = await wallet.signTransaction(vtx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  const after = await connection.getTokenAccountBalance(ownerUsdcAta).then((b) => BigInt(b.value.amount)).catch(() => BigInt(0));
  return after - before;
}

/** Swap source token → USDC on Solana via Jupiter, delivered to the owner's USDC ATA. */
export async function svmSwapToUsdc(
  connection: Connection,
  owner: Keypair,
  fromMint: PublicKey,
  amountIn: bigint,
  usdcMint: PublicKey = SVM_USDC_MINT,
): Promise<bigint> {
  if (fromMint.equals(usdcMint)) return amountIn; // already USDC
  const ownerUsdcAta = getAssociatedTokenAddressSync(usdcMint, owner.publicKey);
  const before = await connection.getTokenAccountBalance(ownerUsdcAta).then((b) => BigInt(b.value.amount)).catch(() => BigInt(0));

  const quote = await fetch(`${JUPITER_API}/quote?inputMint=${fromMint.toBase58()}&outputMint=${usdcMint.toBase58()}&amount=${amountIn.toString()}&slippageBps=100`).then((r) => r.json());
  if (!quote?.outAmount) throw new Error('Jupiter: no route for source token → USDC');
  const swap = await fetch(`${JUPITER_API}/swap`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quoteResponse: quote, userPublicKey: owner.publicKey.toBase58(), wrapAndUnwrapSol: true }),
  }).then((r) => r.json());
  if (!swap?.swapTransaction) throw new Error('Jupiter: no swap transaction');
  const vtx = VersionedTransaction.deserialize(Buffer.from(swap.swapTransaction, 'base64'));
  vtx.sign([owner]);
  const sig = await connection.sendRawTransaction(vtx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');

  const after = await connection.getTokenAccountBalance(ownerUsdcAta).then((b) => BigInt(b.value.amount)).catch(() => BigInt(0));
  return after - before;
}
