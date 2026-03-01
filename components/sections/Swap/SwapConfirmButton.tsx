import { colors } from '@/constants/colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';
import type { SwapTabKey } from './SwapTabs';

interface SwapConfirmButtonProps {
    label?: string;
    disabled?: boolean;
    loading?: boolean;
    onPress?: () => void;
    activeTab?: SwapTabKey;
    hasValidQuote?: boolean; // Only show specific labels when quote is valid
    isRefreshing?: boolean;
    isStale?: boolean;
}

/**
 * Primary Confirm CTA for swap/limit
 * Shows "Place Limit Order" for limit tab, "Swap Token" for swap tab
 */
export const SwapConfirmButton: React.FC<SwapConfirmButtonProps> = ({
    label,
    disabled,
    loading,
    onPress,
    activeTab = 'swap',
    hasValidQuote = false,
    isRefreshing = false,
    isStale = false,
}) => {
    const isDisabled = disabled || loading || isRefreshing;

    // Determine button label based on tab and quote validity
    const getButtonLabel = (): string => {
        // If custom label provided, use it
        if (label) return label;

        if (isStale) {
            return 'Update Price';
        }

        // Only show specific labels when there's a valid quote
        if (hasValidQuote) {
            if (activeTab === 'limit') {
                return 'Place Limit Order';
            } else {
                return 'Swap Tokens';
            }
        }

        // Default label when no quote
        return 'Confirm';
    };

    const displayLabel = getButtonLabel();

    return (
        <View style={styles.container}>
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onPress}
                disabled={isDisabled}
                style={[
                    styles.button,
                    isDisabled && styles.disabledButton
                ]}
            >
                {loading ? (
                    <TIWILoader size={40} />
                ) : (
                    <Text style={styles.buttonText}>
                        {displayLabel}
                    </Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 353,
        alignSelf: 'center',
    },
    button: {
        height: 56,
        borderRadius: 100,
        paddingHorizontal: 24,
        backgroundColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabledButton: {
        opacity: 0.6,
    },
    buttonText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.bg,
        textAlign: 'center',
    },
});
