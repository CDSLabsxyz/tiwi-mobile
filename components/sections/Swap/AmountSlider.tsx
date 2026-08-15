/**
 * Percentage slider for the swap "From" amount - the native port of the web
 * swap card's "Scroll or drag" control (tiwi-user-app components/swap/token-input.tsx).
 *
 * Same model as the web one: the value is a PERCENTAGE OF BALANCE, and the
 * parent owns the conversion to an amount, so Max keeps whatever gas/fee
 * reserve the parent already applies. There is no wheel on a phone, hence
 * "Drag to select" rather than the web's "Scroll or drag" - tapping anywhere on
 * the track jumps there, which is the touch equivalent.
 */

import { colors } from '@/constants/colors';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

const STOPS = [0, 25, 50, 75, 100];

interface AmountSliderProps {
    /** Current position, 0–100. Values outside the range are clamped. */
    value: number;
    onChange: (percent: number) => void;
    disabled?: boolean;
}

export const AmountSlider: React.FC<AmountSliderProps> = ({ value, onChange, disabled = false }) => {
    const [trackWidth, setTrackWidth] = useState(0);
    // Gesture callbacks are captured once by PanResponder, so read the live
    // width/disabled/handler through refs instead of stale closure copies.
    const widthRef = useRef(0);
    const disabledRef = useRef(disabled);
    const onChangeRef = useRef(onChange);
    disabledRef.current = disabled;
    onChangeRef.current = onChange;

    const percent = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

    const trackRef = useRef<View>(null);
    /** Track's x in window coords - drags are tracked in page space (see below). */
    const originRef = useRef(0);

    const emitFromX = useCallback((x: number) => {
        const width = widthRef.current;
        if (disabledRef.current || width <= 0) return;
        const next = Math.round(Math.min(100, Math.max(0, (x / width) * 100)));
        onChangeRef.current(next);
    }, []);

    const responder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => !disabledRef.current,
                onMoveShouldSetPanResponder: () => !disabledRef.current,
                // Claim the gesture so the enclosing ScrollView doesn't steal a
                // horizontal drag halfway through.
                onPanResponderTerminationRequest: () => false,
                onPanResponderGrant: (e) => emitFromX(e.nativeEvent.locationX),
                onPanResponderMove: (e, gesture) => {
                    // locationX is relative to whichever child was touched (the
                    // knob moves under the finger), so track the gesture in page
                    // coordinates against the track's own origin instead.
                    emitFromX(gesture.moveX - originRef.current);
                },
            }),
        [emitFromX],
    );

    const handleLayout = () => {
        trackRef.current?.measureInWindow((x, _y, width) => {
            originRef.current = x;
            widthRef.current = width;
            setTrackWidth(width);
        });
    };

    const knobLeft = (trackWidth * percent) / 100;

    return (
        <View style={[styles.wrap, disabled && styles.disabled]}>
            <View style={styles.labelRow}>
                <Text style={styles.hint}>Drag to select</Text>
                <Text style={styles.percentText}>{Math.round(percent)}%</Text>
            </View>

            <View
                ref={trackRef}
                onLayout={handleLayout}
                style={styles.touchArea}
                {...responder.panHandlers}
            >
                <View style={styles.track}>
                    <View style={[styles.fill, { width: `${percent}%` }]} />

                    {STOPS.map((stop) => {
                        const reached = percent >= stop;
                        // Hide the stop the knob is sitting on, so the two don't
                        // stack into a lumpy double circle.
                        const covered = Math.abs(percent - stop) < 2;
                        return (
                            <View
                                key={stop}
                                pointerEvents="none"
                                style={[
                                    styles.stop,
                                    reached ? styles.stopReached : styles.stopPending,
                                    { left: `${stop}%` },
                                    covered && styles.stopHidden,
                                ]}
                            />
                        );
                    })}

                    {trackWidth > 0 && (
                        <View pointerEvents="none" style={[styles.knob, { left: knobLeft }]} />
                    )}
                </View>
            </View>
        </View>
    );
};

const KNOB = 16;
const STOP_SIZE = 10;

const styles = StyleSheet.create({
    wrap: { width: '100%', marginTop: 10 },
    disabled: { opacity: 0.5 },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    hint: { color: colors.mutedText, fontFamily: 'Manrope-Medium', fontSize: 11 },
    percentText: { color: colors.primaryCTA, fontFamily: 'Manrope-SemiBold', fontSize: 11 },
    // Generous vertical padding - the visible track is 4px, which is far too
    // thin to hit with a thumb.
    touchArea: { paddingVertical: 10, justifyContent: 'center' },
    track: { height: 4, borderRadius: 999, backgroundColor: colors.bgStroke, justifyContent: 'center' },
    fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: colors.primaryCTA },
    stop: {
        position: 'absolute',
        width: STOP_SIZE,
        height: STOP_SIZE,
        borderRadius: STOP_SIZE / 2,
        marginLeft: -STOP_SIZE / 2,
    },
    stopReached: { backgroundColor: colors.primaryCTA, borderWidth: 2, borderColor: '#156200' },
    stopPending: { backgroundColor: colors.bgStroke, borderWidth: 1, borderColor: colors.bg },
    stopHidden: { opacity: 0 },
    knob: {
        position: 'absolute',
        width: KNOB,
        height: KNOB,
        marginLeft: -KNOB / 2,
        borderRadius: KNOB / 2,
        backgroundColor: colors.primaryCTA,
        borderWidth: 2,
        borderColor: '#156200',
    },
});
