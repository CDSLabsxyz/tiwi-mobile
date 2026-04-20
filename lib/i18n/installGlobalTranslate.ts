/**
 * Install a global auto-translate wrapper on React Native's <Text>.
 *
 * RN 0.81 exposes `Text` via a lazy getter on the `react-native` module
 * (`get Text() { return require('./Libraries/Text/Text').default; }`).
 * Babel compiles `import { Text } from 'react-native'` to usage-site reads
 * like `(0, _reactNative.Text)(...)` — so if we overwrite the `Text`
 * property on the exports object *before any component renders*, every
 * downstream call picks up the wrapped version.
 *
 * Call `installGlobalTranslate()` as early as possible. The bootstrap file
 * in `lib/i18n/bootstrap.ts` runs it on import; `_layout.tsx` imports that
 * bootstrap right after polyfills so everything else sees the patched Text.
 *
 * This is the React-Native equivalent of the web app's LiveTranslator.
 */

import React from 'react';
import ReactNative, { Text as OriginalText, type TextProps } from 'react-native';
import { useLocaleStore } from '@/store/localeStore';
import { autoTranslate, useAutoTranslateStore } from './autoTranslate';

function translateChildren(children: unknown, language: string): unknown {
    if (typeof children === 'string') {
        return autoTranslate(children, language);
    }
    if (typeof children === 'number') {
        return children;
    }
    if (Array.isArray(children)) {
        let changed = false;
        const next = children.map((child) => {
            if (typeof child === 'string') {
                const translated = autoTranslate(child, language);
                if (translated !== child) changed = true;
                return translated;
            }
            return child;
        });
        return changed ? next : children;
    }
    return children;
}

type TextComponent = React.ComponentType<TextProps & { ref?: React.Ref<any> }>;

function createTranslatedText(Base: TextComponent): TextComponent {
    const Wrapped = React.forwardRef<any, TextProps>(function TiwiTranslatedText(props, ref) {
        // Subscribe to the current language and the auto-translate cache
        // version. Both are plain useSelectors — cheap and selective.
        const language = useLocaleStore((s) => s.language);
        useAutoTranslateStore((s) => s.version);

        const children = (props as any).children;
        const nextChildren = translateChildren(children, language);

        if (nextChildren === children) {
            return React.createElement(Base as any, { ...props, ref });
        }
        return React.createElement(Base as any, { ...props, ref, children: nextChildren });
    });
    Wrapped.displayName = 'TiwiText';
    // Expose `displayName` + mark so we can detect and skip re-wrapping on
    // hot-reload.
    (Wrapped as any).__tiwiWrapped = true;
    return Wrapped as unknown as TextComponent;
}

export function installGlobalTranslate(): void {
    const rnExports = ReactNative as unknown as {
        Text: TextComponent;
        __tiwiTextPatched?: boolean;
    };

    if (rnExports.__tiwiTextPatched) return;

    const base = (OriginalText as any).__tiwiWrapped ? (OriginalText as any) : OriginalText;
    const Wrapped = createTranslatedText(base as TextComponent);

    try {
        Object.defineProperty(rnExports, 'Text', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: Wrapped,
        });
        rnExports.__tiwiTextPatched = true;
    } catch (err) {
        console.warn('[tiwi/i18n] Failed to patch Text:', err);
    }
}
