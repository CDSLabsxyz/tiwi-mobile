/**
 * Device Store
 * 
 * Manages connected device sessions for the Tiwi Protocol mobile app.
 * Persists session history locally.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface DeviceSession {
    id: string;
    deviceName: string;
    ipAddress: string;
    location: string;
    lastActive: number;
    isActive: boolean;
    platform: 'ios' | 'android' | 'web';
}

interface DeviceState {
    sessions: DeviceSession[];
    currentDeviceId: string | null;

    // Actions
    setSessions: (sessions: DeviceSession[]) => void;
    addOrUpdateSession: (session: DeviceSession) => void;
    terminateSession: (deviceId: string) => void;
    terminateAllOtherSessions: () => void;
    setCurrentDeviceId: (id: string) => void;
    updateLastActive: (deviceId: string) => void;
}

export const useDeviceStore = create<DeviceState>()(
    persist(
        (set, get) => ({
            sessions: [],
            currentDeviceId: null,

            setSessions: (sessions) => set({ sessions }),

            addOrUpdateSession: (session) => {
                const { sessions } = get();
                const existingIndex = sessions.findIndex(s => s.id === session.id);

                let newSessions = [...sessions];
                if (existingIndex !== -1) {
                    newSessions[existingIndex] = { ...newSessions[existingIndex], ...session };
                } else {
                    newSessions.push(session);
                }

                // If this session is marked active, deactivate others
                if (session.isActive) {
                    newSessions = newSessions.map(s =>
                        s.id === session.id ? s : { ...s, isActive: false }
                    );
                }

                set({ sessions: newSessions });
            },

            terminateSession: (deviceId) => {
                const { sessions } = get();
                set({ sessions: sessions.filter(s => s.id !== deviceId) });
            },

            terminateAllOtherSessions: () => {
                const { sessions, currentDeviceId } = get();
                if (!currentDeviceId) return;
                set({ sessions: sessions.filter(s => s.id === currentDeviceId) });
            },

            setCurrentDeviceId: (currentDeviceId) => set({ currentDeviceId }),

            updateLastActive: (deviceId) => {
                const { sessions } = get();
                set({
                    sessions: sessions.map(s =>
                        s.id === deviceId ? { ...s, lastActive: Date.now() } : s
                    )
                });
            }
        }),
        {
            name: 'tiwi-device-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
