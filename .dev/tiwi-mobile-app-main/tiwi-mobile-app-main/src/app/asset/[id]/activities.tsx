/**
 * Asset Activities Screen
 * Displays all activities for a specific asset
 * Matches Figma design exactly (node-id: 3279-120361, 3279-119615)
 */

import React, { useState, useEffect } from "react";
import { View, ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, usePathname } from "expo-router";
import { Image } from "@/tw";
import { StatusBar } from "@/components/ui/StatusBar";
import { WalletHeader } from "@/components/sections/Wallet/WalletHeader";
import { colors } from "@/theme";
import { WALLET_ADDRESS } from "@/utils/wallet";
import {
    getAllAssetActivities,
    fetchAssetDetail,
    type AssetActivity,
    type AssetDetail,
} from "@/services/walletService";

// Folder icon will be loaded from Figma URL

export default function AssetActivitiesScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const pathname = usePathname();
    const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();

    // State
    const [activities, setActivities] = useState<AssetActivity[]>([]);
    const [asset, setAsset] = useState<AssetDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch activities and asset detail
    useEffect(() => {
        const loadData = async () => {
            if (!id) return;

            setIsLoading(true);
            try {
                const [activitiesData, assetData] = await Promise.all([
                    getAllAssetActivities(id),
                    fetchAssetDetail(id),
                ]);
                setActivities(activitiesData);
                setAsset(assetData);
            } catch (error) {
                console.error("Failed to fetch activities:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [id]);

    // Handlers
    const handleBackPress = () => {
        // Navigate back to asset detail screen
        const tabParam = tab ? `?tab=${tab}` : "";
        router.push(`/asset/${id}${tabParam}` as any);
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
        // TODO: Add skeleton loading UI
        return (
            <View className="flex-1" style={{ backgroundColor: colors.bg }}>
                <StatusBar />
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} />
            </View>
        );
    }

    const hasActivities = activities.length > 0;

    return (
        <View className="flex-1" style={{ backgroundColor: colors.bg }}>
            <StatusBar />

            {/* Sticky Header */}
            <View
                style={{
                    paddingTop: top || 0,
                    backgroundColor: colors.bg,
                }}
            >
                <WalletHeader
                    walletAddress={WALLET_ADDRESS}
                    onIrisScanPress={handleIrisScanPress}
                    onSettingsPress={handleSettingsPress}
                    showBackButton
                    onBackPress={handleBackPress}
                    showTransactionHistory
                    onTransactionHistoryPress={() => { }}
                />
            </View>

            {/* Scrollable Content */}
            <ScrollView
                className="flex-1"
                contentContainerStyle={{
                    paddingTop: hasActivities ? 24 : 0,
                    paddingBottom: (bottom || 16) + 24,
                    alignItems: "center",
                }}
                showsVerticalScrollIndicator={false}
            >
                {hasActivities ? (
                    <>
                        {/* Title - Only shown when there are activities */}
                        <View
                            style={{
                                width: 357,
                                maxWidth: "100%",
                                marginBottom: 0,
                                paddingTop: 24,
                            }}
                        >
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

                        {/* Activities List */}
                        <View
                            style={{
                                width: 350,
                                maxWidth: "100%",
                                flexDirection: "column",
                                gap: 18,
                                marginTop: 18,
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
                                            alignItems: "flex-start",
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        {/* Left: Type and Date */}
                                        <View
                                            style={{
                                                flexDirection: "column",
                                                alignItems: "flex-start",
                                                gap: 4,
                                                width: 97,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontFamily: "Manrope-Bold",
                                                    fontSize: 16,
                                                    lineHeight: 24,
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
                                                    lineHeight: 18,
                                                    color: colors.bodyText,
                                                }}
                                            >
                                                {activity.date}
                                            </Text>
                                        </View>

                                        {/* Right: Amount and USD Value */}
                                        <View
                                            style={{
                                                flexDirection: "column",
                                                alignItems: "flex-end",
                                                gap: 4,
                                                width: 129,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontFamily: "Manrope-Medium",
                                                    fontSize: 16,
                                                    lineHeight: 24,
                                                    color: amountColor,
                                                    textAlign: "right",
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                {activity.amount}
                                            </Text>
                                            <Text
                                                style={{
                                                    fontFamily: "Manrope-Medium",
                                                    fontSize: 12,
                                                    lineHeight: 18,
                                                    color: colors.bodyText,
                                                    textAlign: "right",
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                {activity.usdValue}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </>
                ) : (
                    /* Empty State */
                    <View
                        style={{
                            width: "100%",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 32,
                            paddingTop: 24,
                        }}
                    >
                        {/* Title - Shown in empty state */}
                        <View
                            style={{
                                width: 357,
                                maxWidth: "100%",
                            }}
                        >
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

                        {/* Empty State Content */}
                        <View
                            style={{
                                width: 235,
                                maxWidth: "100%",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 32,
                            }}
                        >
                            {/* Folder Icon */}
                            <View
                                style={{
                                    width: 235,
                                    height: 235,
                                }}
                            >
                                <Image
                                    source={require("@/assets/wallet/folder-02.svg")}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                    }}
                                    contentFit="contain"
                                />
                            </View>

                            {/* Empty State Text */}
                            <Text
                                style={{
                                    fontFamily: "Manrope-SemiBold",
                                    fontSize: 24,
                                    lineHeight: 36,
                                    color: colors.titleText,
                                    textAlign: "center",
                                    textTransform: "capitalize",
                                }}
                            >
                                No Activity Yet
                            </Text>
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

