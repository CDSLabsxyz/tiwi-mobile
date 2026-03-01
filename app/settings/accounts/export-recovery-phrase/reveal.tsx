import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { getSecureMnemonic } from '@/services/walletCreationService';
import { useWalletStore } from '@/store/walletStore';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, TouchableOpacity, View } from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChevronLeftIcon = require('../../../../assets/swap/arrow-left-02.svg');

export default function ExportRecoveryPhraseRevealScreen() {
    const { top } = useSafeAreaInsets();
    const router = useRouter();
    const { address } = useWalletStore();
    const params = useLocalSearchParams<{ returnTo?: string }>();
    const [mnemonic, setMnemonic] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRevealed, setIsRevealed] = useState(false);

    useEffect(() => {
        const fetchMnemonic = async () => {
            if (address) {
                const phrase = await getSecureMnemonic(address);
                if (phrase) {
                    setMnemonic(phrase.split(/\s+/));
                }
            }
            setIsLoading(false);
        };
        fetchMnemonic();
    }, [address]);

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPress();
            return true;
        });
        return () => backHandler.remove();
    }, [params.returnTo]);

    const handleBackPress = () => {
        router.replace('/settings/accounts' as any);
    };

    const handleReveal = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsRevealed(true);
    };

    const handleContinue = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/settings/accounts' as any); // Back to accounts for now
    };

    // Helper to chunk the phrase into rows of 3
    const rows = [];
    if (mnemonic.length > 0) {
        for (let i = 0; i < mnemonic.length; i += 3) {
            rows.push(mnemonic.slice(i, i + 3));
        }
    }

    return (
        <ThemedView style={styles.container}>
            <CustomStatusBar />

            {/* Header */}
            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleBackPress}
                        style={styles.backButton}
                    >
                        <Image
                            source={ChevronLeftIcon}
                            style={styles.fullSize}
                            contentFit="contain"
                        />
                    </TouchableOpacity>

                    <ThemedText style={styles.headerTitle}>
                        Export Recovery Phrase
                    </ThemedText>
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {isLoading ? (
                    <TIWILoader size={100} />
                ) : (
                    <>
                        <View style={styles.gridContainer}>
                            <View style={styles.phraseGrid}>
                                {rows.map((row, rowIndex) => (
                                    <View key={rowIndex} style={styles.gridRow}>
                                        {row.map((word, wordIndex) => (
                                            <View
                                                key={wordIndex}
                                                style={styles.wordBox}
                                            >
                                                <ThemedText style={styles.wordText}>
                                                    {mnemonic.indexOf(word) + 1}. {word}
                                                </ThemedText>
                                            </View>
                                        ))}
                                    </View>
                                ))}
                            </View>

                            {!isRevealed && (
                                <TouchableOpacity
                                    activeOpacity={1}
                                    onPress={handleReveal}
                                    style={styles.revealOverlay}
                                >
                                    <BlurView
                                        intensity={100}
                                        tint="dark"
                                        style={styles.blurView}
                                    >
                                        <ThemedText style={styles.revealText}>
                                            Tap to reveal your Secret Recovery Phrase
                                        </ThemedText>
                                    </BlurView>
                                </TouchableOpacity>
                            )}
                        </View>

                        {isRevealed && (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={handleContinue}
                                style={styles.continueButton}
                            >
                                <ThemedText style={styles.continueText}>
                                    Done
                                </ThemedText>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#010501',
    },
    header: {
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 42,
        paddingVertical: 10,
    },
    backButton: {
        width: 24,
        height: 24,
    },
    headerTitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 20,
        lineHeight: 20,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    gridContainer: {
        width: 342,
        maxWidth: '100%',
        position: 'relative',
    },
    phraseGrid: {
        width: '100%',
    },
    gridRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 13,
    },
    wordBox: {
        width: 106,
        height: 45,
        borderWidth: 1,
        borderColor: '#4E634B',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    wordText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 16,
        color: 'rgba(230, 227, 247, 0.75)',
    },
    revealOverlay: {
        position: 'absolute',
        top: -20, // Make it longer in height than the grid
        left: -10,
        right: -10,
        bottom: -7, // Cover the grid and the spacing
        borderRadius: 36,
        overflow: 'hidden',
        zIndex: 10,
    },
    blurView: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(101, 144, 7, 0.9)', // Increased opacity to 45% to hide text better
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    revealText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 20,
        lineHeight: 24,
        textAlign: 'center',
        color: '#e6e3f7',
    },
    continueButton: {
        marginTop: 36,
        width: '100%',
        maxWidth: 358,
        height: 54,
        backgroundColor: colors.primaryCTA,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.bg,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
});
