import { colors } from '@/constants/colors';
import { ChainType } from '@/store/walletStore';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const TiwiLogo = require('@/assets/logo/tiwi-logo.svg');

const CHAIN_META: { chain: ChainType; label: string; icon: string }[] = [
    { chain: 'EVM', label: 'Ethereum', icon: 'logo-electron' },
    { chain: 'SOLANA', label: 'Solana', icon: 'planet-outline' },
    { chain: 'TRON', label: 'Tron', icon: 'flash-outline' },
    { chain: 'COSMOS', label: 'Cosmos', icon: 'globe-outline' },
];

interface FinalizeStepProps {
    address: string;
    addresses?: { [key in ChainType]?: string };
    onComplete: () => void;
}

export default function FinalizeStep({ address, addresses, onComplete }: FinalizeStepProps) {
    const formattedAddress = `${address.slice(0, 8)}..${address.slice(-6)}`;

    const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    return (
        <View style={styles.container}>
            {/* Stepper Indicator - Fully Completed State */}
            <View style={styles.stepperContainer}>
                <View style={styles.stepRow}>
                    <View style={styles.completedStepIcon}>
                        <Ionicons name="checkmark" size={14} color="#0B0F0A" />
                    </View>
                    <Text style={styles.completedStepText}>Select Creation Method</Text>
                </View>

                <View style={[styles.connectorLine, { backgroundColor: colors.primaryCTA }]} />

                <View style={styles.stepRow}>
                    <View style={styles.completedStepIcon}>
                        <Ionicons name="checkmark" size={14} color="#0B0F0A" />
                    </View>
                    <Text style={styles.completedStepText}>Save Seed Phrase</Text>
                </View>

                <View style={[styles.connectorLine, { backgroundColor: colors.primaryCTA }]} />

                <View style={styles.stepRow}>
                    <View style={styles.completedStepIcon}>
                        <Ionicons name="checkmark" size={14} color="#0B0F0A" />
                    </View>
                    <Text style={styles.completedStepText}>Confirm Seed Phrase</Text>
                </View>

                <View style={[styles.connectorLine, { backgroundColor: colors.primaryCTA }]} />

                <View style={styles.stepRow}>
                    <View style={styles.activeStepIcon}>
                        <View style={styles.activeInnerCircle} />
                    </View>
                    <Text style={styles.activeStepText}>Get Wallet</Text>
                </View>
            </View>

            <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                <Text style={styles.description}>
                    Your multi-chain wallet is ready
                </Text>

                <View style={styles.graphicPlaceholder}>
                    <Image
                        source={TiwiLogo}
                        style={styles.logo}
                        contentFit="contain"
                    />
                </View>

                <Text style={styles.addressText}>{formattedAddress}</Text>

                {/* Multi-chain addresses */}
                {addresses && (
                    <View style={styles.chainsContainer}>
                        {CHAIN_META.map(({ chain, label, icon }) => {
                            const addr = addresses[chain];
                            if (!addr) return null;
                            return (
                                <View key={chain} style={styles.chainRow}>
                                    <Ionicons name={icon as any} size={16} color={colors.primaryCTA} />
                                    <Text style={styles.chainLabel}>{label}</Text>
                                    <Text style={styles.chainAddr}>{truncate(addr)}</Text>
                                </View>
                            );
                        })}
                        <View style={styles.moreRow}>
                            <Ionicons name="ellipsis-horizontal" size={16} color="#666" />
                            <Text style={styles.moreText}>+ TON, Osmosis & more chains supported</Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            <TouchableOpacity style={styles.continueButton} onPress={onComplete}>
                <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 40,
    },
    stepperContainer: {
        marginBottom: 40,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    completedStepIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.primaryCTA,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeStepIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.primaryCTA,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeInnerCircle: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primaryCTA,
    },
    connectorLine: {
        width: 2,
        height: 16,
        marginLeft: 9,
        marginVertical: 4,
    },
    completedStepText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#FFFFFF',
    },
    activeStepText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#FFFFFF',
    },
    scrollContent: {
        flex: 1,
    },
    scrollContainer: {
        alignItems: 'center',
        paddingBottom: 16,
    },
    description: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: '#B5B5B5',
        textAlign: 'center',
        marginBottom: 30,
    },
    graphicPlaceholder: {
        width: 100,
        height: 100,
        backgroundColor: '#111810',
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    logo: {
        width: 60,
        height: 60,
    },
    addressText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 28,
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 24,
    },
    chainsContainer: {
        width: '100%',
        backgroundColor: '#111810',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 10,
    },
    chainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    chainLabel: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
        color: '#FFFFFF',
        width: 70,
    },
    chainAddr: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        color: '#888888',
        flex: 1,
    },
    moreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: '#1a2418',
        paddingTop: 10,
        marginTop: 2,
    },
    moreText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: '#666666',
    },
    continueButton: {
        backgroundColor: colors.primaryCTA,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    continueButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: '#010501',
    },
});
