/**
 * Project home — mobile counterpart of the web modal's `renderProjectHome`.
 * Shows the project title, a "new chat in this project" composer (with voice),
 * and the project's chats with a preview + last-updated date.
 */

import { colors } from '@/constants/colors';
import type { ChatProject, ChatSession } from '@/lib/ai/message-tree';
import { getActivePath } from '@/lib/ai/message-tree';
import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface ProjectHomeViewProps {
    project: ChatProject;
    sessions: ChatSession[];
    prompt: string;
    onPromptChange: (value: string) => void;
    onStartChat: () => void;
    onSelectSession: (sessionId: string) => void;
    onOpenSettings: () => void;
    onClose: () => void;
    isListening: boolean;
    onToggleVoice: () => void;
}

const formatSessionDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function ProjectHomeView({
    project,
    sessions,
    prompt,
    onPromptChange,
    onStartChat,
    onSelectSession,
    onOpenSettings,
    onClose,
    isListening,
    onToggleVoice,
}: ProjectHomeViewProps) {
    const ordered = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.back}>
                    <Feather name="arrow-left" size={20} color={colors.titleText} />
                </TouchableOpacity>
                <View style={styles.titleBlock}>
                    <Feather name="folder" size={20} color={colors.titleText} />
                    <Text style={styles.title} numberOfLines={1}>
                        {project.title}
                    </Text>
                </View>
                <TouchableOpacity onPress={onOpenSettings} hitSlop={10} style={styles.back}>
                    <Feather name="more-horizontal" size={20} color={colors.titleText} />
                </TouchableOpacity>
            </View>

            <View style={styles.composer}>
                <TouchableOpacity onPress={onStartChat} hitSlop={8} style={styles.composerIcon}>
                    <Feather name="plus" size={18} color={colors.primaryCTA} />
                </TouchableOpacity>
                <TextInput
                    value={prompt}
                    onChangeText={onPromptChange}
                    onSubmitEditing={onStartChat}
                    placeholder={`New chat in ${project.title}`}
                    placeholderTextColor="#9AA39A"
                    style={styles.composerInput}
                />
                <TouchableOpacity onPress={onToggleVoice} hitSlop={8} style={styles.composerIcon}>
                    {isListening ? (
                        <View style={styles.recordingDot} />
                    ) : (
                        <Feather name="mic" size={16} color="#9AA39A" />
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.tabRow}>
                <View style={styles.tabActive}>
                    <Text style={styles.tabActiveText}>Chats</Text>
                </View>
            </View>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {ordered.length > 0 ? (
                    ordered.map((session) => {
                        const preview =
                            getActivePath(session.tree).find((m) => m.type === 'user')?.text ||
                            'New project chat';
                        return (
                            <TouchableOpacity
                                key={session.id}
                                style={styles.sessionRow}
                                onPress={() => onSelectSession(session.id)}
                            >
                                <View style={styles.sessionMain}>
                                    <Text style={styles.sessionTitle} numberOfLines={1}>
                                        {session.title}
                                    </Text>
                                    <Text style={styles.sessionPreview} numberOfLines={1}>
                                        {preview}
                                    </Text>
                                </View>
                                <Text style={styles.sessionDate}>{formatSessionDate(session.updatedAt)}</Text>
                            </TouchableOpacity>
                        );
                    })
                ) : (
                    <View style={styles.empty}>
                        <Text style={styles.emptyTitle}>No chats in this project yet</Text>
                        <Text style={styles.emptySubtitle}>Start one from the project prompt above.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 16,
    },
    back: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleBlock: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    title: {
        flex: 1,
        color: colors.titleText,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
    },
    composer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        backgroundColor: colors.bgSemi,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 20,
    },
    composerIcon: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    composerInput: {
        flex: 1,
        color: colors.titleText,
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        paddingVertical: 4,
    },
    recordingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.error,
    },
    tabRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    tabActive: {
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        backgroundColor: '#10200D',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    tabActiveText: {
        color: colors.primaryCTA,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 24,
    },
    sessionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(31,60,25,0.6)',
        paddingVertical: 14,
    },
    sessionMain: {
        flex: 1,
    },
    sessionTitle: {
        color: colors.titleText,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
    },
    sessionPreview: {
        color: colors.bodyText,
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        marginTop: 4,
    },
    sessionDate: {
        color: '#9AA39A',
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
    },
    empty: {
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        backgroundColor: colors.bgSemi,
        padding: 24,
        alignItems: 'center',
    },
    emptyTitle: {
        color: colors.titleText,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
    },
    emptySubtitle: {
        color: '#9AA39A',
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        marginTop: 4,
    },
});
