import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StyleSheet } from 'react-native';

export default function BridgeScreen() {
    return (
        <ThemedView style={styles.container}>
            <ThemedText type="title">Bridge</ThemedText>
            <ThemedText>Multichain bridging coming soon.</ThemedText>
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
