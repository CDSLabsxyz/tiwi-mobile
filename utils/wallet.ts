export const WALLET_ADDRESS = '0x1234...5678'; // Placeholder for now

export function truncateAddress(address: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
