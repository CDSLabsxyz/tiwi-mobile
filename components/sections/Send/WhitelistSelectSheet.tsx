import { colors } from "@/constants";
import { useSecurityStore, WhitelistedAddress } from "@/store/securityStore";
import { truncateAddress } from "@/utils/wallet";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import {
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
const UserIcon = require("@/assets/settings/user-circle.svg");
const CheckIcon = require("@/assets/swap/checkmark-circle-01.svg");

interface WhitelistSelectSheetProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (address: string) => void;
    selectedAddress?: string;
    multiSelect?: boolean;
    onMultiSelect?: (addresses: string[]) => void;
}

export const WhitelistSelectSheet: React.FC<WhitelistSelectSheetProps> = ({
    visible,
    onClose,
    onSelect,
    selectedAddress,
    multiSelect = false,
    onMultiSelect,
}) => {
    const { bottom } = useSafeAreaInsets();
    const { whitelistedAddresses } = useSecurityStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedList, setSelectedList] = useState<string[]>([]);

    const filteredAddresses = whitelistedAddresses.filter(
        (item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleToggleSelect = (address: string) => {
        if (multiSelect) {
            if (selectedList.includes(address)) {
                setSelectedList(selectedList.filter((a) => a !== address));
            } else {
                setSelectedList([...selectedList, address]);
            }
        } else {
            onSelect(address);
            onClose();
        }
    };

    const handleConfirmMulti = () => {
        if (onMultiSelect) {
            onMultiSelect(selectedList);
        }
        onClose();
    };

    const renderItem = ({ item }: { item: WhitelistedAddress }) => {
        const isSelected = multiSelect
            ? selectedList.includes(item.address)
            : selectedAddress?.toLowerCase() === item.address.toLowerCase();

        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleToggleSelect(item.address)}
                style={styles.itemContainer}
            >
                <View style={styles.itemLeft}>
                    <View style={styles.avatarContainer}>
                        <Image source={UserIcon} style={styles.userIcon} contentFit="contain" />
                    </View>
                    <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemAddress}>{truncateAddress(item.address, 10, 8)}</Text>
                    </View>
                </View>
                {isSelected && (
                    <Image source={CheckIcon} style={styles.checkIcon} contentFit="contain" />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity
                    style={styles.dismissArea}
                    activeOpacity={1}
                    onPress={onClose}
                />
                <View style={[styles.sheet, { paddingBottom: bottom || 20 }]}>
                    <View style={styles.header}>
                        <View style={styles.handle} />
                        <View style={styles.headerTitleRow}>
                            <Text style={styles.title}>Address Book</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Feather name="x" size={24} color={colors.bodyText} style={styles.closeIcon} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.searchContainer}>
                        <Feather name="search" size={24} color={colors.bodyText} style={styles.searchIcon} />
                        <TextInput
                            placeholder="Search by name or address"
                            placeholderTextColor={colors.bodyText}
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    <FlatList
                        data={filteredAddresses}
                        keyExtractor={(item) => item.address}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>
                                    {searchQuery ? "No matching addresses found" : "Your address book is empty"}
                                </Text>
                            </View>
                        }
                    />

                    {multiSelect && selectedList.length > 0 && (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleConfirmMulti}
                            style={styles.confirmButton}
                        >
                            <Text style={styles.confirmButtonText}>
                                Add {selectedList.length} Addresses
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        justifyContent: "flex-end",
    },
    dismissArea: {
        flex: 1,
    },
    sheet: {
        backgroundColor: colors.bg,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        maxHeight: "80%",
    },
    header: {
        alignItems: "center",
        paddingTop: 12,
        paddingBottom: 20,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: colors.bgCards,
        borderRadius: 2,
        marginBottom: 20,
    },
    headerTitleRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
    },
    title: {
        fontFamily: "Manrope-SemiBold",
        fontSize: 18,
        color: colors.titleText,
    },
    closeButton: {
        position: "absolute",
        right: 24,
    },
    closeIcon: {
        width: 24,
        height: 24,
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.bgSemi,
        borderRadius: 12,
        marginHorizontal: 24,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 16,
    },
    searchIcon: {
        width: 20,
        height: 20,
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontFamily: "Manrope-Medium",
        fontSize: 14,
        color: colors.titleText,
        padding: 0,
    },
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    itemContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.bgCards + "40",
    },
    itemLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    avatarContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.bgCards,
        alignItems: "center",
        justifyContent: "center",
    },
    userIcon: {
        width: 20,
        height: 20,
    },
    itemInfo: {
        gap: 2,
    },
    itemName: {
        fontFamily: "Manrope-SemiBold",
        fontSize: 14,
        color: colors.titleText,
    },
    itemAddress: {
        fontFamily: "Manrope-Regular",
        fontSize: 12,
        color: colors.bodyText,
    },
    checkIcon: {
        width: 20,
        height: 20,
    },
    emptyContainer: {
        paddingVertical: 60,
        alignItems: "center",
    },
    emptyText: {
        fontFamily: "Manrope-Medium",
        fontSize: 14,
        color: colors.bodyText,
        textAlign: "center",
    },
    confirmButton: {
        marginHorizontal: 24,
        marginTop: 10,
        height: 54,
        borderRadius: 100,
        backgroundColor: colors.primaryCTA,
        alignItems: "center",
        justifyContent: "center",
    },
    confirmButtonText: {
        fontFamily: "Manrope-SemiBold",
        fontSize: 16,
        color: colors.bg,
    },
});
