import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

const SearchIcon = require('@/assets/swap/search-01.svg');

interface SelectionBottomSheetProps {
    visible: boolean;
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    showSearchIcon?: boolean;
    height?: number;
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
}) => {
    const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
    const SHEET_HEIGHT_RATIO = 694 / 852;
    const baseHeight = height ?? 694;
    const sheetHeight = Math.min(baseHeight, screenHeight * SHEET_HEIGHT_RATIO);

    const translateY = useSharedValue(sheetHeight);
    const backdropOpacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            // Slide up and "jump" a bit (overshoot) then settle
            translateY.value = withSpring(0, {
                damping: 12,
                stiffness: 100,
                mass: 0.8,
            });
            backdropOpacity.value = withTiming(1, { duration: 300 });
        } else {
            // Slide down smoothly
            translateY.value = withTiming(sheetHeight, { duration: 300 });
            backdropOpacity.value = withTiming(0, { duration: 300 });
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
                                <Text style={styles.title}>{title}</Text>
                                {showSearchIcon && (
                                    <View style={styles.searchContainer}>
                                        <Image source={SearchIcon} style={styles.searchIcon} contentFit="contain" />
                                    </View>
                                )}
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
    },
    title: {
        flex: 1,
        textAlign: 'center',
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
        textTransform: 'capitalize',
    },
    searchContainer: {
        position: 'absolute',
        right: 24,
    },
    searchIcon: {
        width: 24,
        height: 24,
    },
    content: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 20,
    },
});
