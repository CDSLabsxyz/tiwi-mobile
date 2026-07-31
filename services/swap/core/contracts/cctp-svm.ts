/**
 * Solana (SVM) CCTP V2 — program IDs + PDA derivations.
 *
 * Every seed here was taken from the on-chain Anchor IDLs (fetched into lib/contracts/idl/) and the
 * data-holding PDAs were verified to resolve to live mainnet accounts (see __tests__/cctp-svm.test.ts).
 * Used by both the SVM source adapter (deposit_for_burn) and the dest adapter (receive_message).
 *
 * Signer/authority PDAs (sender_authority, *_event_authority, message_transmitter_authority) have NO
 * data account — they exist only as CPI signer seeds, so on-chain lookups return null by design.
 */
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

export const SVM_TOKEN_MESSENGER_MINTER = new PublicKey('CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe');
export const SVM_MESSAGE_TRANSMITTER = new PublicKey('CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC');
export const SVM_USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

const utf8 = (s: string) => new TextEncoder().encode(s);
const pda = (seeds: Uint8Array[], program: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(seeds, program)[0];

// ── TokenMessengerMinter program PDAs ──
export const deriveTokenMessenger = () => pda([utf8('token_messenger')], SVM_TOKEN_MESSENGER_MINTER);
export const deriveTokenMinter = () => pda([utf8('token_minter')], SVM_TOKEN_MESSENGER_MINTER);
export const deriveSenderAuthority = () => pda([utf8('sender_authority')], SVM_TOKEN_MESSENGER_MINTER);
export const deriveLocalToken = (mint: PublicKey) => pda([utf8('local_token'), mint.toBytes()], SVM_TOKEN_MESSENGER_MINTER);
export const deriveCustodyTokenAccount = (mint: PublicKey) => pda([utf8('custody'), mint.toBytes()], SVM_TOKEN_MESSENGER_MINTER);
export const deriveTmmEventAuthority = () => pda([utf8('__event_authority')], SVM_TOKEN_MESSENGER_MINTER);
export const deriveDenylistAccount = (owner: PublicKey) => pda([utf8('denylist_account'), owner.toBytes()], SVM_TOKEN_MESSENGER_MINTER);

/** remote_token_messenger is keyed by the SOURCE domain rendered as a decimal string. */
export const deriveRemoteTokenMessenger = (domain: number) =>
  pda([utf8('remote_token_messenger'), utf8(String(domain))], SVM_TOKEN_MESSENGER_MINTER);

/** token_pair is keyed by (source domain string, source token as 32 raw bytes). */
export const deriveTokenPair = (domain: number, remoteTokenBytes32: Uint8Array) =>
  pda([utf8('token_pair'), utf8(String(domain)), remoteTokenBytes32], SVM_TOKEN_MESSENGER_MINTER);

// ── MessageTransmitter program PDAs ──
export const deriveMessageTransmitter = () => pda([utf8('message_transmitter')], SVM_MESSAGE_TRANSMITTER);
export const deriveMtEventAuthority = () => pda([utf8('__event_authority')], SVM_MESSAGE_TRANSMITTER);
/** authority_pda that MessageTransmitter uses to CPI into `receiver` (the TokenMessengerMinter program). */
export const deriveMessageTransmitterAuthority = (receiver: PublicKey = SVM_TOKEN_MESSENGER_MINTER) =>
  pda([utf8('message_transmitter_authority'), receiver.toBytes()], SVM_MESSAGE_TRANSMITTER);

/**
 * used_nonce PDA — keyed by the message's 32-byte nonce. NOT declared in the IDL; seeds
 * ["used_nonce", nonce] were confirmed by decoding a real mainnet receive_message and matching
 * account #4 exactly (see __tests__/cctp-message.test.ts). receive_message writes this to mark
 * the nonce spent, so a wrong derivation would break replay protection.
 */
export const deriveUsedNonce = (nonce: Uint8Array) => {
  if (nonce.length !== 32) throw new Error('deriveUsedNonce: nonce must be 32 bytes');
  return pda([utf8('used_nonce'), nonce], SVM_MESSAGE_TRANSMITTER);
};

/** USDC associated token account for a Solana wallet — the CCTP mintRecipient on Solana. */
export const svmUsdcAta = (ownerBase58: string): string =>
  getAssociatedTokenAddressSync(SVM_USDC_MINT, new PublicKey(ownerBase58)).toBase58();
