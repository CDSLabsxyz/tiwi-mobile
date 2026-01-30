/**
 * Security Store
 * Manages passcode status, biometrics, and security settings
 * Passcode is hashed and stored in SecureStore (Keychain/KeyStore)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const PASSCODE_KEY = 'tiwi_user_passcode_hash';

interface SecurityState {
    hasPasscode: boolean;
    isBiometricsEnabled: boolean;
    isNotificationsEnabled: boolean;
    isLocked: boolean;
    isSetupComplete: boolean;
    lastActive: number;
    autoLockTimeout: number; // in milliseconds

    setSetupComplete: (complete: boolean) => void;
    updateLastActive: () => void;
    setAutoLockTimeout: (timeoutMs: number) => void;

    setPasscode: (code: string, state: boolean) => Promise<void>;
    verifyPasscode: (code: string) => Promise<boolean>;
    enableBiometrics: (enabled: boolean) => void;
    enableNotifications: (enabled: boolean) => void;
    lockApp: () => void;
    unlockApp: () => void;
    resetSecurity: () => Promise<void>;
}

export const useSecurityStore = create<SecurityState>()(
    persist(
        (set, get) => ({
            hasPasscode: false,
            isBiometricsEnabled: false,
            isNotificationsEnabled: false,
            isLocked: true, // Default to locked for higher security on boot
            isSetupComplete: false,
            lastActive: Date.now(),
            autoLockTimeout: 30000, // Default 30s as requested

            setSetupComplete: (complete) => set({ isSetupComplete: complete }),
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

            enableBiometrics: (enabled) => set({ isBiometricsEnabled: enabled }),
            enableNotifications: (enabled) => set({ isNotificationsEnabled: enabled }),
            lockApp: () => set({ isLocked: true }),
            unlockApp: () => set({ isLocked: false }),

            resetSecurity: async () => {
                await SecureStore.deleteItemAsync(PASSCODE_KEY);
                set({
                    hasPasscode: false,
                    isBiometricsEnabled: false,
                    isNotificationsEnabled: false,
                    isLocked: false
                });
            },
        }),
        {
            name: 'tiwi-security-storage',
            storage: createJSONStorage(() => AsyncStorage),
            // Explicitly exclude any sensitive data from the persisted store if it were there
            // though we already removed the 'passcode' property from state
        }
    )
);
