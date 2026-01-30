import { colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface PerpTradeFormProps {
    symbol: string;
    availableBalance?: number;
    initialSide?: 'long' | 'short';
    onExecute?: (side: 'long' | 'short', type: string, price: string, amount: string, tpsl?: { tp: string, sl: string }) => void;
}

const COLOR_LONG = colors.primaryCTA;
const COLOR_SHORT = colors.error;

export const PerpTradeForm: React.FC<PerpTradeFormProps> = ({ symbol, availableBalance = 0, initialSide = 'long', onExecute }) => {
    const [side, setSide] = useState<'long' | 'short'>(initialSide);
    const [orderType, setOrderType] = useState('Limit');
    const [leverage, setLeverage] = useState('10X');
    const [marginMode, setMarginMode] = useState('Cross');
    const [price, setPrice] = useState('');
    const [amount, setAmount] = useState('');

    React.useEffect(() => {
        if (initialSide) setSide(initialSide);
    }, [initialSide]);

    const [showMarginModal, setShowMarginModal] = useState(false);
    const [showOrderTypeModal, setShowOrderTypeModal] = useState(false);
    const [showLeverageModal, setShowLeverageModal] = useState(false);

    const [showTPSL, setShowTPSL] = useState(false);
    const [takeProfit, setTakeProfit] = useState('');
    const [stopLoss, setStopLoss] = useState('');

    const [sliderValue, setSliderValue] = useState(5);
    const sliderRef = useRef<View>(null);
    const sliderLayout = useRef({ width: 0, pageX: 0 }).current;

    const activeColor = side === 'long' ? COLOR_LONG : COLOR_SHORT;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => updateSliderValue(evt.nativeEvent.pageX),
            onPanResponderMove: (evt, gesture) => updateSliderValue(gesture.moveX),
            onPanResponderRelease: (evt, gesture) => updateSliderValue(gesture.moveX),
        })
    ).current;

    const effectiveBalance = availableBalance > 0 ? availableBalance : 1000; // Mock balance for demo

    const updateSliderValue = (absoluteX: number) => {
        if (sliderLayout.width <= 0) return;
        const relativeX = absoluteX - sliderLayout.pageX;
        const percentage = Math.max(0, Math.min(100, (relativeX / sliderLayout.width) * 100));
        setSliderValue(percentage);
        setAmount((effectiveBalance * (percentage / 100)).toFixed(2));
    };

    const handleSliderLayout = () => {
        sliderRef.current?.measure((x, y, width, height, pageX, pageY) => {
            sliderLayout.width = width;
            sliderLayout.pageX = pageX;
        });
    };

    const handleStepPress = (val: number) => {
        setSliderValue(val);
        setAmount((effectiveBalance * (val / 100)).toFixed(2));
    };

    const DropdownModal = ({ visible, options, onSelect, onClose, current }: any) => (
        <Modal transparent visible={visible} animationType="fade">
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <View style={styles.modalContent}>
                    {options.map((opt: string) => (
                        <TouchableOpacity
                            key={opt}
                            style={styles.modalOption}
                            onPress={() => { onSelect(opt); onClose(); }}
                        >
                            <Text style={[styles.modalOptionText, current === opt && { color: activeColor }]}>
                                {opt}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </Pressable>
        </Modal>
    );

    return (
        <View style={styles.container}>
            {/* ROW 1: MARGIN & LEVERAGE */}
            <View style={styles.dropdownGrid}>
                <TouchableOpacity style={styles.miniField} onPress={() => setShowMarginModal(true)}>
                    <Text style={styles.miniFieldLabel}>{marginMode}</Text>
                    <Ionicons name="chevron-down" size={12} color={colors.mutedText} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.miniField} onPress={() => setShowLeverageModal(true)}>
                    <Text style={styles.miniFieldLabel}>{leverage}</Text>
                    <Ionicons name="chevron-down" size={12} color={colors.mutedText} />
                </TouchableOpacity>
            </View>

            {/* ROW 2: LONG/SHORT */}
            <View style={styles.toggleStrip}>
                <TouchableOpacity
                    style={[styles.togglePiece, side === 'long' && { backgroundColor: colors.primaryCTA }]}
                    onPress={() => setSide('long')}>
                    <Text style={[styles.togglePieceText, side === 'long' && { color: '#000' }]}>Long</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.togglePiece, side === 'short' && { backgroundColor: colors.error }]}
                    onPress={() => setSide('short')}>
                    <Text style={[styles.togglePieceText, side === 'short' && { color: '#FFF' }]}>Short</Text>
                </TouchableOpacity>
            </View>

            {/* ROW 3: ORDER TYPE */}
            <TouchableOpacity style={styles.mainInputRow} onPress={() => setShowOrderTypeModal(true)}>
                <Text style={styles.mainInputText}>{orderType}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.mutedText} />
            </TouchableOpacity>

            {/* ROW 4: PRICE */}
            <View style={[styles.mainInputRow, orderType === 'Market' && { opacity: 0.6 }]}>
                {orderType === 'Market' ? (
                    <Text style={styles.placeholderText}>Market Price</Text>
                ) : (
                    <TextInput
                        style={styles.rawInput}
                        placeholder="Price"
                        placeholderTextColor={colors.mutedText}
                        value={price}
                        onChangeText={setPrice}
                        keyboardType="numeric"
                    />
                )}
                <Text style={styles.unitText}>USDT</Text>
            </View>

            {/* ROW 5: ORDER VALUE */}
            <View style={styles.mainInputRow}>
                <TextInput
                    style={styles.rawInput}
                    placeholder="Order Value"
                    placeholderTextColor={colors.mutedText}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                />
                <View style={styles.unitWithIcon}>
                    <Text style={styles.unitText}>USD</Text>
                    <Image source={require('@/assets/settings/refresh.svg')} style={styles.fieldIcon} />
                </View>
            </View>

            {/* ROW 6: AVAILABLE */}
            <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Available</Text>
                <TouchableOpacity style={styles.metaRight}>
                    <Text style={styles.metaValue}>{availableBalance.toFixed(0)} USDT</Text>
                    <Image source={require('@/assets/settings/add-square.svg')} style={styles.fieldIconSmall} />
                </TouchableOpacity>
            </View>

            {/* ROW 7: SLIDER */}
            <View
                ref={sliderRef}
                style={styles.sliderWidget}
                onLayout={handleSliderLayout}
                {...panResponder.panHandlers}
            >
                <View style={styles.sliderTrackLine} />
                <View style={[styles.sliderTrackActive, { width: `${sliderValue}%`, backgroundColor: activeColor }]} />
                {[0, 25, 50, 75, 100].map((step) => (
                    <TouchableOpacity
                        key={step}
                        activeOpacity={1}
                        onPress={() => handleStepPress(step)}
                        style={[
                            styles.sliderStepDot,
                            { left: `${step}%`, marginLeft: -6 }, // Adjusted margin for center
                            step <= sliderValue ? { backgroundColor: activeColor, borderColor: activeColor } : {}
                        ]}
                    />
                ))}
                <View style={[styles.sliderKnob, { left: `${sliderValue}%`, marginLeft: -8, backgroundColor: activeColor }]} />
            </View>

            {/* ROW 8: TP/SL */}
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowTPSL(!showTPSL)}
                style={styles.checkLine}
            >
                <View style={[styles.checkbox, showTPSL && { backgroundColor: activeColor, borderColor: activeColor }]}>
                    {showTPSL && <Ionicons name="checkmark" size={10} color="#000" />}
                </View>
                <Text style={styles.checkLabel}>TP/SL</Text>
            </TouchableOpacity>

            {showTPSL && (
                <View style={styles.miniInputGroup}>
                    <View style={styles.miniInputCell}>
                        <TextInput style={styles.miniInputText} placeholder="TP" placeholderTextColor={colors.mutedText} keyboardType='numeric' />
                    </View>
                    <View style={styles.miniInputCell}>
                        <TextInput style={styles.miniInputText} placeholder="SL" placeholderTextColor={colors.mutedText} keyboardType='numeric' />
                    </View>
                </View>
            )}

            {/* ROW 9: SUMMARY BOX */}
            <View style={styles.darkInfoBox}>
                <View style={styles.infoLine}>
                    <Text style={styles.infoLabel}>Max</Text>
                    <Text style={styles.infoValue}>-</Text>
                </View>
                <View style={styles.infoLine}>
                    <Text style={styles.infoLabel}>Liq. Price</Text>
                    <Text style={styles.infoValue}>-</Text>
                </View>
            </View>

            {/* ROW 10: ACTION BUTTON */}
            <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: activeColor }]}
                onPress={() => onExecute?.(side, orderType, price, amount, showTPSL ? { tp: takeProfit, sl: stopLoss } : undefined)}
            >
                <Text style={[styles.actionButtonText, { color: side === 'long' ? colors.bg : "#fff" }]}>
                    {side === 'long' ? 'Long' : 'Short'} {symbol}
                </Text>
            </TouchableOpacity>

            {/* Modals */}
            <DropdownModal
                visible={showMarginModal}
                options={['Cross', 'Isolated']}
                current={marginMode}
                onSelect={setMarginMode}
                onClose={() => setShowMarginModal(false)}
            />
            <DropdownModal
                visible={showOrderTypeModal}
                options={['Market', 'Limit']}
                current={orderType}
                onSelect={setOrderType}
                onClose={() => setShowOrderTypeModal(false)}
            />
            <DropdownModal
                visible={showLeverageModal}
                options={['1X', '5X', '10X', '20X', '50X', '100X']}
                current={leverage}
                onSelect={setLeverage}
                onClose={() => setShowLeverageModal(false)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    dropdownGrid: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 8,
    },
    miniField: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.bgCards,
        paddingHorizontal: 8,
        paddingVertical: 7,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    miniFieldLabel: {
        fontFamily: 'Manrope-Bold',
        fontSize: 11,
        color: colors.titleText,
    },
    toggleStrip: {
        flexDirection: 'row',
        backgroundColor: colors.bgCards,
        borderRadius: 8,
        marginBottom: 10,
    },
    togglePiece: {
        flex: 1,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
    },
    togglePieceText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 13,
        color: colors.mutedText,
    },
    mainInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.bgCards,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 42,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    placeholderText: {
        fontFamily: 'Manrope-Bold',
        color: colors.mutedText,
        fontSize: 13,
    },
    mainInputText: {
        fontFamily: 'Manrope-Bold',
        color: colors.titleText,
        fontSize: 13,
    },
    rawInput: {
        flex: 1,
        fontFamily: 'Manrope-Bold',
        color: colors.titleText,
        fontSize: 13,
        height: '100%',
    },
    unitText: {
        fontFamily: 'Manrope-Bold',
        color: colors.mutedText,
        fontSize: 11,
    },
    unitWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    fieldIcon: {
        width: 14,
        height: 14,
        tintColor: colors.mutedText,
    },
    fieldIconSmall: {
        width: 12,
        height: 12,
        tintColor: colors.titleText,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 2,
    },
    metaLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        color: colors.mutedText,
    },
    metaRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metaValue: {
        fontFamily: 'Manrope-Bold',
        fontSize: 11,
        color: colors.titleText,
    },
    sliderWidget: {
        height: 20,
        justifyContent: 'center',
        marginBottom: 12,
        paddingHorizontal: 1,
    },
    sliderTrackLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: colors.bgStroke,
        borderRadius: 2,
    },
    sliderTrackActive: {
        position: 'absolute',
        left: 0,
        height: 2,
        borderRadius: 2,
    },
    sliderStepDot: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.bgCards,
        borderWidth: 1.5,
        borderColor: colors.bgStroke,
        top: 4,
    },
    sliderKnob: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 3,
        borderColor: colors.bg,
        top: 0,
        zIndex: 10,
    },
    checkLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    checkbox: {
        width: 16,
        height: 16,
        borderRadius: 4,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        borderColor: colors.mutedText,
    },
    checkLabel: {
        fontFamily: 'Manrope-Bold',
        fontSize: 13,
        color: colors.titleText,
    },
    miniInputGroup: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    miniInputCell: {
        flex: 1,
        backgroundColor: colors.bgCards,
        borderRadius: 6,
        // paddingHorizontal: 8,
        // height: 30,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    miniInputText: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        color: colors.titleText,
        fontSize: 11,
    },
    darkInfoBox: {
        backgroundColor: 'rgba(18, 23, 18, 0.4)',
        borderRadius: 8,
        padding: 8,
        gap: 6,
        borderWidth: 1,
        borderColor: colors.mutedText,
    },
    infoLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    infoLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
    },
    infoValue: {
        fontFamily: 'Manrope-Bold',
        fontSize: 10,
        color: colors.titleText,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: colors.bgCards,
        borderRadius: 20,
        padding: 16,
        width: 250,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    modalOption: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.bgStroke,
    },
    modalOptionText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.titleText,
        textAlign: 'center',
    },
    actionButton: {
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
    },
    actionButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
    },
});
