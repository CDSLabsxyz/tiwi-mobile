/**
 * Project settings — mobile counterpart of the web modal's
 * `renderProjectSettings`. Rename the project, see its chat count, and toggle
 * its pinned state.
 */

import { colors } from '@/constants/colors';
import type { ChatProject } from '@/lib/ai/message-tree';
import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface ProjectSettingsModalProps {
    project: ChatProject | null;
    chatCount: number;
    onClose: () => void;
    onSave: (title: string) => void;
    onTogglePin: () => void;
}

export function ProjectSettingsModal({
    project,
    chatCount,
    onClose,
    onSave,
    onTogglePin,
}: ProjectSettingsModalProps) {
    const [draft, setDraft] = useState('');

    useEffect(() => {
        setDraft(project?.title || '');
    }, [project]);

    if (!project) return null;

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.card}>
                    <View style={styles.accent} />
                    <View style={styles.header}>
                        <View style={styles.headerText}>
                            <Text style={styles.eyebrow}>PROJECT SETTINGS</Text>
                            <Text style={styles.title} numberOfLines={1}>
                                {project.title}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}>
                            <Feather name="x" size={15} color="#9AA39A" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.fieldLabel}>Name</Text>
                    <TextInput
                        value={draft}
                        onChangeText={setDraft}
                        onSubmitEditing={() => onSave(draft)}
                        style={styles.input}
                        placeholderTextColor={colors.mutedText}
                    />

                    <View style={styles.tiles}>
                        <View style={styles.tile}>
                            <Text style={styles.tileLabel}>Chats</Text>
                            <Text style={styles.tileValue}>{chatCount}</Text>
                        </View>
                        <TouchableOpacity
                            onPress={onTogglePin}
                            style={[styles.tile, project.pinned && styles.tilePinned]}
                        >
                            <Text style={styles.tileLabel}>Pin status</Text>
                            <View style={styles.tilePinRow}>
                                <Feather
                                    name="bookmark"
                                    size={13}
                                    color={project.pinned ? colors.primaryCTA : colors.titleText}
                                />
                                <Text
                                    style={[styles.tileValue, project.pinned && styles.tileValuePinned]}
                                >
                                    {project.pinned ? 'Pinned' : 'Pin project'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.cancel} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.save} onPress={() => onSave(draft)}>
                            <Text style={styles.saveText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    card: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        backgroundColor: colors.bgSemi,
        padding: 20,
        overflow: 'hidden',
    },
    accent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: colors.primaryCTA,
        opacity: 0.6,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16,
        marginBottom: 20,
    },
    headerText: {
        flex: 1,
    },
    eyebrow: {
        color: colors.primaryCTA,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
        letterSpacing: 1.6,
    },
    title: {
        color: colors.titleText,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 17,
        marginTop: 4,
    },
    close: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        backgroundColor: '#10200D',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fieldLabel: {
        color: '#9AA39A',
        fontFamily: 'Manrope-SemiBold',
        fontSize: 11,
    },
    input: {
        marginTop: 8,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        backgroundColor: '#050805',
        paddingHorizontal: 12,
        paddingVertical: 12,
        color: colors.titleText,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
    },
    tiles: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    tile: {
        flex: 1,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        backgroundColor: '#050805',
        padding: 12,
    },
    tilePinned: {
        borderColor: 'rgba(177,241,40,0.7)',
        backgroundColor: '#10200D',
    },
    tileLabel: {
        color: '#8C978C',
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
    },
    tileValue: {
        color: colors.titleText,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        marginTop: 4,
    },
    tileValuePinned: {
        color: colors.primaryCTA,
    },
    tilePinRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    cancel: {
        flex: 1,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        alignItems: 'center',
        paddingVertical: 12,
    },
    cancelText: {
        color: colors.bodyText,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
    },
    save: {
        flex: 1,
        borderRadius: 12,
        backgroundColor: colors.primaryCTA,
        alignItems: 'center',
        paddingVertical: 12,
    },
    saveText: {
        color: colors.bg,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
    },
});
