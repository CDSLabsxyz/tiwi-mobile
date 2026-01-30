// /**
//  * Web3 Configuration
//  * Configures Wagmi with WalletConnect Universal Provider (Headless)
//  */

// import '@/utils/polyfills';
// import { createConfig, http } from 'wagmi';
// import { arbitrum, avalanche, base, bsc, lisk, mainnet, optimism, polygon } from 'wagmi/chains';
// import { walletConnect } from 'wagmi/connectors';
// import { WALLETCONNECT_PROJECT_ID } from './walletConnectClient';

// // Metadata for the TIWI dApp
// const metadata = {
//   name: 'Tiwi Protocol',
//   description: 'Multichain DEX',
//   url: 'https://app.tiwiprotocol.xyz',
//   icons: ['https://tiwi-protocol.vercel.app/images/logo.svg'],
//   redirect: {
//     native: 'tiwi://',
//     universal: 'https://app.tiwiprotocol.xyz',
//   },
// };

// export const chains = [mainnet, polygon, arbitrum, base, optimism, bsc, avalanche, lisk] as const;

// /**
//  * Configure Wagmi
//  * We use the standard walletConnect connector but set showQrModal to false
//  * because TIWI handles the UI and deep-linking headlessly.
//  */
// export const config = createConfig({
//   chains,
//   syncConnectedChain: true,
//   connectors: [
//     walletConnect({ 
//       projectId: WALLETCONNECT_PROJECT_ID, 
//       metadata,
//       showQrModal: false 
//     }),
//   ],
//   transports: {
//     [mainnet.id]: http(),
//     [polygon.id]: http(),
//     [arbitrum.id]: http(),
//     [base.id]: http(),
//     [optimism.id]: http(),
//     [bsc.id]: http(),
//     [avalanche.id]: http(),
//     [lisk.id]: http(),
//   },
// });
