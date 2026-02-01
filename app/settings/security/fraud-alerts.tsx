import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { useSecurityStore } from '@/store/securityStore';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChevronLeftIcon = require('../../../assets/swap/arrow-left-02.svg');

// Toggle Switch Component
interface ToggleSwitchProps {
    value: boolean;
    onValueChange: (value: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ value, onValueChange }) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onValueChange(!value)}
            style={styles.toggleContainer}
        >
            <View style={[
                styles.toggleTrack,
                { borderColor: value ? '#B4FF3B' : 'rgba(255, 255, 255, 0.2)' }
            ]}>
                <View style={[
                    styles.toggleThumb,
                    {
                        backgroundColor: value ? '#B4FF3B' : 'rgba(255, 255, 255, 0.2)',
                        transform: [{ translateX: value ? 16 : 0 }]
                    }
                ]} />
            </View>
        </TouchableOpacity>
    );
};

export default function FraudAlertsScreen() {
    const { top } = useSafeAreaInsets();
    const router = useRouter();
    const {
        isSuspiciousActivityEnabled,
        isTransactionRiskEnabled,
        isFlaggedAddressEnabled,
        isStrictModeEnabled,
        setSuspiciousActivity,
        setTransactionRisk,
        setFlaggedAddress,
        setStrictMode
    } = useSecurityStore();

    // Handle phone back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPress();
            return true;
        });

        return () => backHandler.remove();
    }, []);

    const handleBackPress = () => {
        router.back();
    };

    const handleToggle = (action: (val: boolean) => void, currentVal: boolean) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        action(!currentVal);
    };

    return (
        <View style={styles.container}>
            <CustomStatusBar />

            {/* Header */}
            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleBackPress}
                        style={styles.backButton}
                    >
                        <Image
                            source={ChevronLeftIcon}
                            style={styles.fullSize}
                            contentFit="contain"
                        />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>
                        Fraud Alerts
                    </Text>
                    <View style={styles.placeholder} />
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <View style={styles.list}>
                    {/* Suspicious Activity Alerts */}
                    <View style={styles.item}>
                        <Text style={styles.itemText}>
                            Suspicious Activity Alerts
                        </Text>
                        <ToggleSwitch
                            value={isSuspiciousActivityEnabled}
                            onValueChange={() => handleToggle(setSuspiciousActivity, isSuspiciousActivityEnabled)}
                        />
                    </View>

                    {/* Transaction Risk Scores */}
                    <View style={styles.item}>
                        <Text style={styles.itemText}>
                            Transaction Risk Scores
                        </Text>
                        <ToggleSwitch
                            value={isTransactionRiskEnabled}
                            onValueChange={() => handleToggle(setTransactionRisk, isTransactionRiskEnabled)}
                        />
                    </View>

                    {/* Flagged Address Warnings */}
                    <View style={styles.item}>
                        <Text style={styles.itemText}>
                            Flagged Address Warnings
                        </Text>
                        <ToggleSwitch
                            value={isFlaggedAddressEnabled}
                            onValueChange={() => handleToggle(setFlaggedAddress, isFlaggedAddressEnabled)}
                        />
                    </View>

                    {/* Whitelist Strict Mode */}
                    <View style={[styles.item, { marginTop: 16 }]}>
                        <Text style={styles.itemText}>
                            Whitelist Only (Strict Mode)
                        </Text>
                        <ToggleSwitch
                            value={isStrictModeEnabled}
                            onValueChange={() => handleToggle(setStrictMode, isStrictModeEnabled)}
                        />
                    </View>

                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>
                            When enabled, you can only send or interact with addresses in your Whitelist. This protects you from clipboard hijacking and accidental transfers to unknown addresses.
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050201',
    },
    header: {
        backgroundColor: '#050201',
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
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
        color: '#FFFFFF',
        flex: 1,
        textAlign: 'center',
    },
    placeholder: {
        width: 24,
    },
    content: {
        flex: 1,
        paddingHorizontal: 22,
        paddingTop: 106,
    },
    list: {
        gap: 8,
        width: '100%',
    },
    item: {
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    itemText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    toggleContainer: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleTrack: {
        width: 40,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        backgroundColor: 'transparent',
        padding: 2,
        justifyContent: 'center',
    },
    toggleThumb: {
        width: 12,
        height: 12,
        borderRadius: 10,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
    infoBox: {
        marginTop: 24,
        padding: 16,
        backgroundColor: 'rgba(180, 255, 59, 0.05)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(180, 255, 59, 0.1)',
    },
    infoText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        lineHeight: 20,
        color: 'rgba(255, 255, 255, 0.5)',
    },
});
