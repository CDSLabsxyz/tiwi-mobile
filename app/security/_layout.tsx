import { Stack } from 'expo-router';
import React from 'react';

export default function SecurityLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="confirm" />
            <Stack.Screen name="biometrics" />
            <Stack.Screen name="notifications" />
        </Stack>
    );
}
