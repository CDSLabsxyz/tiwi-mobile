import { colors } from '@/constants/colors';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { Dimensions, Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    FadeIn,
    FadeOut,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

const SearchIcon = require('@/assets/swap/search-01.svg');
const BackIcon = require('@/assets/settings/arrow-left-02.svg');

interface SelectionBottomSheetProps {
    visible: boolean;
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    showSearchIcon?: boolean;
    height?: number;
    onBack?: () => void;
    onSearch?: (text: string) => void;
}

/**
 * Reusable bottom sheet used for chain & token selection
 * Matches Figma dropdown menu container (rounded 40px, 694px height)
 */
export const SelectionBottomSheet: React.FC<SelectionBottomSheetProps> = ({
    visible,
    title,
    children,
    onClose,
    showSearchIcon = true,
    height,
    onBack,
    onSearch
}) => {
    // Use 'window' height for the actual visible area
    const { height: windowHeight } = Dimensions.get('window');
    const { height: screenHeight } = Dimensions.get('screen');
    const SHEET_HEIGHT_RATIO = 694 / 852;
    const baseHeight = height ?? 694;
    const sheetHeight = Math.min(baseHeight, screenHeight * SHEET_HEIGHT_RATIO);

    // Initial position: off-screen
    const translateY = useSharedValue(sheetHeight);
    const backdropOpacity = useSharedValue(0);

    const [isSearching, setIsSearching] = React.useState(false);
    const [searchText, setSearchText] = React.useState('');
    const inputRef = React.useRef<TextInput>(null);

    useEffect(() => {
        if (visible) {
            translateY.value = withSpring(0, {
                damping: 15,
                stiffness: 100,
                mass: 0.8,
            });
            backdropOpacity.value = withTiming(1, { duration: 300 });
        } else {
            translateY.value = withTiming(sheetHeight, { duration: 300 });
            backdropOpacity.value = withTiming(0, { duration: 300 });
            if (isSearching) {
                handleSearchCancel();
            }
        }
    }, [visible, sheetHeight]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const startY = useSharedValue(0);

    const panGesture = Gesture.Pan()
        .onStart(() => {
            startY.value = translateY.value;
        })
        .onUpdate((event) => {
            translateY.value = Math.max(0, Math.min(sheetHeight, startY.value + event.translationY));
        })
        .onEnd((event) => {
            if (event.translationY > 80) {
                translateY.value = withTiming(sheetHeight, { duration: 250 }, (finished) => {
                    if (finished) runOnJS(onClose)();
                });
                backdropOpacity.value = withTiming(0, { duration: 250 });
            } else {
                translateY.value = withSpring(0, {
                    damping: 15,
                    stiffness: 100,
                });
            }
        });

    const handleSearchToggle = () => {
        if (!isSearching) {
            setIsSearching(true);
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            handleSearchCancel();
        }
    };

    const handleSearchCancel = () => {
        setIsSearching(false);
        setSearchText('');
        if (onSearch) onSearch('');
        Keyboard.dismiss();
    };

    const handleTextChange = (text: string) => {
        setSearchText(text);
        if (onSearch) onSearch(text);
    };

    // Header Content Logic
    const renderHeader = () => {
        if (isSearching) {
            return (
                <Animated.View
                    style={styles.searchHeader}
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(200)}
                >
                    <View style={styles.searchInputContainer}>
                        <Image source={SearchIcon} style={[styles.icon, { tintColor: '#666' }]} contentFit="contain" />
                        <TextInput
                            ref={inputRef}
                            style={styles.searchInput}
                            placeholder="Search..."
                            placeholderTextColor="#666"
                            value={searchText}
                            onChangeText={handleTextChange}
                            returnKeyType="search"
                            autoCorrect={false}
                        />
                        {searchText.length > 0 && (
                            <Pressable
                                onPress={() => handleTextChange('')}
                                style={styles.clearButton}
                                hitSlop={15}
                            >
                                <Feather name="x-circle" size={18} color={colors.primaryCTA} />
                            </Pressable>
                        )}
                    </View>
                    <Pressable onPress={handleSearchCancel} style={styles.cancelButton}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                </Animated.View>
            );
        }

        return (
            <Animated.View
                style={styles.headerContent}
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
            >
                {onBack && (
                    <Pressable onPress={onBack} hitSlop={15} style={styles.backButton}>
                        <Image source={BackIcon} style={styles.backIcon} contentFit="contain" />
                    </Pressable>
                )}
                <Text style={styles.title}>{title}</Text>
                {showSearchIcon && (
                    <Pressable onPress={handleSearchToggle} hitSlop={15} style={styles.searchButton}>
                        <Image source={SearchIcon} style={styles.icon} contentFit="contain" />
                    </Pressable>
                )}
            </Animated.View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <GestureHandlerRootView style={styles.fullContainer}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                    <Animated.View style={[styles.backdrop, backdropStyle]} />
                </Pressable>

                {/* Using absolute positioning with bottom: 0 and overflow: visible */}
                {/* To ensure it stays grounded, we wrap it in a view that doesn't react to keyboard height on Android */}
                <View style={styles.sheetWrapper} pointerEvents="box-none">
                    <Animated.View style={[styles.sheet, { height: sheetHeight }, sheetStyle]}>
                        <GestureDetector gesture={panGesture}>
                            <View style={styles.headerColumn}>
                                <View style={styles.handleWrapper}>
                                    <View style={styles.handle} />
                                </View>

                                <View style={styles.header}>
                                    {renderHeader()}
                                </View>
                            </View>
                        </GestureDetector>

                        <View style={styles.content}>
                            {children}
                        </View>
                    </Animated.View>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    fullContainer: {
        flex: 1,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(1, 5, 1, 0.7)',
    },
    sheetWrapper: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
    },
    sheet: {
        width: '100%',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        backgroundColor: '#1B1B1B',
        overflow: 'hidden',
    },
    headerColumn: {
        width: '100%',
    },
    handleWrapper: {
        marginTop: 12,
        marginBottom: 12,
        alignItems: 'center',
        width: '100%',
    },
    handle: {
        width: 48,
        height: 4,
        borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    header: {
        width: '100%',
        paddingHorizontal: 24,
        marginBottom: 16,
        minHeight: 48,
        justifyContent: 'center',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    backButton: {
        position: 'absolute',
        left: 0,
        zIndex: 10,
    },
    backIcon: {
        width: 24,
        height: 24,
        tintColor: colors.titleText,
    },
    searchButton: {
        position: 'absolute',
        right: 0,
    },
    title: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: colors.titleText,
        textTransform: 'capitalize',
        textAlign: 'center',
    },
    icon: {
        width: 24,
        height: 24,
    },
    content: {
        flex: 1,
        width: '100%',
    },
    searchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        width: '100%',
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2A2A2A',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#FFF',
        height: '100%',
        paddingVertical: 0,
    },
    clearButton: {
        padding: 4,
    },
    cancelButton: {
        paddingVertical: 8,
    },
    cancelText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.primaryCTA,
    },
});
