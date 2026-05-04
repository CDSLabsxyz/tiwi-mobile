import { colors } from "@/constants";
import { useSecurityStore } from "@/store/securityStore";
import { ChainType, useWalletStore } from "@/store/walletStore";
import { truncateAddress } from "@/utils/wallet";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useMemo, useRef, useState } from "react";
import {
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
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

// Unified address book entry — covers both user-imported whitelist contacts
// and the user's own multi-chain wallets (EVM/Solana/Tron/TON/Cosmos/Osmosis).
type BookEntry = {
    name: string;
    address: string;
    chain?: ChainType;
    /** "wallet" rows come from the user's walletGroups; "contact" rows come
     *  from the security store's whitelistedAddresses. */
    source: "wallet" | "contact";
    /** WalletGroup id — only present for "wallet" rows. Needed to rename
     *  the group when the user edits the displayed name. */
    groupId?: string;
};

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
    const walletGroups = useWalletStore((s) => s.walletGroups);
    const addressNicknames = useWalletStore((s) => s.addressNicknames);
    const setAddressNickname = useWalletStore((s) => s.setAddressNickname);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedList, setSelectedList] = useState<string[]>([]);
    /** Address (lowercased) of the row currently being renamed. Per-address
     *  rather than per-group so editing the SOL row leaves the TRON row
     *  untouched. */
    const [editingAddress, setEditingAddress] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState("");

    // Lift the whole sheet content above the keyboard, same approach used
    // by the TIWI AI input — IME inset comes straight from native via
    // reanimated, so it stays correct in release APKs with edge-to-edge.
    const keyboard = useAnimatedKeyboard();
    const keyboardPaddingStyle = useAnimatedStyle(() => ({
        paddingBottom: keyboard.height.value,
    }));

    const listRef = useRef<FlatList<BookEntry>>(null);

    const beginEdit = (address: string, currentName: string) => {
        const key = address.toLowerCase();
        setEditingAddress(key);
        setEditDraft(currentName);
        // Center the row being edited in the visible list area so the input
        // sits comfortably above the keyboard once it animates in.
        const idx = filteredAddresses.findIndex(
            (e) => e.address.toLowerCase() === key
        );
        if (idx >= 0) {
            requestAnimationFrame(() => {
                listRef.current?.scrollToIndex({
                    index: idx,
                    animated: true,
                    viewPosition: 0.2,
                });
            });
        }
    };

    const cancelEdit = () => {
        setEditingAddress(null);
        setEditDraft("");
    };

    const commitEdit = () => {
        const trimmed = editDraft.trim();
        if (editingAddress && trimmed) {
            setAddressNickname(editingAddress, trimmed);
        }
        cancelEdit();
    };

    // Flatten every non-empty (wallet × chain) pair into its own entry, then
    // append the manually-curated whitelist. The wallet's name carries
    // through verbatim — the chain is shown as a small suffix so the user
    // can tell the SOL address apart from the EVM one.
    //
    // Dedupe across sources by address: if a whitelist contact happens to be
    // one of the user's own wallet addresses (common — users often whitelist
    // themselves), keep the wallet entry (which has the chain badge) and
    // drop the un-badged duplicate.
    const bookEntries = useMemo<BookEntry[]>(() => {
        const seen = new Set<string>();
        const out: BookEntry[] = [];

        for (const g of walletGroups) {
            for (const [chain, addr] of Object.entries(g.addresses) as [ChainType, string | undefined][]) {
                if (!addr) continue;
                const key = addr.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                out.push({
                    name: addressNicknames[key] ?? g.name,
                    address: addr,
                    chain,
                    source: "wallet",
                    groupId: g.id,
                });
            }
        }

        for (const w of whitelistedAddresses) {
            const key = w.address.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
                name: w.name,
                address: w.address,
                source: "contact",
            });
        }

        return out;
    }, [walletGroups, whitelistedAddresses, addressNicknames]);

    const filteredAddresses = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return bookEntries;
        return bookEntries.filter(
            (item) =>
                item.name.toLowerCase().includes(q) ||
                item.address.toLowerCase().includes(q) ||
                (item.chain?.toLowerCase().includes(q) ?? false)
        );
    }, [bookEntries, searchQuery]);

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

    const renderItem = ({ item }: { item: BookEntry }) => {
        const isSelected = multiSelect
            ? selectedList.includes(item.address)
            : selectedAddress?.toLowerCase() === item.address.toLowerCase();
        const isEditing = item.source === "wallet" && item.address.toLowerCase() === editingAddress;
        const canEdit = item.source === "wallet";

        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                    if (isEditing) return; // don't trigger selection while typing
                    handleToggleSelect(item.address);
                }}
                style={styles.itemContainer}
            >
                <View style={styles.itemLeft}>
                    <View style={styles.avatarContainer}>
                        <Image source={UserIcon} style={styles.userIcon} contentFit="contain" />
                    </View>
                    <View style={styles.itemInfo}>
                        <View style={styles.itemNameRow}>
                            {isEditing ? (
                                <TextInput
                                    value={editDraft}
                                    onChangeText={setEditDraft}
                                    onSubmitEditing={commitEdit}
                                    onBlur={commitEdit}
                                    autoFocus
                                    selectTextOnFocus
                                    placeholder="Wallet name"
                                    placeholderTextColor={colors.bodyText}
                                    style={styles.editInput}
                                    returnKeyType="done"
                                />
                            ) : (
                                <Text style={styles.itemName}>{item.name}</Text>
                            )}
                            {item.chain && (
                                <View style={styles.chainBadge}>
                                    <Text style={styles.chainBadgeText}>{item.chain}</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.itemAddress}>{truncateAddress(item.address, 10, 8)}</Text>
                    </View>
                </View>
                <View style={styles.itemActions}>
                    {canEdit && !isEditing && (
                        <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={(e) => {
                                e.stopPropagation();
                                beginEdit(item.address, item.name);
                            }}
                            style={styles.editIconButton}
                        >
                            <Feather name="edit-2" size={16} color={colors.bodyText} />
                        </TouchableOpacity>
                    )}
                    {isEditing && (
                        <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={(e) => {
                                e.stopPropagation();
                                commitEdit();
                            }}
                            style={styles.editIconButton}
                        >
                            <Feather name="check" size={18} color={colors.primaryCTA} />
                        </TouchableOpacity>
                    )}
                    {isSelected && !isEditing && (
                        <Image source={CheckIcon} style={styles.checkIcon} contentFit="contain" />
                    )}
                </View>
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
                <Animated.View style={[styles.sheet, { paddingBottom: bottom || 20 }, keyboardPaddingStyle]}>
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
                        ref={listRef}
                        data={filteredAddresses}
                        keyExtractor={(item) => `${item.source}-${item.chain ?? "wl"}-${item.address}`}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        keyboardShouldPersistTaps="handled"
                        // scrollToIndex needs this fallback for variable row heights
                        // when the target hasn't been laid out yet.
                        onScrollToIndexFailed={({ index, averageItemLength }) => {
                            listRef.current?.scrollToOffset({
                                offset: averageItemLength * Math.max(0, index - 1),
                                animated: true,
                            });
                        }}
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
                </Animated.View>
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
    itemNameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    itemName: {
        fontFamily: "Manrope-SemiBold",
        fontSize: 14,
        color: colors.titleText,
    },
    chainBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: colors.bgCards,
    },
    chainBadgeText: {
        fontFamily: "Manrope-SemiBold",
        fontSize: 10,
        color: colors.bodyText,
        textTransform: "uppercase",
    },
    editInput: {
        fontFamily: "Manrope-SemiBold",
        fontSize: 14,
        color: colors.titleText,
        padding: 0,
        minWidth: 120,
        borderBottomWidth: 1,
        borderBottomColor: colors.primaryCTA,
        paddingVertical: 2,
    },
    itemActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    editIconButton: {
        padding: 4,
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
