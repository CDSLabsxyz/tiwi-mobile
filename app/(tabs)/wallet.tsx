import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StyleSheet } from 'react-native';

export default function WalletScreen() {
    return (
        <ThemedView style={styles.container}>
            <ThemedText type="title">Wallet</ThemedText>
            <ThemedText>Secure multichain wallet coming soon.</ThemedText>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
