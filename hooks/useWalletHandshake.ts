// import { useState, useCallback } from 'react';
// import { useConnect, useDisconnect } from 'wagmi';
// import { launchWallet } from '@/utils/walletLauncher';
// import { wagmiAdapter } from '@/services/web3Config';

// /**
//  * Headless Wallet Handshake Hook
//  * Intercepts the WalletConnect URI and triggers the custom redirection logic
//  * Uses direct adapter access to ensure connectors are always found
//  */
// export const useWalletHandshake = () => {
//   const { connectAsync } = useConnect();
//   const { disconnectAsync } = useDisconnect();
//   const [isConnecting, setIsConnecting] = useState(false);

//   const startHandshake = useCallback(async (walletScheme?: string) => {
//     setIsConnecting(true);
    
//     try {
//       // 1. Get connectors directly from the Wagmi Config to avoid empty hook state
//       const connectors = wagmiAdapter.wagmiConfig.connectors;
//       console.log('TIWI Handshake: Available Connectors', connectors.map(c => ({ id: c.id, name: c.name })));
      
//       // 2. Find the WalletConnect engine
//       // We look for 'walletConnect' (standard), 'walletconnect' (lowercase), or any Reown variant
//       const connector = connectors.find((c) => 
//         c.id.toLowerCase().includes('walletconnect') || 
//         c.name.toLowerCase().includes('walletconnect')
//       );
      
//       if (!connector) {
//         console.error('TIWI Handshake Error: No WalletConnect connector found in config.');
//         console.log('Connectors found:', connectors.map(c => c.id));
//         throw new Error('WalletConnect engine is not initialized. Check web3Config.ts');
//       }

//       // 3. Set up a one-time listener for the URI interceptor
//       // We use a promise to wait for the URI so we can handle it 100% headlessly
//       const setupUriListener = () => {
//         return new Promise<void>((resolve) => {
//           // Listen to the provider's display_uri event directly for maximum reliability
//           connector.getProvider().then((provider: any) => {
//             // Remove any existing listeners to prevent duplicates
//             provider.removeListener('display_uri', () => {});
            
//             provider.once('display_uri', (uri: string) => {
//               console.log('TIWI Handshake: URI Intercepted', uri);
//               launchWallet(uri, walletScheme);
//               resolve();
//             });
//           });
//         });
//       };

//       const handshakePromise = setupUriListener();

//       // 4. Trigger the connection
//       await connectAsync({ connector });
      
//       // Wait for the URI to be handled
//       await handshakePromise;
      
//     } catch (error) {
//       console.error('TIWI Handshake Session Error:', error);
//       // Clean up failed session
//       await disconnectAsync();
//     } finally {
//       setIsConnecting(false);
//     }
//   }, [connectAsync, disconnectAsync]);

//   return {
//     startHandshake,
//     isConnecting,
//   };
// };
