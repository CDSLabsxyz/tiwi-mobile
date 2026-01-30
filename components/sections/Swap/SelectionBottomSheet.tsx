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
    // ... (existing animation logic stays same)
    // Use 'screen' height to prevent layout shifts when keyboard opens (Android adjustResize)
    const { height: screenHeight } = Dimensions.get('screen');
    const SHEET_HEIGHT_RATIO = 694 / 852;
    const baseHeight = height ?? 694;
    const sheetHeight = Math.min(baseHeight, screenHeight * SHEET_HEIGHT_RATIO);

    // Calculate the top position to pin the sheet
    // This replaces bottom: 0 to ensure the sheet doesn't move up when the keyboard shrinks the window
    const sheetTop = screenHeight - sheetHeight;

    const translateY = useSharedValue(sheetHeight);
    const backdropOpacity = useSharedValue(0);

    // ... existing hooks
    const [isSearching, setIsSearching] = React.useState(false);
    const [searchText, setSearchText] = React.useState('');
    const inputRef = React.useRef<TextInput>(null);

    useEffect(() => {
        if (visible) {
            translateY.value = withSpring(0, {
                damping: 12,
                stiffness: 100,
                mass: 0.8,
            });
            backdropOpacity.value = withTiming(1, { duration: 300 });
        } else {
            translateY.value = withTiming(sheetHeight, { duration: 300 });
            backdropOpacity.value = withTiming(0, { duration: 300 });
            // Reset search state when sheet closes
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
                    damping: 12,
                    stiffness: 100,
                    mass: 0.8,
                });
            }
        });

    // ... existing animations

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
                    entering={FadeIn.duration(250)}
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
                        />
                        {searchText.length > 0 && (
                            <Pressable onPress={() => handleTextChange('')}>
                                <Feather name="x-circle" size={16} color="#999" />
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
                entering={FadeIn.duration(250)}
                exiting={FadeOut.duration(200)}
            >
                {onBack && (
                    <View style={styles.backContainer}>
                        <Pressable onPress={onBack} hitSlop={10}>
                            <Image source={BackIcon} style={styles.icon} contentFit="contain" />
                        </Pressable>
                    </View>
                )}
                <Text style={styles.title}>{title}</Text>
                {showSearchIcon && (
                    <View style={styles.searchContainer}>
                        <Pressable onPress={handleSearchToggle} hitSlop={10}>
                            <Image source={SearchIcon} style={styles.icon} contentFit="contain" />
                        </Pressable>
                    </View>
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
            <GestureHandlerRootView style={styles.container}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                    <Animated.View style={[styles.backdrop, backdropStyle]} />
                </Pressable>

                <Animated.View style={[styles.sheet, { height: sheetHeight }, sheetStyle]}>
                    <GestureDetector gesture={panGesture}>
                        <View style={{ width: '100%' }}>
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
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(1, 5, 1, 0.7)',
    },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        backgroundColor: '#1B1B1B',
        overflow: 'hidden',
    },
    handleWrapper: {
        marginTop: 16,
        marginBottom: 16,
        alignItems: 'center',
        width: '100%',
    },
    handle: {
        width: 48,
        height: 4,
        borderRadius: 100,
        backgroundColor: colors.bodyText,
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        marginBottom: 16,
        minHeight: 40,
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    title: {
        flex: 1,
        textAlign: 'center',
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
        textTransform: 'capitalize',
        marginHorizontal: 40,
    },
    searchContainer: {
        position: 'absolute',
        right: 24,
    },
    backContainer: {
        position: 'absolute',
        left: 24,
        zIndex: 10,
    },
    icon: {
        width: 24,
        height: 24,
    },
    content: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 20,
    },
    // Search Header Styles
    searchHeader: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2A2A2A',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 40,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#FFF',
        height: '100%',
        paddingVertical: 0, // Fix alignment on Android
    },
    cancelButton: {
        paddingVertical: 8,
        paddingLeft: 4,
    },
    cancelText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.primaryCTA,
    },
});
