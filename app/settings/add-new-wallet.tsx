import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { colors } from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ArrowDownIcon = require('../../assets/home/arrow-down-01.svg');

type WalletType = 'Crypto Wallet' | 'Bank Account' | 'Mobile Money';

const WALLET_TYPES: WalletType[] = ['Crypto Wallet', 'Bank Account', 'Mobile Money'];

export default function AddNewWalletScreen() {
    const { bottom } = useSafeAreaInsets();
    const router = useRouter();

    const [walletName, setWalletName] = useState('');
    const [walletAddress, setWalletAddress] = useState('');
    const [walletType, setWalletType] = useState<WalletType | ''>('');
    const [errors, setErrors] = useState<{ name?: string; address?: string; type?: string }>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isTypeModalVisible, setIsTypeModalVisible] = useState(false);

    const validate = () => {
        const newErrors: typeof errors = {};
        if (!walletName.trim()) newErrors.name = 'Wallet name is required';
        if (!walletAddress.trim()) newErrors.address = 'Wallet address is required';
        if (!walletType) newErrors.type = 'Select a wallet type';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (isSaving || !validate()) return;

        setIsSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'Wallet saved successfully', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (error) {
            Alert.alert('Error', 'Failed to save wallet. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const isFormValid = useMemo(
        () => walletName.trim().length >= 2 && walletAddress.trim().length >= 8 && !!walletType,
        [walletName, walletAddress, walletType]
    );

    return (
        <ThemedView style={styles.container}>
            <SettingsHeader title="Add New Wallet" />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: (bottom || 16) + 24 }
                ]}
                showsVerticalScrollIndicator={false}
                alwaysBounceVertical={true}
            >
                <View style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.inputLabel}>Wallet Name</ThemedText>
                        <View
                            style={[
                                styles.inputWrapper,
                                errors.name && styles.inputError
                            ]}
                        >
                            <TextInput
                                style={styles.textInput}
                                placeholder="Enter wallet name"
                                placeholderTextColor={colors.mutedText}
                                value={walletName}
                                onChangeText={(val) => {
                                    setWalletName(val);
                                    if (errors.name) setErrors({ ...errors, name: undefined });
                                }}
                            />
                        </View>
                        {errors.name && <ThemedText style={styles.errorText}>{errors.name}</ThemedText>}
                    </View>

                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.inputLabel}>Wallet Address</ThemedText>
                        <View
                            style={[
                                styles.inputWrapper,
                                errors.address && styles.inputError
                            ]}
                        >
                            <TextInput
                                style={styles.textInput}
                                placeholder="Enter wallet address"
                                placeholderTextColor={colors.mutedText}
                                value={walletAddress}
                                onChangeText={(val) => {
                                    setWalletAddress(val);
                                    if (errors.address) setErrors({ ...errors, address: undefined });
                                }}
                                autoCapitalize="none"
                            />
                        </View>
                        {errors.address && <ThemedText style={styles.errorText}>{errors.address}</ThemedText>}
                    </View>

                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.inputLabel}>Wallet Type</ThemedText>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setIsTypeModalVisible(true)}
                            style={[
                                styles.selector,
                                errors.type && styles.inputError
                            ]}
                        >
                            <ThemedText style={[styles.selectorText, !walletType && { color: colors.mutedText }]}>
                                {walletType || 'Select Wallet Type'}
                            </ThemedText>
                            <View style={styles.icon24}>
                                <Image source={ArrowDownIcon} style={styles.fullSize} contentFit="contain" />
                            </View>
                        </TouchableOpacity>
                        {errors.type && <ThemedText style={styles.errorText}>{errors.type}</ThemedText>}
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleSave}
                        disabled={!isFormValid || isSaving}
                        style={[
                            styles.saveBtn,
                            { backgroundColor: isFormValid ? colors.primaryCTA : colors.bgCards }
                        ]}
                    >
                        <ThemedText
                            style={[
                                styles.saveBtnText,
                                { color: isFormValid ? '#050201' : colors.bodyText }
                            ]}
                        >
                            {isSaving ? 'Saving…' : 'Save Wallet'}
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <Modal visible={isTypeModalVisible} transparent animationType="fade" statusBarTranslucent>
                <Pressable style={styles.modalBackdrop} onPress={() => setIsTypeModalVisible(false)}>
                    <View style={[styles.modalContent, { paddingBottom: (bottom || 24) + 24 }]}>
                        <View style={styles.radioList}>
                            {WALLET_TYPES.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setWalletType(type);
                                        setErrors((prev) => ({ ...prev, type: undefined }));
                                        setIsTypeModalVisible(false);
                                    }}
                                    style={styles.radioItem}
                                >
                                    <ThemedText style={styles.radioLabel}>{type}</ThemedText>
                                    <View
                                        style={[
                                            styles.radioOuter,
                                            { borderColor: type === walletType ? colors.primaryCTA : colors.mutedText }
                                        ]}
                                    >
                                        {type === walletType && <View style={styles.radioInner} />}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingTop: 32,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    formContainer: {
        width: '100%',
        maxWidth: 400,
        gap: 24,
    },
    inputGroup: {
        gap: 8,
    },
    inputLabel: {
        fontSize: 16,
        opacity: 0.9,
    },
    inputWrapper: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 56,
        justifyContent: 'center',
    },
    inputError: {
        borderWidth: 1,
        borderColor: colors.error,
    },
    textInput: {
        color: '#FFFFFF',
        fontSize: 16,
        height: '100%',
    },
    errorText: {
        fontSize: 12,
        color: colors.error,
    },
    selector: {
        height: 56,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectorText: {
        fontSize: 16,
    },
    icon24: {
        width: 24,
        height: 24,
    },
    saveBtn: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: '600',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(1,5,1,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1b1b1b',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        paddingHorizontal: 20,
        paddingTop: 32,
    },
    radioList: {
        gap: 8,
    },
    radioItem: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    radioLabel: {
        fontSize: 16,
    },
    radioOuter: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primaryCTA,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
});
