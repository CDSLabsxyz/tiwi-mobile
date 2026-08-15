import { colors } from '@/constants/colors';
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';

interface SwapLoadingOverlayProps {
    visible: boolean;
    /**
     * Current stage from the swap engine ("Approving token…", "Confirming…").
     * Takes priority over the rotating filler copy below.
     */
    stage?: string | null;
}

/**
 * Filler copy for the silent stretches.
 *
 * The engine only emits a status when something changes, so between "Submitting"
 * and "Confirming" there can be a long quiet gap - waiting on a block, on a
 * bridge relayer, on the second leg of a multi-step route. A frozen caption
 * during those gaps reads as a hung app, so this rotates while we wait.
 */
const WAITING_MESSAGES = [
    'Tiwiculating the best path...',
    'Talking to the chain...',
    'Locking in your rate...',
    'Almost there...',
    'Still working - do not close the app...',
];

const ROTATE_MS = 2600;
const LOADER_SIZE = 150;

/**
 * Loading overlay for swap confirmation
 * Matches Figma loading state
 */
export const SwapLoadingOverlay: React.FC<SwapLoadingOverlayProps> = ({
    visible,
    stage,
}) => {
    const [fillerIndex, setFillerIndex] = useState(0);
    // Time since the engine last said anything. Filler only kicks in once the
    // engine has gone quiet, so we never talk over a real status.
    const lastStageAt = useRef(Date.now());
    const [isQuiet, setIsQuiet] = useState(false);

    useEffect(() => {
        if (!visible) {
            setFillerIndex(0);
            setIsQuiet(false);
            return;
        }
        lastStageAt.current = Date.now();
        setIsQuiet(false);
    }, [stage, visible]);

    useEffect(() => {
        if (!visible) return;
        const id = setInterval(() => {
            if (Date.now() - lastStageAt.current >= ROTATE_MS) {
                setIsQuiet(true);
                setFillerIndex((i) => (i + 1) % WAITING_MESSAGES.length);
            }
        }, ROTATE_MS);
        return () => clearInterval(id);
    }, [visible]);

    if (!visible) return null;

    const caption = stage && !isQuiet ? stage : WAITING_MESSAGES[fillerIndex];

    return (
        <View style={styles.container}>
            <BlurView intensity={20} tint="dark" style={styles.blur}>
                {/* TIWILoader's own container is `flex: 1`, so dropping it in a
                    column makes it eat all the free height and push whatever
                    follows to the bottom of the screen - which is exactly where
                    the caption was ending up. Pin it to its real size so the
                    caption sits directly under the mark. */}
                <View style={styles.stack}>
                    <View style={styles.loaderBox}>
                        <TIWILoader size={LOADER_SIZE} style={styles.loaderFixed} />
                    </View>
                    <Text style={styles.caption} numberOfLines={2}>
                        {caption}
                    </Text>
                </View>
            </BlurView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
    },
    blur: {
        flex: 1,
        backgroundColor: 'rgba(1, 5, 1, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stack: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    loaderBox: {
        width: LOADER_SIZE,
        height: LOADER_SIZE,
    },
    /** Cancels TIWILoader's internal `flex: 1`. */
    loaderFixed: {
        flex: 0,
        width: LOADER_SIZE,
        height: LOADER_SIZE,
    },
    caption: {
        // Sits right under the mark so the two read as one unit.
        marginTop: 10,
        color: colors.primaryCTA,
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
        paddingHorizontal: 32,
        minHeight: 34,
    },
});
