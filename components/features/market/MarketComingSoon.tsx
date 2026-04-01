import { colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type ComingSoonMarket = 'Spot' | 'Perps' | 'Stocks' | 'Forex';

interface MarketComingSoonProps {
    market: ComingSoonMarket;
    onOpenSwap: () => void;
}

const CONTENT: Record<ComingSoonMarket, {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    title: string;
    highlight: string;
    titleEnd: string;
    description: string;
    tags: string[];
    features: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[];
    panelTitle: string;
    panelDesc: string;
    expectations: string[];
}> = {
    Spot: {
        icon: 'trending-up',
        label: 'Spot Launch',
        title: 'A sharper',
        highlight: 'spot',
        titleEnd: 'market is taking shape',
        description: 'TIWI Protocol Spot is being shaped for cleaner discovery, stronger listings, and a launch experience that makes new users curious and active traders want to stay.',
        tags: ['Curated pairs', 'Faster discovery', 'Launch-driven listings'],
        features: [
            { icon: 'sparkles', title: 'Launch-ready markets', desc: 'A tighter mix of majors, ecosystem favorites, and high-attention tokens worth watching from day one.' },
            { icon: 'pulse', title: 'Cleaner execution', desc: 'Built to feel simple, fast, and confident so users can act without friction.' },
            { icon: 'shield-checkmark', title: 'A stronger first impression', desc: 'Featured listings and spotlight campaigns will help each launch feel deliberate.' },
        ],
        panelTitle: 'What users should expect',
        panelDesc: 'Spot is being positioned as a daily entry point into the TIWI Protocol ecosystem.',
        expectations: [
            'Cleaner market discovery that highlights what matters fast.',
            'Launch campaigns that give new listings real momentum.',
            'A smoother bridge between swap, market discovery, and the wider TIWI ecosystem.',
        ],
    },
    Perps: {
        icon: 'rocket',
        label: 'Perps Launch',
        title: 'High-conviction',
        highlight: 'perps',
        titleEnd: 'are on the roadmap',
        description: 'TIWI Protocol Perps are being prepared to feel serious from the first session, with faster context, cleaner execution, and a launch presence built for active traders.',
        tags: ['High-attention contracts', 'Trader-focused UX', 'Risk-aware rollout'],
        features: [
            { icon: 'pulse', title: 'Responsive trade flow', desc: 'A cleaner setup that helps traders react quickly when the market moves.' },
            { icon: 'bar-chart', title: 'Conviction-first screens', desc: 'Market context and performance signals designed to feel sharp and focused.' },
            { icon: 'shield-checkmark', title: 'Risk-aware experience', desc: 'Leverage feels intentional rather than overwhelming.' },
        ],
        panelTitle: 'Why the launch matters',
        panelDesc: 'Perps signal that TIWI Protocol can serve serious market attention, not just casual exploration.',
        expectations: [
            'A stronger presence for high-interest contracts.',
            'A cleaner route from discovery to action when volatility shows up.',
            'A launch designed to feel bold, focused, and worthy of trader curiosity.',
        ],
    },
    Stocks: {
        icon: 'business',
        label: 'Stocks Launch',
        title: 'Familiar',
        highlight: 'stocks',
        titleEnd: 'are getting the TIWI treatment',
        description: 'Stocks will bring recognizable names into the experience, giving users a familiar doorway into TIWI Protocol while expanding the platform beyond crypto.',
        tags: ['Recognizable tickers', 'Cross-market narratives', 'Simple discovery'],
        features: [
            { icon: 'sparkles', title: 'Household-name assets', desc: 'Names users already watch, making the product feel broader and more relevant.' },
            { icon: 'trending-up', title: 'Narrative crossover', desc: 'Connect market conversations across crypto, macro, and broader investor attention.' },
            { icon: 'shield-checkmark', title: 'Approachable by design', desc: 'Simple enough for new users to explore without noise.' },
        ],
        panelTitle: 'What this unlocks',
        panelDesc: 'Stocks give TIWI Protocol a wider horizon as a true all-in-one market destination.',
        expectations: [
            'A mainstream market layer that feels instantly recognizable.',
            'New reasons for users to return daily beyond crypto watchlists.',
            'A launch that makes the product feel bigger, smarter, and more complete.',
        ],
    },
    Forex: {
        icon: 'globe',
        label: 'Forex Launch',
        title: 'Global',
        highlight: 'forex',
        titleEnd: 'is coming to TIWI Protocol',
        description: 'Forex is being shaped as a clean, high-signal category for users who want to follow macro movement and major currency pairs within the TIWI ecosystem.',
        tags: ['Major FX pairs', 'Macro awareness', 'Unified market view'],
        features: [
            { icon: 'globe', title: 'High-signal pairs', desc: 'Recognizable FX markets that add weight and global relevance to the platform.' },
            { icon: 'bar-chart', title: 'Macro-driven context', desc: 'Track currency momentum alongside everything else in one place.' },
            { icon: 'shield-checkmark', title: 'One ecosystem feel', desc: 'Moving from crypto into FX feels natural, not stitched together.' },
        ],
        panelTitle: 'The expectation this creates',
        panelDesc: 'Forex positions TIWI Protocol as a broader financial experience.',
        expectations: [
            'A more global product story with major market coverage in one place.',
            'A cleaner way for users to stay close to macro flows.',
            'A launch signaling TIWI Protocol is a wider, more serious market platform.',
        ],
    },
};

export const MarketComingSoon: React.FC<MarketComingSoonProps> = ({ market, onOpenSwap }) => {
    const config = CONTENT[market];
    const router = useRouter();

    return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.container}>
                {/* Badge */}
                <View style={styles.badge}>
                    <View style={styles.badgeDot} />
                    <Text style={styles.badgeText}>COMING SOON</Text>
                </View>

                {/* Title */}
                <Text style={styles.title}>
                    {config.title}{' '}
                    <Text style={styles.titleHighlight}>{config.highlight}</Text>{' '}
                    {config.titleEnd}
                </Text>

                {/* Description */}
                <Text style={styles.description}>{config.description}</Text>

                {/* Tags */}
                <View style={styles.tagsRow}>
                    {config.tags.map(tag => (
                        <View key={tag} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                        </View>
                    ))}
                </View>

                {/* CTA Buttons */}
                <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/swap')} activeOpacity={0.8}>
                    <Text style={styles.primaryBtnText}>Explore Live Swap</Text>
                    <Ionicons name="arrow-forward" size={16} color="#010501" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(tabs)/earn' as any)} activeOpacity={0.8}>
                    <Text style={styles.secondaryBtnText}>Explore Staking</Text>
                </TouchableOpacity>

                {/* Hero Icon */}
                <View style={styles.heroCircleOuter}>
                    <View style={styles.heroCircle}>
                        <Ionicons name={config.icon as any} size={56} color={colors.primaryCTA} />
                        <Text style={styles.heroLabel}>{config.label}</Text>
                    </View>
                </View>

                {/* Feature Cards */}
                {config.features.map(f => (
                    <View key={f.title} style={styles.featureCard}>
                        <View style={styles.featureIconBox}>
                            <Ionicons name={f.icon as any} size={18} color={colors.primaryCTA} />
                        </View>
                        <Text style={styles.featureTitle}>{f.title}</Text>
                        <Text style={styles.featureDesc}>{f.desc}</Text>
                    </View>
                ))}

                {/* Panel */}
                <View style={styles.panel}>
                    <Text style={styles.panelLabel}>LAUNCH EXPECTATION</Text>
                    <Text style={styles.panelTitle}>{config.panelTitle}</Text>
                    <Text style={styles.panelDesc}>{config.panelDesc}</Text>

                    {config.expectations.map(item => (
                        <View key={item} style={styles.expectationRow}>
                            <View style={styles.expectationIcon}>
                                <Ionicons name="arrow-forward" size={14} color={colors.primaryCTA} />
                            </View>
                            <Text style={styles.expectationText}>{item}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollContent: { paddingBottom: 120 },
    container: { padding: 20, gap: 16 },
    badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8, backgroundColor: 'rgba(177,241,40,0.1)', borderWidth: 1, borderColor: 'rgba(177,241,40,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
    badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryCTA },
    badgeText: { fontFamily: 'Manrope-Bold', fontSize: 11, color: colors.primaryCTA, letterSpacing: 2 },
    title: { fontFamily: 'Manrope-Bold', fontSize: 28, color: '#FFFFFF', textAlign: 'center', lineHeight: 36 },
    titleHighlight: { color: colors.primaryCTA },
    description: { fontFamily: 'Manrope-Regular', fontSize: 14, color: '#8A929A', textAlign: 'center', lineHeight: 22 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
    tag: { borderWidth: 1, borderColor: '#1F261E', backgroundColor: '#0B0F0A', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    tagText: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: '#D6DBD5' },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primaryCTA, borderRadius: 28, height: 50 },
    primaryBtnText: { fontFamily: 'Manrope-Bold', fontSize: 15, color: '#010501' },
    secondaryBtn: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1F261E', borderRadius: 28, height: 50 },
    secondaryBtnText: { fontFamily: 'Manrope-SemiBold', fontSize: 15, color: '#FFFFFF' },
    heroCircleOuter: { alignSelf: 'center', padding: 2, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(177,241,40,0.15)', marginVertical: 8 },
    heroCircle: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#010501', alignItems: 'center', justifyContent: 'center' },
    heroLabel: { fontFamily: 'Manrope-Bold', fontSize: 10, color: '#D8E8BF', letterSpacing: 2, marginTop: 12, textTransform: 'uppercase' },
    featureCard: { backgroundColor: '#0B0F0A', borderWidth: 1, borderColor: '#1F261E', borderRadius: 16, padding: 20, gap: 8 },
    featureIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(177,241,40,0.1)', alignItems: 'center', justifyContent: 'center' },
    featureTitle: { fontFamily: 'Manrope-Bold', fontSize: 17, color: '#FFFFFF' },
    featureDesc: { fontFamily: 'Manrope-Regular', fontSize: 13, color: '#8A929A', lineHeight: 20 },
    panel: { backgroundColor: 'rgba(177,241,40,0.05)', borderWidth: 1, borderColor: 'rgba(177,241,40,0.15)', borderRadius: 20, padding: 20, gap: 12 },
    panelLabel: { fontFamily: 'Manrope-Bold', fontSize: 10, color: colors.primaryCTA, letterSpacing: 2 },
    panelTitle: { fontFamily: 'Manrope-Bold', fontSize: 22, color: '#FFFFFF' },
    panelDesc: { fontFamily: 'Manrope-Regular', fontSize: 13, color: '#9AA29A', lineHeight: 20 },
    expectationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#0B0F0A', borderWidth: 1, borderColor: '#1F261E', borderRadius: 14, padding: 12 },
    expectationIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(177,241,40,0.12)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    expectationText: { fontFamily: 'Manrope-Regular', fontSize: 13, color: '#D4DBD1', lineHeight: 20, flex: 1 },
});
