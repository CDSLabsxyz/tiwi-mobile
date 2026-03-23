import { api, FaqItem as FAQ } from '@/lib/mobile/api-client';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { SettingsHeader } from '@/components/ui/settings-header';
import { colors } from '@/constants/colors';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    FlatList,
    LayoutAnimation,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* 
 * Enable LayoutAnimation for Android
 */
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SearchIcon = require('@/assets/swap/search-01.svg');
const ChevronDownIcon = require('@/assets/home/arrow-down-01.svg');

/**
 * Fallback FAQs matching Figma design exactly (node-id: 3279-121333)
 */
const FALLBACK_FAQS: FAQ[] = [
    {
        id: '1',
        question: "Is Tiwi Protocol custodial?",
        answer: "No, Tiwi Protocol is a fully non-custodial decentralized platform. You always maintain 100% control of your private keys and assets. We never have access to your funds.",
        category: 'General',
    },
    {
        id: '2',
        question: "Can I pay gas without native tokens?",
        answer: "Yes! Our Omni-Paymaster service allows you to pay gas fees using stablecoins (USDT/USDC) or our native TIWI tokens, so you don't need to worry about holding native chain gas tokens (like ETH or BNB) on every network.",
        category: 'Transactions',
    },
    {
        id: '3',
        question: "Which chains are supported?",
        answer: "We support major EVM chains including BNB Chain, Ethereum, Arbitrum, Base, and Polygon. We are also expanding to non-EVM chains like Solana and Bitcoin Layer 2s.",
        category: 'Chains',
    },
    {
        id: '4',
        question: "What are the lending limits?",
        answer: "Lending limits and Max LTV (Loan-to-Value) depend on the asset's tier. Blue-chip assets like BTC and ETH have higher limits (up to 80%), while newer tokens may have lower limits to maintain protocol safety.",
        category: 'Lending',
    },
    {
        id: '5',
        question: "Can I stake NFTs?",
        answer: "Yes, Tiwi Protocol supports NFT staking for verified collections. This allows you to earn protocol rewards (Yield) while keeping the original NFT in your wallet's staking contract.",
        category: 'Staking',
    },
    {
        id: '6',
        question: "How do merchants use TIWI Pay?",
        answer: "Merchants can easily integrate TIWI Pay via our Developer SDK or by generating a payment QR code. Customers can then pay in any supported crypto, while merchants receive their preferred stablecoin instantly.",
        category: 'General',
    }
];

/**
 * FAQ Item Component
 * Accordion style with expansion animation
 */
function FAQItem({ item, isExpanded, onToggle }: { item: FAQ; isExpanded: boolean; onToggle: () => void }) {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onToggle}
            style={[
                styles.faqCard,
                isExpanded && styles.faqCardExpanded
            ]}
        >
            <View style={styles.faqHeader}>
                <Text style={styles.questionText}>{item.question}</Text>
                <View style={[styles.iconContainer, isExpanded && styles.iconContainerRotated]}>
                    <Image
                        source={ChevronDownIcon}
                        style={styles.chevronIcon}
                        contentFit="contain"
                        tintColor="#B5B5B5"
                    />
                </View>
            </View>
            {isExpanded && (
                <View style={styles.answerContainer}>
                    <Text style={styles.answerText}>{item.answer}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

/**
 * FAQs Screen
 * Matches Figma design (node-id: 3279-121333)
 */
export default function FaqsScreen() {
    const router = useRouter();
    const { bottom } = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['faqs'],
        queryFn: () => api.faqs.list(),
    });

    const faqList = useMemo(() => {
        const sourceList = data?.faqs?.length ? data.faqs : FALLBACK_FAQS;
        if (!searchQuery.trim()) return sourceList;

        const query = searchQuery.toLowerCase();
        return sourceList.filter(f =>
            f.question.toLowerCase().includes(query) ||
            f.answer.toLowerCase().includes(query)
        );
    }, [data, searchQuery]);

    const handleToggle = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <View style={styles.container}>
            <CustomStatusBar />
            <SettingsHeader
                title="FAQs"
                showBack={true}
                onBack={() => router.back()}
            />

            <View style={styles.content}>
                {/* Search Bar - Matching Figma: h[48px], bg-[#1B1B1B], rounded-[20px] */}
                <View style={styles.searchBarContainer}>
                    <Image source={SearchIcon} style={styles.searchIcon} contentFit="contain" />
                    <TextInput
                        placeholder="Search"
                        placeholderTextColor="rgba(255, 255, 255, 0.7)"
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {isLoading && !data ? (
                    <View style={styles.loaderContainer}>
                        <TIWILoader size={100} />
                    </View>
                ) : (
                    <FlatList
                        data={faqList}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <FAQItem
                                item={item}
                                isExpanded={expandedId === item.id}
                                onToggle={() => handleToggle(item.id)}
                            />
                        )}
                        contentContainerStyle={[
                            styles.listContent,
                            { paddingBottom: bottom + 20 }
                        ]}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No results matching your search</Text>
                            </View>
                        )}
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#010501', // Figma: Dark/bg
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    searchBarContainer: {
        height: 48,
        backgroundColor: '#1B1B1B', // Figma: bg-[#1b1b1b]
        borderRadius: 20, // Figma: rounded-[20px]
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24, // Figma: left-[24px]
        marginBottom: 24, // Spacing from design
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    searchIcon: {
        width: 16,
        height: 16,
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: '#FFFFFF',
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        gap: 8, // Figma: gap-[8px]
    },
    faqCard: {
        backgroundColor: '#121712', // Figma: bg-[#121712]
        borderRadius: 16, // Figma: rounded-[16px]
        paddingHorizontal: 24, // Figma: px-[24px]
        paddingVertical: 20, // Figma: py-[20px]
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    faqCardExpanded: {
        borderColor: colors.bgStroke,
    },
    faqHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    questionText: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        fontSize: 16, // Figma: text-[16px]
        color: '#B5B5B5', // Figma: text-[#b5b5b5]
        lineHeight: 22,
    },
    iconContainer: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainerRotated: {
        transform: [{ rotate: '180deg' }],
    },
    chevronIcon: {
        width: 24,
        height: 24,
    },
    answerContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
    },
    answerText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
        lineHeight: 21,
    },
    emptyContainer: {
        marginTop: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.mutedText,
    },
});
