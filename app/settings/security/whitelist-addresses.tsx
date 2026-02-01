import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { useSecurityStore, WhitelistedAddress } from '@/store/securityStore';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    BackHandler,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChevronLeftIcon = require('../../../assets/swap/arrow-left-02.svg');
const Book02Icon = require('../../../assets/settings/book-02.svg');

export default function WhitelistAddressesScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { whitelistedAddresses, addWhitelistedAddress, removeWhitelistedAddress } = useSecurityStore();

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [newName, setNewName] = useState('');
    const [newAddress, setNewAddress] = useState('');

    // Handle phone back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (isModalVisible) {
                setIsModalVisible(false);
                return true;
            }
            handleBackPress();
            return true;
        });

        return () => backHandler.remove();
    }, [isModalVisible]);

    const handleBackPress = () => {
        router.back();
    };

    const handleAddAddress = () => {
        if (!newName || !newAddress) return;

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        addWhitelistedAddress(newAddress, newName);
        setNewName('');
        setNewAddress('');
        setIsModalVisible(false);
    };

    const handleRemove = (address: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        removeWhitelistedAddress(address);
    };

    const renderItem = ({ item }: { item: WhitelistedAddress }) => (
        <View style={styles.addressCard}>
            <View style={styles.addressInfo}>
                <Text style={styles.addressName}>{item.name}</Text>
                <Text style={styles.addressValue} numberOfLines={1} ellipsizeMode="middle">
                    {item.address}
                </Text>
            </View>
            <TouchableOpacity
                onPress={() => handleRemove(item.address)}
                style={styles.deleteButton}
            >
                <Text style={styles.deleteText}>Remove</Text>
            </TouchableOpacity>
        </View>
    );

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
                        {whitelistedAddresses.length === 0 ? "Whitelist Address" : "Whitelisted Addresses"}
                    </Text>
                    <View style={styles.placeholder} />
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {whitelistedAddresses.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                        <View style={styles.iconContainer}>
                            <Image
                                source={Book02Icon}
                                style={styles.fullSize}
                                contentFit="contain"
                            />
                        </View>
                        <View style={styles.actionContainer}>
                            <Text style={styles.emptyTitle}>
                                No Address Added Yet
                            </Text>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => setIsModalVisible(true)}
                                style={styles.addButton}
                            >
                                <Text style={styles.addButtonText}>
                                    Add Address
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={styles.listContainer}>
                        <FlatList
                            data={whitelistedAddresses}
                            renderItem={renderItem}
                            keyExtractor={item => item.address}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                        />
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setIsModalVisible(true)}
                            style={styles.floatingAddButton}
                        >
                            <Text style={styles.addButtonText}>Add New Address</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Add Address Modal */}
            <Modal
                visible={isModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        activeOpacity={1}
                        onPress={() => setIsModalVisible(false)}
                    />
                    <View style={[styles.modalContent, { paddingBottom: (bottom || 24) + 24 }]}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Add Whitelisted Address</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Label / Name</Text>
                            <TextInput
                                value={newName}
                                onChangeText={setNewName}
                                placeholder="e.g. My Ledger"
                                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                style={styles.textInput}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Wallet Address</Text>
                            <TextInput
                                value={newAddress}
                                onChangeText={setNewAddress}
                                placeholder="0x..."
                                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                style={styles.textInput}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleAddAddress}
                            disabled={!newName || !newAddress}
                            style={[
                                styles.confirmButton,
                                { backgroundColor: (newName && newAddress) ? '#B4FF3B' : 'rgba(255, 255, 255, 0.05)' }
                            ]}
                        >
                            <Text style={[
                                styles.confirmButtonText,
                                { color: (newName && newAddress) ? '#050201' : 'rgba(255, 255, 255, 0.3)' }
                            ]}>
                                Save Address
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
        paddingHorizontal: 20,
        paddingBottom: 60
    },
    emptyStateContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 46,
    },
    iconContainer: {
        width: 179,
        height: 179,
    },
    actionContainer: {
        alignItems: 'center',
        gap: 24,
        width: '100%',
    },
    emptyTitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 20,
        lineHeight: 30,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    addButton: {
        width: '100%',
        maxWidth: 400,
        height: 54,
        backgroundColor: '#B4FF3B',
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#050201',
    },
    listContainer: {
        flex: 1,
        paddingTop: 20,
    },
    listContent: {
        gap: 12,
        paddingBottom: 100,
    },
    addressCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 16,
        justifyContent: 'space-between',
    },
    addressInfo: {
        flex: 1,
        gap: 4,
    },
    addressName: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: '#FFFFFF',
    },
    addressValue: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.5)',
    },
    deleteButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 75, 75, 0.1)',
    },
    deleteText: {
        color: '#FF4B4B',
        fontSize: 12,
        fontFamily: 'Manrope-Medium',
    },
    floatingAddButton: {
        position: 'absolute',
        bottom: 24,
        left: 0,
        right: 0,
        height: 54,
        backgroundColor: '#B4FF3B',
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalContent: {
        backgroundColor: '#1b1b1b',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        paddingTop: 16,
        paddingHorizontal: 24,
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 20,
        color: '#FFFFFF',
        marginBottom: 24,
    },
    inputGroup: {
        gap: 8,
        marginBottom: 20,
    },
    inputLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.6)',
    },
    textInput: {
        height: 56,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        paddingHorizontal: 16,
        color: '#FFFFFF',
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
    },
    confirmButton: {
        height: 54,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    confirmButtonText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
});
