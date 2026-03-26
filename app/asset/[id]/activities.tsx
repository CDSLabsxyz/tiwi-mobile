/**
 * Asset Activities Screen
 * Displays all activities for a specific asset
 * Matches Figma design exactly (node-id: 3279-120361, 3279-119615)
 */

import { WalletHeader } from "@/components/sections/Wallet";
import { CustomStatusBar } from "@/components/ui/custom-status-bar";
import { TokenPrice } from "@/components/ui/TokenPrice";
import { colors } from "@/constants/colors";
import { useUnifiedActivities } from "@/hooks/useUnifiedActivities";
import {
    fetchAssetDetail,
    type AssetActivity,
    type AssetDetail,
} from "@/services/walletService";
import { useAssetStore } from "@/store/assetStore";
import { useWalletStore } from "@/store/walletStore";
import { Image } from "expo-image";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Folder icon will be loaded from Figma URL

export default function AssetActivitiesScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const pathname = usePathname();
    const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();

    // State
    const { currentAsset } = useAssetStore();
    const [asset, setAsset] = useState<AssetDetail | null>(currentAsset);
    const [isAssetLoading, setIsAssetLoading] = useState(!currentAsset);

    const { address: activeWalletAddress } = useWalletStore();
    
    // Fetch unified activities base on wallet address
    const { data: unifiedActivities, isLoading: isUnifiedLoading } = useUnifiedActivities(100);

    // Filter and map activities specifically for this token
    const activities = React.useMemo(() => {
        const mappedUnifiedForAsset: AssetActivity[] = [];
        
        if (unifiedActivities && unifiedActivities.length > 0 && asset) {
            const tokenSymbol = asset.symbol.toUpperCase();
            const searchAddr = asset.address.toLowerCase();
            
            const relevantActivities = unifiedActivities.filter(act => {
                const actSymbol = (act.tokenSymbol || act.metadata?.tokenSymbol || act.metadata?.symbol || '').toUpperCase();
                const actAssetId = (act.metadata?.assetId || act.metadata?.tokenAddress || '').toLowerCase();
                
                const actChainId = act.chainId || act.metadata?.chainId;
                const isChainMatch = !actChainId || !asset.chainId || Number(actChainId) === Number(asset.chainId);
                
                const isSymbolMatch = actSymbol === tokenSymbol;
                const isAddressMatch = actAssetId === searchAddr;
                const isNativeMatch = tokenSymbol === 'ETH' && (!actSymbol || actSymbol === 'ETH');
                
                return isChainMatch && (isSymbolMatch || isAddressMatch || isNativeMatch);
            });

            relevantActivities.forEach(act => {
                const typeLower = (act.category || act.type || '').toLowerCase();
                const titleLower = (act.title || '').toLowerCase();
                
                let mappedType: AssetActivity["type"] = "swap";
                if (typeLower.includes("receive") || titleLower.includes("receive")) mappedType = "received";
                else if (typeLower.includes("send") || typeLower.includes("transfer") || titleLower.includes("send")) mappedType = "sent";
                else if (typeLower.includes("stake") && !typeLower.includes("unstake")) mappedType = "stake";
                else if (typeLower.includes("unstake")) mappedType = "unstake";
                
                const amountVal = act.amount || act.metadata?.amount || act.metadata?.fromAmount || '0';
                const actSymbol = act.tokenSymbol || act.metadata?.tokenSymbol || act.metadata?.symbol || tokenSymbol;
                
                const rawAmount = amountVal.toString().replace(new RegExp(`\\s*${actSymbol}$`, 'i'), '').trim();
                const displayAmount = `${rawAmount} ${actSymbol}`;
                
                const usdVal = act.usdValue || act.metadata?.usdValue || '$0.00';
                
                mappedUnifiedForAsset.push({
                    id: act.id,
                    type: mappedType,
                    amount: displayAmount,
                    usdValue: usdVal,
                    usdAmount: parseFloat(usdVal.replace(/[$,]/g, '') || '0'),
                    timestamp: act.timestamp,
                    date: act.date || new Date(act.timestamp).toLocaleDateString()
                });
            });
        }

        const allBase = asset?.activities || [];
        const mergedMap = new Map<string, AssetActivity>();
        
        allBase.forEach(a => mergedMap.set(a.id, a));
        mappedUnifiedForAsset.forEach(a => mergedMap.set(a.id, a));
        
        return Array.from(mergedMap.values())
            .sort((a, b) => b.timestamp - a.timestamp);
    }, [unifiedActivities, asset]);

    const isLoading = isAssetLoading || isUnifiedLoading;

    // Fetch asset detail ONLY if needed (direct link)
    useEffect(() => {
        const loadAsset = async () => {
            if (!id || currentAsset) return;

            setIsAssetLoading(true);
            try {
                const assetData = await fetchAssetDetail(id);
                setAsset(assetData);
            } catch (error) {
                console.error("Failed to fetch asset:", error);
            } finally {
                setIsAssetLoading(false);
            }
        };

        if (!currentAsset) {
            loadAsset();
        } else {
            setIsAssetLoading(false);
        }
    }, [id, currentAsset]);

    // Handlers
    const handleBackPress = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            // Navigate back to asset detail screen if no history
            const tabParam = tab ? `?tab=${tab}` : "";
            router.push(`/asset/${id}${tabParam}` as any);
        }
    };

    const handleIrisScanPress = () => {
        // TODO: Implement iris scan functionality
        console.log("Iris scan pressed");
    };

    const handleSettingsPress = () => {
        const currentRoute = pathname || `/asset/${id}/activities`;
        const tabParam = tab ? `?tab=${tab}` : "";
        router.push(`/settings?returnTo=${encodeURIComponent(currentRoute + tabParam)}` as any);
    };

    if (isLoading) {
        return (
            <View style={[{ flex: 1, backgroundColor: colors.bg }]}>
                <CustomStatusBar />
                <View style={{ paddingTop: top || 0 }}>
                    <WalletHeader
                        walletAddress={activeWalletAddress || ""}
                        onIrisScanPress={handleIrisScanPress}
                        onSettingsPress={handleSettingsPress}
                        showBackButton
                        onBackPress={handleBackPress}
                        showIrisScan={false}
                    />
                </View>
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <View style={{ gap: 20, width: '90%' }}>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <View key={i} style={{ height: 60, backgroundColor: colors.bgSemi, borderRadius: 12, opacity: 0.3 }} />
                        ))}
                    </View>
                </View>
            </View>
        );
    }

    const hasActivities = activities.length > 0;

    return (
        <View style={[{ flex: 1, backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Sticky Header */}
            <View
                style={{
                    paddingTop: top || 0,
                    backgroundColor: colors.bg,
                }}
            >
                <WalletHeader
                    walletAddress={activeWalletAddress || ""}
                    onIrisScanPress={handleIrisScanPress}
                    onSettingsPress={handleSettingsPress}
                    showBackButton
                    onBackPress={handleBackPress}
                    showIrisScan={false}
                    showSettings={true}
                />
            </View>

            {/* Scrollable Content */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                    alignItems: "center",
                    paddingBottom: bottom + 40,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* Main Container with Max Width */}
                <View style={{
                    width: '100%',
                    maxWidth: 500,
                    paddingHorizontal: 20,
                    alignItems: 'center',
                }}>

                    {/* Page Title */}
                    <View style={{ paddingVertical: 24, width: '100%' }}>
                        <Text
                            style={{
                                fontFamily: "Manrope-SemiBold",
                                fontSize: 20,
                                lineHeight: 28,
                                color: colors.titleText,
                                textAlign: "center",
                                textTransform: "capitalize",
                            }}
                        >
                            activities
                        </Text>
                    </View>

                    {hasActivities ? (
                        /* Activities List */
                        <View
                            style={{
                                width: '100%',
                                flexDirection: "column",
                                gap: 20,
                            }}
                        >
                            {activities.map((activity) => {
                                const isReceived = activity.type === "received";
                                const amountColor = isReceived ? "#498F00" : colors.titleText;

                                return (
                                    <View
                                        key={activity.id}
                                        style={{
                                            width: "100%",
                                            flexDirection: "row",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            paddingVertical: 4,
                                        }}
                                    >
                                        {/* Left: Type and Date */}
                                        <View style={{ flex: 1, gap: 4 }}>
                                            <Text
                                                style={{
                                                    fontFamily: "Manrope-Bold",
                                                    fontSize: 16,
                                                    lineHeight: 22,
                                                    color: colors.titleText,
                                                    textTransform: "capitalize",
                                                }}
                                            >
                                                {activity.type}
                                            </Text>
                                            <Text
                                                style={{
                                                    fontFamily: "Manrope-Medium",
                                                    fontSize: 12,
                                                    lineHeight: 16,
                                                    color: colors.mutedText,
                                                }}
                                            >
                                                {activity.date}
                                            </Text>
                                        </View>

                                        {/* Right: Amount and Value */}
                                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                                            <Text
                                                style={{
                                                    fontFamily: "Manrope-Bold",
                                                    fontSize: 16,
                                                    lineHeight: 22,
                                                    color: amountColor,
                                                    textAlign: "right",
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                {activity.amount}
                                            </Text>
                                            <TokenPrice
                                                amount={activity.usdAmount || activity.usdValue}
                                                style={{
                                                    fontFamily: "Manrope-Medium",
                                                    fontSize: 12,
                                                    lineHeight: 16,
                                                    color: colors.mutedText,
                                                    textAlign: "right",
                                                }}
                                            />
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        /* Premium Empty State */
                        <View
                            style={{
                                width: "100%",
                                alignItems: "center",
                                paddingTop: 40,
                                gap: 32,
                            }}
                        >
                            <View
                                style={{
                                    width: 180,
                                    height: 180,
                                    backgroundColor: colors.bgSemi,
                                    borderRadius: 90,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Image
                                    source={require("@/assets/wallet/folder-02.svg")}
                                    style={{
                                        width: 80,
                                        height: 80,
                                        opacity: 0.8,
                                    }}
                                    contentFit="contain"
                                />
                            </View>

                            <View style={{ alignItems: 'center', gap: 12 }}>
                                <Text
                                    style={{
                                        fontFamily: "Manrope-SemiBold",
                                        fontSize: 24,
                                        color: colors.titleText,
                                        textAlign: "center",
                                    }}
                                >
                                    No Activity Yet
                                </Text>
                                <Text
                                    style={{
                                        fontFamily: "Manrope-Regular",
                                        fontSize: 14,
                                        color: colors.mutedText,
                                        textAlign: "center",
                                        paddingHorizontal: 40,
                                        lineHeight: 20,
                                    }}
                                >
                                    When you make transactions, they will appear here in your activity feed.
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

