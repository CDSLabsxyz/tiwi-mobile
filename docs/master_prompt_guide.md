# Master Prompt Guide - Tiwi Protocol

This guide provides specialized prompts and best practices for building Tiwi Protocol features using modern Expo (SDK 50+) and React Native.

## Core Design Principles
- **Aesthetics First**: Use the design system tokens in `theme/`. High-end feel with glassmorphism, subtle gradients, and smooth animations.
- **Type Safety**: Use TypeScript for everything. No `any`.
- **Performance**: Use `react-native-reanimated` for animations and `expo-image` for images.
- **Modular**: Components should be atomic and feature-based.

## Prompt Templates

### 1. Creating a New UI Component
> "Create a new atomic UI component `[Name]` in `components/ui`. Use `StyleSheet` with Tiwi theme tokens. Ensure it supports `[variants]` and is fully typed. Use `ThemedView` and `ThemedText` for automatic dark mode support."

### 2. Creating a Feature Screen
> "Implement the `[Feature]` screen in `app/(tabs)/[name].tsx`. Use a `components/features/[Feature]Widget` to handle core logic. Integrate it with `TanStack Query` for data fetching from `api/[name]`. Use `Suspense` or `Loading` skeletons."

### 3. Adding a Multichain Interaction
> "Add a `[Swap/Bridge]` interaction using `Wagmi` and `Viem`. Manage the transaction state in `store/useTransactionStore`. UI should show clear feedback for 'Pending', 'Success', and 'Failed' states using `expo-haptics`."

### 4. Animating an Element
> "Add a spring-based enter animation to the `[Element]` using `react-native-reanimated`. Use `withSpring` for a natural feel. Ensure it is optimized for 60fps on mobile."

## Best Practices
- **Navigation**: Always use `expo-router` for navigation. Prefer `<Link>` over manual `router.push` where possible.
- **Icons**: Use `@expo/vector-icons` (Ionicons/MaterialIcons).
- **Safe Area**: Always wrap screens in `SafeAreaView` from `react-native-safe-area-context`.
- **Haptics**: Use `expo-haptics` for tactile feedback on major user actions (e.g., wallet connection, swap success).
