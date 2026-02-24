import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useSecurityStore } from '@/store/securityStore';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    BackHandler,
    Keyboard,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChevronLeftIcon = require('../../../../assets/swap/arrow-left-02.svg');
const DeleteIcon = require('../../../../assets/settings/Union.svg');

export default function ExportPrivateKeyPasscodeScreen() {
    const { top } = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ returnTo?: string }>();
    const [passcode, setPasscode] = useState<string[]>(Array(6).fill(''));
    const [focusedIndex, setFocusedIndex] = useState<number>(0);
    const [isError, setIsError] = useState(false);
    const { verifyPasscode, authenticateBiometrics, isBiometricsEnabled } = useSecurityStore();
    const inputRefs = useRef<(TextInput | null)[]>([]);

    const shake = useSharedValue(0);
    const shakeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shake.value }],
    }));

    const triggerShake = () => {
        shake.value = withTiming(-10, { duration: 50 }, () => {
            shake.value = withTiming(10, { duration: 50 }, () => {
                shake.value = withTiming(-10, { duration: 50 }, () => {
                    shake.value = withTiming(10, { duration: 50 }, () => {
                        shake.value = withTiming(0, { duration: 50 });
                    });
                });
            });
        });
    };

    // Handle phone back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPress();
            return true;
        });

        return () => backHandler.remove();
    }, [params.returnTo]);

    // Handle Biometrics and Auto-focus
    useEffect(() => {
        const initAuth = async () => {
            if (isBiometricsEnabled) {
                // Small delay to ensure UI is ready
                setTimeout(async () => {
                    const success = await authenticateBiometrics('Verify your identity to export private key');
                    if (success) {
                        handleAuthSuccess();
                    } else {
                        // Fallback to passcode input
                        inputRefs.current[0]?.focus();
                    }
                }, 500);
            } else {
                const timer = setTimeout(() => {
                    inputRefs.current[0]?.focus();
                }, 100);
                return () => clearTimeout(timer);
            }
        };

        initAuth();
    }, [isBiometricsEnabled]);

    // Handle passcode completion
    useEffect(() => {
        const isComplete = passcode.every((digit) => digit !== '') && passcode.length === 6;
        if (isComplete) {
            handleVerify();
        }
    }, [passcode]);

    const handleAuthSuccess = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push('/settings/accounts/export-private-key/display' as any);
    };

    const handleVerify = async () => {
        Keyboard.dismiss();
        const codeString = passcode.join('');
        const isValid = await verifyPasscode(codeString);

        if (isValid) {
            handleAuthSuccess();
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setIsError(true);
            triggerShake();
            setTimeout(() => {
                setIsError(false);
                setPasscode(Array(6).fill(''));
                setFocusedIndex(0);
                inputRefs.current[0]?.focus();
            }, 1500);
        }
    };

    const handleBackPress = () => {
        router.replace('/settings/accounts' as any);
    };

    const handleTextChange = (text: string, index: number) => {
        if (text.length > 1) {
            text = text.slice(-1);
        }

        if (text && !/^[0-9]$/.test(text)) {
            return;
        }

        const newPasscode = [...passcode];
        newPasscode[index] = text;
        setPasscode(newPasscode);

        if (text && index < 5) {
            setFocusedIndex(index + 1);
            inputRefs.current[index + 1]?.focus();
        } else if (text && index === 5) {
            Keyboard.dismiss();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace') {
            if (!passcode[index] && index > 0) {
                const newPasscode = [...passcode];
                newPasscode[index - 1] = '';
                setPasscode(newPasscode);
                setFocusedIndex(index - 1);
                inputRefs.current[index - 1]?.focus();
            } else if (passcode[index]) {
                const newPasscode = [...passcode];
                newPasscode[index] = '';
                setPasscode(newPasscode);
            }
        }
    };

    const handleNumericKeyPress = (digit: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (focusedIndex < 6) {
            handleTextChange(digit, focusedIndex);
        }
    };

    const handleDelete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (focusedIndex > 0 && !passcode[focusedIndex]) {
            const newPasscode = [...passcode];
            newPasscode[focusedIndex - 1] = '';
            setPasscode(newPasscode);
            setFocusedIndex(focusedIndex - 1);
            inputRefs.current[focusedIndex - 1]?.focus();
        } else if (passcode[focusedIndex]) {
            const newPasscode = [...passcode];
            newPasscode[focusedIndex] = '';
            setPasscode(newPasscode);
        }
    };

    return (
        <ThemedView style={styles.container}>
            <CustomStatusBar />

            {/* Header */}
            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleBackPress}
                        style={styles.backButton}
                    >
                        <Image
                            source={ChevronLeftIcon}
                            style={styles.fullSize}
                            contentFit="contain"
                        />
                    </TouchableOpacity>

                    <ThemedText style={styles.headerTitle}>
                        Export Private Key
                    </ThemedText>
                </View>
            </View>

            {/* PIN Entry Boxes */}
            <Animated.View style={[styles.pinSection, shakeStyle]}>
                <View style={styles.pinContainer}>
                    {Array.from({ length: 6 }).map((_, index) => {
                        const hasValue = passcode[index] !== '';

                        return (
                            <TouchableOpacity
                                key={`pin-${index}`}
                                activeOpacity={0.7}
                                onPress={() => {
                                    if (isError) return;
                                    setFocusedIndex(index);
                                    inputRefs.current[index]?.focus();
                                }}
                                style={[
                                    styles.pinBox,
                                    isError && { borderColor: colors.error, borderWidth: 1.5 }
                                ]}
                            >
                                <TextInput
                                    ref={(ref) => {
                                        inputRefs.current[index] = ref;
                                    }}
                                    value={passcode[index]}
                                    onChangeText={(text) => handleTextChange(text, index)}
                                    onKeyPress={(e) => handleKeyPress(e, index)}
                                    onFocus={() => setFocusedIndex(index)}
                                    keyboardType="number-pad"
                                    maxLength={1}
                                    style={styles.hiddenInput}
                                    autoFocus={index === 0}
                                    showSoftInputOnFocus={false}
                                    editable={!isError}
                                />

                                {hasValue && <View style={[styles.pinDot, isError && { backgroundColor: colors.error }]} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>
                {isError && (
                    <ThemedText style={styles.errorText}>
                        Incorrect passcode. Please try again.
                    </ThemedText>
                )}
            </Animated.View>

            {/* Numeric Keyboard */}
            <BlurView
                intensity={80}
                tint="dark"
                style={styles.keyboardBlur}
            >
                <View style={styles.keyboardContainer}>
                    {[
                        ['1', '2', '3'],
                        ['4', '5', '6'],
                        ['7', '8', '9'],
                        [null, '0', 'delete']
                    ].map((row, rowIndex) => (
                        <View key={`row-${rowIndex}`} style={styles.keyboardRow}>
                            {row.map((item, colIndex) => {
                                if (item === null) return <View key={`col-${colIndex}`} style={styles.keyPlaceholder} />;
                                if (item === 'delete') {
                                    return (
                                        <TouchableOpacity
                                            key="key-delete"
                                            activeOpacity={0.7}
                                            onPress={handleDelete}
                                            style={styles.deleteKey}
                                        >
                                            <Image
                                                source={DeleteIcon}
                                                style={styles.deleteIcon}
                                                contentFit="contain"
                                            />
                                        </TouchableOpacity>
                                    );
                                }
                                return (
                                    <TouchableOpacity
                                        key={`key-${item}`}
                                        activeOpacity={0.7}
                                        onPress={() => handleNumericKeyPress(item as string)}
                                        style={styles.numericKey}
                                    >
                                        <ThemedText style={styles.keyText}>
                                            {item}
                                        </ThemedText>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))}
                </View>

                {/* Home Indicator */}
                <View style={styles.homeIndicatorContainer}>
                    <View style={styles.homeIndicator} />
                </View>
            </BlurView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 68,
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
    },
    pinSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 250, // Push up to make room for keyboard
    },
    pinContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        maxWidth: 360,
        justifyContent: 'center',
        alignSelf: 'center',
    },
    pinBox: {
        width: 48,
        height: 48,
        borderRadius: 8,
        borderWidth: 0.2,
        borderColor: colors.titleText,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hiddenInput: {
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
    },
    pinDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.titleText,
    },
    errorText: {
        color: colors.error,
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        marginTop: 20,
    },
    keyboardBlur: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    keyboardContainer: {
        paddingTop: 12,
        paddingHorizontal: 8,
    },
    keyboardRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 6,
    },
    numericKey: {
        flex: 1,
        height: 52,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteKey: {
        flex: 1,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
    },
    keyPlaceholder: {
        flex: 1,
    },
    keyText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 24,
        color: '#FFFFFF',
    },
    deleteIcon: {
        width: 23,
        height: 17,
    },
    homeIndicatorContainer: {
        height: 34,
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 8,
    },
    homeIndicator: {
        width: 134,
        height: 5,
        borderRadius: 100,
        backgroundColor: '#FFFFFF',
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
});
