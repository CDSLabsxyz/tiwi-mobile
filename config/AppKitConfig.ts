
import { createAppKit } from '@reown/appkit-react-native'
import { WagmiAdapter } from '@reown/appkit-wagmi-react-native'
import '@walletconnect/react-native-compat'
import { arbitrum, bsc, mainnet, optimism, polygon } from 'wagmi/chains'
import { storage } from '../utils/appkitStorage'

// 1. Get Project ID
// export const projectId = 'bc29e183924433ef00ed4e54088f1d5f'
export const projectId = 'b42614b9a35f18c4184f18241feb2883'

// 2. Create Config
export const metadata = {
    name: 'Tiwi Protocol',
    description: 'The Super App for the Web3 Generation',
    url: 'https://app.tiwiprotocol.xyz',
    icons: ['https://tiwi-protocol.vercel.app/images/logo.svg'],
    redirect: {
        native: 'tiwiprotocol://',
        universal: 'https://app.tiwiprotocol.xyz',
    },
}

export const networks = [mainnet, polygon, arbitrum, optimism, bsc]

export const wagmiAdapter = new WagmiAdapter({
    projectId,
    // @ts-ignore
    networks,
})

// 3. Configure AppKit
export const appKit = createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    metadata,
    // features: {
    //     analytics: true,
    // },
    features: {
        socials: [],
        email: false, // Type assertion for stricter environmnets
        onramp: false,
        swaps: false,
    } as any,
    themeMode: 'dark',
    themeVariables: {
        accent: '#B1F128',
    },
    storage: storage,
})
