/**
 * Chat history drawer — the mobile counterpart of the web AI modal's sidebar.
 *
 * Same structure and actions: New chat, Search chats, Pinned prompt shortcuts,
 * Projects (create / rename / pin / delete / home / settings, with their chats
 * nested underneath), and the flat Chats list. The organise menu switches
 * between "In one list" and "By project" exactly as on web.
 */

import { colors } from '@/constants/colors';
import type { ChatProject, ChatSession, OrganizationMode } from '@/lib/ai/message-tree';
import Feather from '@expo/vector-icons/Feather';
import React, { useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Prompt shortcuts pinned above the project list (same two as web). */
export const PINNED_PROMPTS: { label: string; prompt: string }[] = [
    { label: 'Token risk scan', prompt: 'Run a risk checklist for this token.' },
    { label: 'LP strategy', prompt: 'Suggest a DeFi liquidity strategy for my portfolio.' },
];

/** How many of a project's chats are nested before "Show more". */
const NESTED_LIMIT = 6;

interface ChatHistoryDrawerProps {
    visible: boolean;
    onClose: () => void;

    sessions: ChatSession[];
    projects: ChatProject[];
    activeSessionId: string;
    organizationMode: OrganizationMode;
    search: string;
    sessionsInProject: (projectId: string) => ChatSession[];

    onSearchChange: (value: string) => void;
    onOrganizationModeChange: (mode: OrganizationMode) => void;

    onNewChat: (projectId: string | null) => void;
    onSeedPrompt: (prompt: string) => void;
    onSelectSession: (sessionId: string) => void;
    onRenameSession: (sessionId: string, title: string) => void;
    onToggleSessionPin: (sessionId: string) => void;
    onDeleteSession: (sessionId: string) => void;
    onCopy: (text: string) => void;

    onCreateProject: () => void;
    onRenameProject: (projectId: string, title: string) => void;
    onToggleProjectPin: (projectId: string) => void;
    onDeleteProject: (projectId: string) => void;
    onOpenProjectHome: (projectId: string) => void;
    onOpenProjectSettings: (projectId: string) => void;
}

export function ChatHistoryDrawer({
    visible,
    onClose,
    sessions,
    projects,
    activeSessionId,
    organizationMode,
    search,
    sessionsInProject,
    onSearchChange,
    onOrganizationModeChange,
    onNewChat,
    onSeedPrompt,
    onSelectSession,
    onRenameSession,
    onToggleSessionPin,
    onDeleteSession,
    onCopy,
    onCreateProject,
    onRenameProject,
    onToggleProjectPin,
    onDeleteProject,
    onOpenProjectHome,
    onOpenProjectSettings,
}: ChatHistoryDrawerProps) {
    const { top, bottom } = useSafeAreaInsets();

    const [showSearch, setShowSearch] = useState(false);
    const [projectsOpen, setProjectsOpen] = useState(true);
    const [showOrganizeMenu, setShowOrganizeMenu] = useState(false);
    const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
    const [sessionMenuId, setSessionMenuId] = useState<string | null>(null);
    const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
    const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);

    const closeMenus = () => {
        setShowOrganizeMenu(false);
        setProjectMenuId(null);
        setSessionMenuId(null);
    };

    const startRenameProject = (project: ChatProject) => {
        setDraft(project.title);
        setRenamingProjectId(project.id);
        closeMenus();
    };

    const startRenameSession = (session: ChatSession) => {
        setDraft(session.title);
        setRenamingSessionId(session.id);
        closeMenus();
    };

    const commitRename = () => {
        if (renamingProjectId) onRenameProject(renamingProjectId, draft);
        if (renamingSessionId) onRenameSession(renamingSessionId, draft);
        setRenamingProjectId(null);
        setRenamingSessionId(null);
        setDraft('');
    };

    const renderSessionRow = (session: ChatSession, nested = false) => {
        if (renamingSessionId === session.id) {
            return (
                <TextInput
                    key={session.id}
                    value={draft}
                    onChangeText={setDraft}
                    onBlur={commitRename}
                    onSubmitEditing={commitRename}
                    autoFocus
                    style={styles.renameInput}
                    placeholderTextColor={colors.mutedText}
                />
            );
        }

        const isActive = session.id === activeSessionId;

        return (
            <View key={session.id}>
                <View style={[styles.row, nested && styles.rowNested, isActive && styles.rowActive]}>
                    <TouchableOpacity
                        style={styles.rowMain}
                        onPress={() => {
                            closeMenus();
                            onSelectSession(session.id);
                            onClose();
                        }}
                    >
                        {!nested && (
                            <Feather
                                name="message-square"
                                size={15}
                                color={isActive ? colors.primaryCTA : colors.titleText}
                            />
                        )}
                        {session.pinned && (
                            <Feather name="bookmark" size={13} color={colors.primaryCTA} />
                        )}
                        <Text
                            numberOfLines={1}
                            style={[styles.rowLabel, isActive && styles.rowLabelActive]}
                        >
                            {session.title}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        hitSlop={8}
                        style={styles.rowAction}
                        onPress={() =>
                            setSessionMenuId((current) => (current === session.id ? null : session.id))
                        }
                    >
                        <Feather name="more-horizontal" size={16} color={colors.mutedText} />
                    </TouchableOpacity>
                </View>

                {sessionMenuId === session.id && (
                    <View style={styles.menu}>
                        <MenuItem
                            icon="edit-2"
                            label="Rename chat"
                            onPress={() => startRenameSession(session)}
                        />
                        <MenuItem
                            icon="bookmark"
                            label={session.pinned ? 'Unpin chat' : 'Pin chat'}
                            onPress={() => {
                                onToggleSessionPin(session.id);
                                closeMenus();
                            }}
                        />
                        <MenuItem
                            icon="copy"
                            label="Copy title"
                            onPress={() => {
                                onCopy(session.title);
                                closeMenus();
                            }}
                        />
                        <View style={styles.menuDivider} />
                        <MenuItem
                            icon="trash-2"
                            label="Delete chat"
                            danger
                            onPress={() => {
                                onDeleteSession(session.id);
                                closeMenus();
                            }}
                        />
                    </View>
                )}
            </View>
        );
    };

    const renderProject = (project: ChatProject) => {
        if (renamingProjectId === project.id) {
            return (
                <TextInput
                    key={project.id}
                    value={draft}
                    onChangeText={setDraft}
                    onBlur={commitRename}
                    onSubmitEditing={commitRename}
                    autoFocus
                    style={styles.renameInput}
                    placeholderTextColor={colors.mutedText}
                />
            );
        }

        const projectSessions = sessionsInProject(project.id);
        const expanded = expandedProjectIds.includes(project.id);
        const shown =
            organizationMode === 'project'
                ? expanded
                    ? projectSessions
                    : projectSessions.slice(0, NESTED_LIMIT)
                : [];

        return (
            <View key={project.id}>
                <View style={styles.row}>
                    <TouchableOpacity
                        style={styles.rowMain}
                        onPress={() => {
                            closeMenus();
                            onOpenProjectHome(project.id);
                        }}
                    >
                        <Feather name="folder" size={15} color={colors.titleText} />
                        {project.pinned && (
                            <Feather name="bookmark" size={13} color={colors.primaryCTA} />
                        )}
                        <Text numberOfLines={1} style={styles.rowLabel}>
                            {project.title}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        hitSlop={8}
                        style={styles.rowAction}
                        onPress={() => {
                            closeMenus();
                            onNewChat(project.id);
                            onClose();
                        }}
                    >
                        <Feather name="edit" size={15} color={colors.mutedText} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        hitSlop={8}
                        style={styles.rowAction}
                        onPress={() =>
                            setProjectMenuId((current) => (current === project.id ? null : project.id))
                        }
                    >
                        <Feather name="more-horizontal" size={16} color={colors.mutedText} />
                    </TouchableOpacity>
                </View>

                {projectMenuId === project.id && (
                    <View style={styles.menu}>
                        <MenuItem
                            icon="share-2"
                            label="Share project"
                            onPress={() => {
                                onCopy(project.title);
                                closeMenus();
                            }}
                        />
                        <MenuItem
                            icon="edit-2"
                            label="Rename project"
                            onPress={() => startRenameProject(project)}
                        />
                        <MenuItem
                            icon="settings"
                            label="Project settings"
                            onPress={() => {
                                closeMenus();
                                onOpenProjectSettings(project.id);
                            }}
                        />
                        <MenuItem
                            icon="home"
                            label="Project home"
                            onPress={() => {
                                closeMenus();
                                onOpenProjectHome(project.id);
                            }}
                        />
                        <View style={styles.menuDivider} />
                        <MenuItem
                            icon="bookmark"
                            label={project.pinned ? 'Unpin project' : 'Pin project'}
                            onPress={() => {
                                onToggleProjectPin(project.id);
                                closeMenus();
                            }}
                        />
                        <MenuItem
                            icon="trash-2"
                            label="Delete project"
                            danger
                            onPress={() => {
                                onDeleteProject(project.id);
                                closeMenus();
                            }}
                        />
                    </View>
                )}

                {shown.map((session) => renderSessionRow(session, true))}
                {organizationMode === 'project' && projectSessions.length > NESTED_LIMIT && (
                    <TouchableOpacity
                        onPress={() =>
                            setExpandedProjectIds((prev) =>
                                expanded ? prev.filter((id) => id !== project.id) : [...prev, project.id],
                            )
                        }
                        style={styles.showMore}
                    >
                        <Text style={styles.showMoreText}>{expanded ? 'Show less' : 'Show more'}</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    // In "list" mode every chat appears in the flat Chats list; in "project"
    // mode only unfiled chats do (the rest are nested under their project).
    const flatSessions = sessions.filter(
        (session) => organizationMode === 'list' || !session.projectId,
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={[styles.drawer, { paddingTop: top || 16 }]}>
                    <View style={styles.header}>
                        <View style={styles.headerText}>
                            <Text style={styles.headerTitle}>Chat history</Text>
                            <Text style={styles.headerSubtitle}>
                                Projects, pinned chats, and sessions
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.headerClose}>
                            <Feather name="x" size={18} color={colors.mutedText} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.scroll}
                        contentContainerStyle={[styles.scrollContent, { paddingBottom: (bottom || 16) + 24 }]}
                        keyboardShouldPersistTaps="handled"
                    >
                        <TouchableOpacity
                            style={[styles.actionButton, styles.actionButtonPrimary]}
                            onPress={() => {
                                closeMenus();
                                onNewChat(null);
                                onClose();
                            }}
                        >
                            <Feather name="edit" size={15} color={colors.primaryCTA} />
                            <Text style={[styles.actionLabel, styles.actionLabelPrimary]}>New chat</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => setShowSearch((v) => !v)}
                        >
                            <Feather name="search" size={15} color={colors.titleText} />
                            <Text style={styles.actionLabel}>Search chats</Text>
                        </TouchableOpacity>

                        {showSearch && (
                            <TextInput
                                value={search}
                                onChangeText={onSearchChange}
                                placeholder="Search history"
                                placeholderTextColor={colors.mutedText}
                                style={styles.searchInput}
                            />
                        )}

                        <Text style={styles.sectionTitle}>Pinned</Text>
                        {PINNED_PROMPTS.map((item) => (
                            <TouchableOpacity
                                key={item.label}
                                style={styles.actionButton}
                                onPress={() => {
                                    closeMenus();
                                    onSeedPrompt(item.prompt);
                                    onClose();
                                }}
                            >
                                <Feather name="bookmark" size={15} color={colors.titleText} />
                                <Text style={styles.actionLabel} numberOfLines={1}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        ))}

                        <View style={styles.sectionHeaderRow}>
                            <TouchableOpacity
                                style={styles.sectionToggle}
                                onPress={() => setProjectsOpen((v) => !v)}
                            >
                                <Text style={styles.sectionTitleInline}>Projects</Text>
                                <Feather
                                    name={projectsOpen ? 'chevron-down' : 'chevron-right'}
                                    size={14}
                                    color={colors.titleText}
                                />
                            </TouchableOpacity>
                            <View style={styles.sectionHeaderActions}>
                                <TouchableOpacity
                                    hitSlop={8}
                                    onPress={() => {
                                        closeMenus();
                                        onCreateProject();
                                    }}
                                >
                                    <Feather name="plus" size={17} color={colors.titleText} />
                                </TouchableOpacity>
                                <TouchableOpacity hitSlop={8} onPress={() => setShowOrganizeMenu((v) => !v)}>
                                    <Feather name="more-horizontal" size={17} color={colors.titleText} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {showOrganizeMenu && (
                            <View style={styles.menu}>
                                <Text style={styles.menuHeading}>Organize chats</Text>
                                <MenuItem
                                    icon="list"
                                    label="In one list"
                                    trailing={organizationMode === 'list' ? 'check' : undefined}
                                    onPress={() => {
                                        onOrganizationModeChange('list');
                                        setShowOrganizeMenu(false);
                                    }}
                                />
                                <MenuItem
                                    icon="folder"
                                    label="By project"
                                    trailing={organizationMode === 'project' ? 'check' : undefined}
                                    onPress={() => {
                                        onOrganizationModeChange('project');
                                        setShowOrganizeMenu(false);
                                    }}
                                />
                            </View>
                        )}

                        {projectsOpen && projects.map(renderProject)}

                        <Text style={styles.sectionTitle}>Chats</Text>
                        {flatSessions.length > 0 ? (
                            flatSessions.map((session) => renderSessionRow(session))
                        ) : (
                            <Text style={styles.emptyText}>No chats found</Text>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

function MenuItem({
    icon,
    label,
    onPress,
    danger,
    trailing,
}: {
    icon: React.ComponentProps<typeof Feather>['name'];
    label: string;
    onPress: () => void;
    danger?: boolean;
    trailing?: React.ComponentProps<typeof Feather>['name'];
}) {
    const tint = danger ? colors.error : '#EEF5EA';
    return (
        <TouchableOpacity style={styles.menuItem} onPress={onPress}>
            <Feather name={icon} size={15} color={tint} />
            <Text style={[styles.menuItemLabel, { color: tint }]}>{label}</Text>
            {trailing && (
                <Feather name={trailing} size={15} color={colors.primaryCTA} style={styles.menuTrailing} />
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        flexDirection: 'row',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    drawer: {
        width: '86%',
        maxWidth: 340,
        height: '100%',
        backgroundColor: '#050805',
        borderRightWidth: StyleSheet.hairlineWidth,
        borderRightColor: colors.bgStroke,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.bgStroke,
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        color: colors.primaryCTA,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
    },
    headerSubtitle: {
        color: colors.mutedText,
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        marginTop: 2,
    },
    headerClose: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.bgStroke,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 8,
        paddingTop: 12,
        gap: 2,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    actionButtonPrimary: {
        backgroundColor: '#18330B',
    },
    actionLabel: {
        color: colors.titleText,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
        flexShrink: 1,
    },
    actionLabelPrimary: {
        color: colors.primaryCTA,
    },
    searchInput: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.bgStroke,
        backgroundColor: colors.bgSemi,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        color: colors.titleText,
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        marginHorizontal: 4,
        marginBottom: 6,
    },
    sectionTitle: {
        color: colors.titleText,
        fontFamily: 'Manrope-Bold',
        fontSize: 12,
        paddingHorizontal: 12,
        marginTop: 20,
        marginBottom: 4,
    },
    sectionTitleInline: {
        color: colors.titleText,
        fontFamily: 'Manrope-Bold',
        fontSize: 13,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        marginTop: 20,
        marginBottom: 4,
    },
    sectionToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sectionHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        paddingRight: 4,
    },
    rowNested: {
        marginLeft: 20,
    },
    rowActive: {
        backgroundColor: '#10200D',
    },
    rowMain: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    rowLabel: {
        flex: 1,
        color: colors.titleText,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
    },
    rowLabelActive: {
        color: colors.primaryCTA,
    },
    rowAction: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menu: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
        padding: 6,
        marginHorizontal: 8,
        marginVertical: 4,
    },
    menuHeading: {
        color: colors.bodyText,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    menuItemLabel: {
        flex: 1,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
    },
    menuTrailing: {
        marginLeft: 'auto',
    },
    menuDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#1F3C19',
        marginVertical: 4,
    },
    renameInput: {
        borderWidth: 1,
        borderColor: 'rgba(177,241,40,0.4)',
        backgroundColor: colors.bgSemi,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        color: colors.titleText,
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        marginVertical: 2,
    },
    showMore: {
        paddingLeft: 44,
        paddingVertical: 6,
    },
    showMoreText: {
        color: colors.mutedText,
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
    },
    emptyText: {
        color: colors.mutedText,
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
});
