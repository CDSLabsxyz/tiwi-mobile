import { colors } from '@/constants/colors';
import { TokenMetadata } from '@/services/apiClient';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import React from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface TokenAboutProps {
    token: TokenMetadata;
}

export const TokenAbout: React.FC<TokenAboutProps> = ({ token }) => {
    const handleCopy = async (text: string, label: string) => {
        await Clipboard.setStringAsync(text);
        Alert.alert('Copied', `${label} copied to clipboard`);
    };

    const handleLink = (url: string) => {
        if (!url) return;
        const fullUrl = url.startsWith('http') ? url : `https://${url}`;
        Linking.openURL(fullUrl).catch(() => Alert.alert('Error', 'Could not open link'));
    };

    const rows = [
        { label: 'Token Name', value: token.name },
        { label: 'Network', value: token.chainName || 'Unknown' },
        {
            label: 'Contract',
            value: token.address ? `${token.address.slice(0, 6)}...${token.address.slice(-4)}` : 'N/A',
            fullValue: token.address,
            copyable: !!token.address,
            linkable: !!token.address
        },
        {
            label: 'Official X',
            value: token.twitter ? `@${token.twitter.split('/').pop()}` : 'N/A',
            fullValue: token.twitter,
            linkable: !!token.twitter
        },
        {
            label: 'Website',
            value: token.website || 'N/A',
            fullValue: token.website,
            linkable: !!token.website
        },
    ];

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>About</Text>
            {rows.map((row, index) => (
                <View key={index} style={styles.row}>
                    <Text style={styles.label}>{row.label}</Text>
                    <View style={styles.valueContainer}>
                        <Text style={styles.value}>{row.value}</Text>

                        {row.copyable && (
                            <TouchableOpacity
                                onPress={() => handleCopy(row.fullValue!, row.label)}
                                style={styles.iconButton}
                            >
                                <Image
                                    source={require('@/assets/wallet/copy-01.svg')}
                                    style={styles.icon}
                                />
                            </TouchableOpacity>
                        )}

                        {row.linkable && (
                            <TouchableOpacity
                                onPress={() => handleLink(row.fullValue!)}
                                style={styles.iconButton}
                            >
                                <Image
                                    source={require('@/assets/home/arrow-right-01.svg')}
                                    style={styles.icon}
                                />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: colors.bg,
    },
    sectionTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    valueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    value: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    iconButton: {
        padding: 4,
    },
    icon: {
        width: 16,
        height: 16,
        tintColor: colors.bodyText,
    },
});
