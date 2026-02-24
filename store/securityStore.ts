/**
 * Security Store
 * Manages passcode status, biometrics, and security settings
 * Passcode is hashed and stored in SecureStore (Keychain/KeyStore)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const PASSCODE_KEY = 'tiwi_user_passcode_hash';

export interface WhitelistedAddress {
    address: string;
    name: string;
    addedAt: number;
}

export type SetupPhase = 'WELCOME' | 'WALLET_READY' | 'SECURITY_READY' | 'COMPLETED';

interface SecurityState {
    hasPasscode: boolean;
    isBiometricsEnabled: boolean;
    isNotificationsEnabled: boolean;
    isLocked: boolean;
    isSetupComplete: boolean;
    setupPhase: SetupPhase; // New field
    lastActive: number;
    autoLockTimeout: number; // in milliseconds

    // Fraud Protection Settings
    isSuspiciousActivityEnabled: boolean;
    isTransactionRiskEnabled: boolean;
    isFlaggedAddressEnabled: boolean;
    isStrictModeEnabled: boolean;

    // Whitelist Addresses
    whitelistedAddresses: WhitelistedAddress[];

    setSetupComplete: (complete: boolean) => void;
    setSetupPhase: (phase: SetupPhase) => void; // New action
    updateLastActive: () => void;
    setAutoLockTimeout: (timeoutMs: number) => void;

    setPasscode: (code: string, state: boolean) => Promise<void>;
    verifyPasscode: (code: string) => Promise<boolean>;
    authenticateBiometrics: (promptMessage?: string) => Promise<boolean>;
    enableBiometrics: (enabled: boolean) => void;
    enableNotifications: (enabled: boolean) => void;

    setSuspiciousActivity: (enabled: boolean) => void;
    setTransactionRisk: (enabled: boolean) => void;
    setFlaggedAddress: (enabled: boolean) => void;
    setStrictMode: (enabled: boolean) => void;

    lockApp: () => void;
    unlockApp: () => void;

    // Whitelist Actions
    addWhitelistedAddress: (address: string, name: string) => void;
    removeWhitelistedAddress: (address: string) => void;

    resetSecurity: () => Promise<void>;
    _hasHydrated: boolean;
    setHasHydrated: (state: boolean) => void;
}

export const useSecurityStore = create<SecurityState>()(
    persist(
        (set, get) => ({
            hasPasscode: false,
            isBiometricsEnabled: false,
            isNotificationsEnabled: false,
            isLocked: true, // Default to locked for higher security on boot
            isSetupComplete: false,
            setupPhase: 'WELCOME',
            lastActive: Date.now(),
            autoLockTimeout: 30000, // Default 30s as requested

            isSuspiciousActivityEnabled: true,
            isTransactionRiskEnabled: true,
            isFlaggedAddressEnabled: true,
            isStrictModeEnabled: false,

            whitelistedAddresses: [],

            setSetupComplete: (complete) => set({
                isSetupComplete: complete,
                setupPhase: complete ? 'COMPLETED' : 'SECURITY_READY'
            }),
            setSetupPhase: (phase) => set({
                setupPhase: phase,
                isSetupComplete: phase === 'COMPLETED'
            }),
            updateLastActive: () => set({ lastActive: Date.now() }),
            setAutoLockTimeout: (timeoutMs) => set({ autoLockTimeout: timeoutMs }),

            setPasscode: async (code, state) => {
                const hash = await Crypto.digestStringAsync(
                    Crypto.CryptoDigestAlgorithm.SHA256,
                    code
                );
                await SecureStore.setItemAsync(PASSCODE_KEY, hash);
                set({ hasPasscode: state });
            },

            verifyPasscode: async (code) => {
                const storedHash = await SecureStore.getItemAsync(PASSCODE_KEY);
                if (!storedHash) return false;

                const inputHash = await Crypto.digestStringAsync(
                    Crypto.CryptoDigestAlgorithm.SHA256,
                    code
                );
                return inputHash === storedHash;
            },

            authenticateBiometrics: async (promptMessage = 'Authenticate to continue') => {
                const { isBiometricsEnabled } = get();
                if (!isBiometricsEnabled) return false;

                try {
                    const hasHardware = await LocalAuthentication.hasHardwareAsync();
                    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

                    if (!hasHardware || !isEnrolled) return false;

                    const result = await LocalAuthentication.authenticateAsync({
                        promptMessage,
                        fallbackLabel: 'Use Passcode',
                        disableDeviceFallback: false,
                    });

                    return result.success;
                } catch (error) {
                    console.error('Biometric authentication error:', error);
                    return false;
                }
            },

            enableBiometrics: (enabled) => set({ isBiometricsEnabled: enabled }),
            enableNotifications: (enabled) => set({ isNotificationsEnabled: enabled }),

            setSuspiciousActivity: (enabled) => set({ isSuspiciousActivityEnabled: enabled }),
            setTransactionRisk: (enabled) => set({ isTransactionRiskEnabled: enabled }),
            setFlaggedAddress: (enabled) => set({ isFlaggedAddressEnabled: enabled }),
            setStrictMode: (enabled) => set({ isStrictModeEnabled: enabled }),

            lockApp: () => set({ isLocked: true }),
            unlockApp: () => set({ isLocked: false }),

            addWhitelistedAddress: (address, name) => {
                const { whitelistedAddresses } = get();
                const exists = whitelistedAddresses.some(a => a.address.toLowerCase() === address.toLowerCase());
                if (exists) return;

                set({
                    whitelistedAddresses: [
                        ...whitelistedAddresses,
                        { address, name, addedAt: Date.now() }
                    ]
                });
            },

            removeWhitelistedAddress: (address) => {
                const { whitelistedAddresses } = get();
                set({
                    whitelistedAddresses: whitelistedAddresses.filter(a => a.address.toLowerCase() !== address.toLowerCase())
                });
            },

            resetSecurity: async () => {
                await SecureStore.deleteItemAsync(PASSCODE_KEY);
                set({
                    hasPasscode: false,
                    isBiometricsEnabled: false,
                    isNotificationsEnabled: false,
                    isSuspiciousActivityEnabled: true,
                    isTransactionRiskEnabled: true,
                    isFlaggedAddressEnabled: true,
                    isStrictModeEnabled: false,
                    whitelistedAddresses: [],
                    isLocked: false,
                    isSetupComplete: false,
                    setupPhase: 'WELCOME'
                });
            },
            _hasHydrated: false,
            setHasHydrated: (state) => set({ _hasHydrated: state }),
        }),
        {
            name: 'tiwi-security-storage',
            storage: createJSONStorage(() => AsyncStorage),
            onRehydrateStorage: (state) => {
                return () => state?.setHasHydrated(true);
            }
        }
    )
);
