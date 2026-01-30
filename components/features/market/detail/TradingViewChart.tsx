import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const imgArrowDown = "http://localhost:3845/assets/0e836a617eebbb1ad1003c8ec4eee1d931781d9a.svg";
const timeframes = ['15m', '1h', '4h', '6h', '1D', '3D', 'More'];

// Placeholder from Figma reference
const CHART_PLACEHOLDER = 'https://www.figma.com/api/mcp/asset/c40f42b6-3f01-47ad-a71f-43d9d27355d4';

export const TradingViewChart: React.FC = () => {
    const [selectedTimeframe, setSelectedTimeframe] = React.useState('1D');

    return (
        <View style={styles.container}>
            <View style={styles.chartArea}>
                <Image
                    source={{ uri: CHART_PLACEHOLDER }}
                    style={styles.chartImage}
                    contentFit="cover"
                />
            </View>

            <View style={styles.timeframesWrapper}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.timeframesContainer}
                >
                    {timeframes.map((tf) => (
                        <TouchableOpacity
                            key={tf}
                            onPress={() => setSelectedTimeframe(tf)}
                            activeOpacity={0.7}
                            style={styles.tfButton}
                        >
                            <View style={styles.tfContent}>
                                <Text style={[
                                    styles.tfText,
                                    selectedTimeframe === tf && styles.tfTextActive
                                ]}>
                                    {tf}
                                </Text>
                                {tf === 'More' && (
                                    <Image
                                        source={{ uri: imgArrowDown }}
                                        style={[styles.chevron, { tintColor: selectedTimeframe === tf ? colors.titleText : colors.bodyText }]}
                                    />
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: colors.bg,
    },
    chartArea: {
        width: '100%',
        height: 280,
    },
    chartImage: {
        width: '100%',
        height: '100%',
    },
    timeframesWrapper: {
        borderBottomWidth: 1,
        borderBottomColor: colors.bgStroke,
    },
    timeframesContainer: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        gap: 20,
    },
    tfButton: {
        justifyContent: 'center',
    },
    tfContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    tfText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
    },
    tfTextActive: {
        fontFamily: 'Manrope-SemiBold',
        color: colors.titleText,
    },
    chevron: {
        width: 12,
        height: 12,
    },
});
