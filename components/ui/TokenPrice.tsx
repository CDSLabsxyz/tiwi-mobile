import { usePrice } from '@/hooks/useLocalization';
import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

interface TokenPriceProps {
    amount: number | string | undefined;
    style?: StyleProp<TextStyle>;
}

/**
 * TokenPrice Component
 * 
 * A reactive component that automatically converts USD amounts to the
 * user's preferred currency (NGN, EUR, etc.) and formats it locally.
 */
export const TokenPrice: React.FC<TokenPriceProps> = ({ amount, style }) => {
    const formattedPrice = usePrice(amount);

    return (
        <Text style={style}>
            {formattedPrice}
        </Text>
    );
};
