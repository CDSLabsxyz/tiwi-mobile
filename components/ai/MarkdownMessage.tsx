/**
 * Markdown renderer for TIWI AI replies — the React Native counterpart of the
 * web app's `components/ai/markdown-renderer.tsx`. Same supported subset, so a
 * reply looks the same in both apps:
 *
 *   **bold** / __bold__        → semibold
 *   *italic* / _italic_        → italic
 *   `inline code`              → monospace chip
 *   # … ###### headings        → sized headings
 *   - / * / • bullet           → bullet list
 *   1. numbered                → numbered list
 *   > blockquote               → quote block with accent rule
 *   [text](url)                → tappable link
 *   ---                        → horizontal rule
 *
 * Deliberately hand-rolled (no remark/react-markdown) to keep the bundle small
 * and to stay byte-for-byte consistent with the web renderer's behaviour.
 */

import { colors } from '@/constants/colors';
import React from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

const MONOSPACE = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

function openLink(url: string) {
    Linking.openURL(url).catch(() => {
        /* invalid or unhandled scheme — nothing to do */
    });
}

// ─── Inline tokens ───────────────────────────────────────────────────────────

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    let remaining = text;
    let i = 0;

    // Ordered most-specific first, exactly as on web.
    const patterns: {
        regex: RegExp;
        render: (m: RegExpMatchArray, key: string) => React.ReactNode;
    }[] = [
            {
                // `inline code`
                regex: /^`([^`\n]+)`/,
                render: (m, k) => (
                    <Text key={k} style={styles.code}>
                        {m[1]}
                    </Text>
                ),
            },
            {
                // [link text](url)
                regex: /^\[([^\]]+)\]\(([^)]+)\)/,
                render: (m, k) => (
                    <Text key={k} style={styles.link} onPress={() => openLink(m[2])}>
                        {m[1]}
                    </Text>
                ),
            },
            {
                // **bold** or __bold__
                regex: /^(?:\*\*|__)([^*_\n][^\n]*?)(?:\*\*|__)/,
                render: (m, k) => (
                    <Text key={k} style={styles.bold}>
                        {m[1]}
                    </Text>
                ),
            },
            {
                // *italic* or _italic_
                regex: /^(?:\*|_)([^*_\s][^*_\n]*?)(?:\*|_)/,
                render: (m, k) => (
                    <Text key={k} style={styles.italic}>
                        {m[1]}
                    </Text>
                ),
            },
        ];

    while (remaining.length > 0) {
        let matched = false;
        for (const { regex, render } of patterns) {
            const m = remaining.match(regex);
            if (m) {
                nodes.push(render(m, `${keyPrefix}-${i++}`));
                remaining = remaining.slice(m[0].length);
                matched = true;
                break;
            }
        }
        if (matched) continue;

        // Chunk plain text up to the next possible marker.
        const nextSpecial = remaining.search(/[`*_[]/);
        if (nextSpecial === -1) {
            nodes.push(<Text key={`${keyPrefix}-t${i++}`}>{remaining}</Text>);
            break;
        }
        if (nextSpecial === 0) {
            // Orphan marker — emit it literally.
            nodes.push(<Text key={`${keyPrefix}-t${i++}`}>{remaining[0]}</Text>);
            remaining = remaining.slice(1);
        } else {
            nodes.push(<Text key={`${keyPrefix}-t${i++}`}>{remaining.slice(0, nextSpecial)}</Text>);
            remaining = remaining.slice(nextSpecial);
        }
    }

    return nodes;
}

// ─── Block parsing ───────────────────────────────────────────────────────────

interface Block {
    type: 'heading' | 'bullet' | 'numbered' | 'quote' | 'hr' | 'paragraph';
    level?: number;
    items?: string[];
    text?: string;
}

function parseBlocks(markdown: string): Block[] {
    const lines = markdown.split('\n');
    const blocks: Block[] = [];
    let i = 0;

    while (i < lines.length) {
        const trimmed = lines[i].trim();

        if (trimmed === '') {
            i++;
            continue;
        }

        if (/^-{3,}$|^\*{3,}$|^_{3,}$/.test(trimmed)) {
            blocks.push({ type: 'hr' });
            i++;
            continue;
        }

        const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
            i++;
            continue;
        }

        if (trimmed.startsWith('> ')) {
            const quoteLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('> ')) {
                quoteLines.push(lines[i].trim().slice(2));
                i++;
            }
            blocks.push({ type: 'quote', text: quoteLines.join(' ') });
            continue;
        }

        if (/^[-*•]\s+/.test(trimmed)) {
            const items: string[] = [];
            while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
                i++;
            }
            blocks.push({ type: 'bullet', items });
            continue;
        }

        if (/^\d+\.\s+/.test(trimmed)) {
            const items: string[] = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
                i++;
            }
            blocks.push({ type: 'numbered', items });
            continue;
        }

        // Paragraph — consume until a blank line or another block starts.
        const paragraphLines: string[] = [];
        while (
            i < lines.length &&
            lines[i].trim() !== '' &&
            !/^#{1,6}\s/.test(lines[i].trim()) &&
            !/^[-*•]\s+/.test(lines[i].trim()) &&
            !/^\d+\.\s+/.test(lines[i].trim()) &&
            !lines[i].trim().startsWith('> ') &&
            !/^-{3,}$|^\*{3,}$|^_{3,}$/.test(lines[i].trim())
        ) {
            paragraphLines.push(lines[i].trim());
            i++;
        }
        if (paragraphLines.length > 0) {
            blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
        }
    }

    return blocks;
}

const HEADING_SIZES = [19, 17, 15, 15, 14, 14];

export function MarkdownMessage({ content }: { content: string }) {
    const blocks = React.useMemo(() => parseBlocks(content), [content]);

    return (
        <View style={styles.container}>
            {blocks.map((block, bi) => {
                const key = `b-${bi}`;
                switch (block.type) {
                    case 'heading': {
                        const level = block.level || 3;
                        return (
                            <Text
                                key={key}
                                style={[
                                    styles.heading,
                                    { fontSize: HEADING_SIZES[Math.min(level - 1, 5)] },
                                    bi === 0 ? styles.headingFirst : null,
                                ]}
                            >
                                {renderInline(block.text || '', key)}
                            </Text>
                        );
                    }
                    case 'bullet':
                        return (
                            <View key={key} style={styles.list}>
                                {(block.items || []).map((item, ii) => (
                                    <View key={`${key}-${ii}`} style={styles.listRow}>
                                        <Text style={styles.bulletMarker}>•</Text>
                                        <Text style={styles.body}>{renderInline(item, `${key}-${ii}`)}</Text>
                                    </View>
                                ))}
                            </View>
                        );
                    case 'numbered':
                        return (
                            <View key={key} style={styles.list}>
                                {(block.items || []).map((item, ii) => (
                                    <View key={`${key}-${ii}`} style={styles.listRow}>
                                        <Text style={styles.numberMarker}>{ii + 1}.</Text>
                                        <Text style={styles.body}>{renderInline(item, `${key}-${ii}`)}</Text>
                                    </View>
                                ))}
                            </View>
                        );
                    case 'quote':
                        return (
                            <View key={key} style={styles.quote}>
                                <Text style={[styles.body, styles.italic]}>
                                    {renderInline(block.text || '', key)}
                                </Text>
                            </View>
                        );
                    case 'hr':
                        return <View key={key} style={styles.hr} />;
                    case 'paragraph':
                    default:
                        return (
                            <Text key={key} style={styles.body}>
                                {renderInline(block.text || '', key)}
                            </Text>
                        );
                }
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 8,
    },
    body: {
        flex: 1,
        color: colors.bodyText,
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        lineHeight: 21,
    },
    bold: {
        fontFamily: 'Manrope-SemiBold',
        color: colors.titleText,
    },
    italic: {
        fontStyle: 'italic',
    },
    code: {
        fontFamily: MONOSPACE,
        fontSize: 13,
        color: colors.primaryCTA,
        backgroundColor: colors.bgStroke,
    },
    link: {
        color: '#5BA1FF',
        textDecorationLine: 'underline',
    },
    heading: {
        color: colors.titleText,
        fontFamily: 'Manrope-Bold',
        marginTop: 4,
    },
    headingFirst: {
        marginTop: 0,
    },
    list: {
        gap: 4,
    },
    listRow: {
        flexDirection: 'row',
        gap: 8,
        paddingLeft: 4,
    },
    bulletMarker: {
        color: colors.primaryCTA,
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        lineHeight: 21,
    },
    numberMarker: {
        color: colors.primaryCTA,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        lineHeight: 21,
        minWidth: 18,
    },
    quote: {
        borderLeftWidth: 2,
        borderLeftColor: colors.primaryCTA,
        paddingLeft: 12,
    },
    hr: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.bgStroke,
        marginVertical: 4,
    },
});
