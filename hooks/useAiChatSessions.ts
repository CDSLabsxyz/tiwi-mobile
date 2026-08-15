/**
 * Chat sessions + projects for the TIWI AI screen.
 *
 * Port of the web app's session/project sidebar state (`ai-chat-modal.tsx`):
 * many chats, foldered into projects, each renameable / pinnable / deletable,
 * with a search filter and a list-vs-project organisation mode.
 *
 * Everything is scoped to the active wallet, matching how the mobile chat
 * already stored its single thread - one wallet's history never leaks into
 * another's, and a legacy single-thread payload is migrated into session #1.
 */

import {
    createChatProject,
    createChatSession,
    createDefaultProjects,
    emptyTree,
    getChatTitle,
    isMessageTree,
    normalizeProjects,
    normalizeSessions,
    settleTree,
    type ChatMessage,
    type ChatProject,
    type ChatSession,
    type MessageTree,
    type OrganizationMode,
} from '@/lib/ai/message-tree';
import { buildTreeFromArray } from '@/lib/ai/message-tree';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const scope = (address?: string | null) => address || 'guest';

const SESSIONS_KEY = (address?: string | null) => `@tiwi/ai_chat_sessions_${scope(address)}`;
const ACTIVE_KEY = (address?: string | null) => `@tiwi/ai_chat_active_${scope(address)}`;
const PROJECTS_KEY = (address?: string | null) => `@tiwi/ai_chat_projects_${scope(address)}`;
const ORGANIZATION_KEY = (address?: string | null) => `@tiwi/ai_chat_org_${scope(address)}`;
/** The pre-sessions storage key - a single tree (or flat array) per wallet. */
const LEGACY_KEY = (address?: string | null) => `@tiwi/ai_chat_${scope(address)}`;

export interface AiChatSessionsApi {
    /** False until the persisted state for this wallet has been read. */
    hydrated: boolean;

    sessions: ChatSession[];
    projects: ChatProject[];
    activeSessionId: string;
    activeSession: ChatSession | null;
    /** The active session's message tree - the conversation on screen. */
    tree: MessageTree;

    organizationMode: OrganizationMode;
    setOrganizationMode: (mode: OrganizationMode) => void;

    search: string;
    setSearch: (value: string) => void;
    /** Sessions matching `search`, pinned first then most-recent. */
    filteredSessions: ChatSession[];
    /** Projects sorted pinned-first then most-recently-updated. */
    sortedProjects: ChatProject[];
    sessionsInProject: (projectId: string) => ChatSession[];

    /** Replace the active session's tree (re-titles it from the first prompt). */
    setTree: (updater: MessageTree | ((prev: MessageTree) => MessageTree)) => void;

    newChat: (projectId?: string | null) => string;
    selectSession: (sessionId: string) => void;
    renameSession: (sessionId: string, title: string) => void;
    toggleSessionPin: (sessionId: string) => void;
    deleteSession: (sessionId: string) => void;
    moveSessionToProject: (sessionId: string, projectId: string | null) => void;
    /** Wipe the active conversation without deleting the session. */
    clearActiveChat: () => void;

    createProject: (title?: string) => string;
    renameProject: (projectId: string, title: string) => void;
    toggleProjectPin: (projectId: string) => void;
    deleteProject: (projectId: string) => void;
}

export function useAiChatSessions(address?: string | null): AiChatSessionsApi {
    const [hydrated, setHydrated] = useState(false);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [projects, setProjects] = useState<ChatProject[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string>('');
    const [organizationMode, setOrganizationModeState] = useState<OrganizationMode>('project');
    const [search, setSearch] = useState('');

    // Guards writes until the read for THIS wallet finished, so switching
    // wallets can't flush the previous wallet's state into the new bucket.
    const loadedScopeRef = useRef<string | null>(null);

    // ── Load ────────────────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const currentScope = scope(address);
        setHydrated(false);
        loadedScopeRef.current = null;

        (async () => {
            let loadedSessions: ChatSession[] = [];
            let loadedProjects: ChatProject[] = [];
            let loadedActiveId = '';
            let loadedMode: OrganizationMode = 'project';

            try {
                const [rawSessions, rawProjects, rawActive, rawMode] = await AsyncStorage.multiGet([
                    SESSIONS_KEY(address),
                    PROJECTS_KEY(address),
                    ACTIVE_KEY(address),
                    ORGANIZATION_KEY(address),
                ]).then((entries) => entries.map(([, v]) => v));

                loadedProjects = normalizeProjects(rawProjects ? JSON.parse(rawProjects) : null);
                if (loadedProjects.length === 0) loadedProjects = createDefaultProjects();

                loadedSessions = normalizeSessions(rawSessions ? JSON.parse(rawSessions) : null);
                loadedActiveId = rawActive || '';
                loadedMode = rawMode === 'list' ? 'list' : 'project';
            } catch {
                loadedProjects = createDefaultProjects();
            }

            // No sessions yet → migrate the legacy single-thread payload, which
            // may be either a MessageTree or the even older flat array.
            if (loadedSessions.length === 0) {
                let legacyTree: MessageTree = emptyTree;
                try {
                    const rawLegacy = await AsyncStorage.getItem(LEGACY_KEY(address));
                    if (rawLegacy) {
                        const parsed = JSON.parse(rawLegacy);
                        if (Array.isArray(parsed)) legacyTree = buildTreeFromArray(parsed as ChatMessage[]);
                        else if (isMessageTree(parsed)) legacyTree = settleTree(parsed);
                    }
                } catch {
                    legacyTree = emptyTree;
                }
                loadedSessions = [createChatSession(legacyTree)];
            }

            if (cancelled) return;

            const active =
                loadedSessions.find((s) => s.id === loadedActiveId) || loadedSessions[0];

            setProjects(loadedProjects);
            setSessions(loadedSessions);
            setActiveSessionId(active.id);
            setOrganizationModeState(loadedMode);
            loadedScopeRef.current = currentScope;
            setHydrated(true);
        })();

        return () => {
            cancelled = true;
        };
    }, [address]);

    // ── Persist ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!hydrated || loadedScopeRef.current !== scope(address)) return;
        // Never persist a mid-stream node - a reload would resurrect a
        // half-typed reply.
        const settled = sessions.map((s) => ({ ...s, tree: settleTree(s.tree) }));
        AsyncStorage.multiSet([
            [SESSIONS_KEY(address), JSON.stringify(settled)],
            [PROJECTS_KEY(address), JSON.stringify(projects)],
            [ACTIVE_KEY(address), activeSessionId],
            [ORGANIZATION_KEY(address), organizationMode],
        ]).catch(() => {
            /* a failed cache write must never break the chat */
        });
    }, [hydrated, address, sessions, projects, activeSessionId, organizationMode]);

    const activeSession = useMemo(
        () => sessions.find((s) => s.id === activeSessionId) || null,
        [sessions, activeSessionId],
    );

    const tree = activeSession?.tree || emptyTree;

    const setTree = useCallback(
        (updater: MessageTree | ((prev: MessageTree) => MessageTree)) => {
            setSessions((prev) =>
                prev.map((session) => {
                    if (session.id !== activeSessionId) return session;
                    const nextTree =
                        typeof updater === 'function'
                            ? (updater as (p: MessageTree) => MessageTree)(session.tree)
                            : updater;
                    return {
                        ...session,
                        tree: nextTree,
                        title: getChatTitle(nextTree),
                        updatedAt: Date.now(),
                    };
                }),
            );
        },
        [activeSessionId],
    );

    const newChat = useCallback((projectId: string | null = null) => {
        const session = createChatSession(emptyTree, projectId);
        setSessions((prev) => [session, ...prev]);
        setActiveSessionId(session.id);
        return session.id;
    }, []);

    const selectSession = useCallback((sessionId: string) => {
        setActiveSessionId(sessionId);
    }, []);

    const renameSession = useCallback((sessionId: string, title: string) => {
        const next = title.trim() || 'Untitled chat';
        setSessions((prev) =>
            prev.map((s) => (s.id === sessionId ? { ...s, title: next, updatedAt: Date.now() } : s)),
        );
    }, []);

    const toggleSessionPin = useCallback((sessionId: string) => {
        setSessions((prev) =>
            prev.map((s) =>
                s.id === sessionId ? { ...s, pinned: !s.pinned, updatedAt: Date.now() } : s,
            ),
        );
    }, []);

    const deleteSession = useCallback((sessionId: string) => {
        setSessions((prev) => {
            const remaining = prev.filter((s) => s.id !== sessionId);
            // Always keep at least one session so the composer has a target.
            const next = remaining.length > 0 ? remaining : [createChatSession()];
            setActiveSessionId((current) => (current === sessionId ? next[0].id : current));
            return next;
        });
    }, []);

    const moveSessionToProject = useCallback((sessionId: string, projectId: string | null) => {
        setSessions((prev) =>
            prev.map((s) => (s.id === sessionId ? { ...s, projectId, updatedAt: Date.now() } : s)),
        );
    }, []);

    const clearActiveChat = useCallback(() => {
        setSessions((prev) =>
            prev.map((s) =>
                s.id === activeSessionId
                    ? { ...s, tree: emptyTree, title: 'New chat', updatedAt: Date.now() }
                    : s,
            ),
        );
    }, [activeSessionId]);

    const createProject = useCallback((title = 'New project') => {
        const project = createChatProject(title);
        setProjects((prev) => [project, ...prev]);
        return project.id;
    }, []);

    const renameProject = useCallback((projectId: string, title: string) => {
        const next = title.trim() || 'Untitled project';
        setProjects((prev) =>
            prev.map((p) => (p.id === projectId ? { ...p, title: next, updatedAt: Date.now() } : p)),
        );
    }, []);

    const toggleProjectPin = useCallback((projectId: string) => {
        setProjects((prev) =>
            prev.map((p) =>
                p.id === projectId ? { ...p, pinned: !p.pinned, updatedAt: Date.now() } : p,
            ),
        );
    }, []);

    /** Deleting a project keeps its chats - they fall back to unfiled. */
    const deleteProject = useCallback((projectId: string) => {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        setSessions((prev) =>
            prev.map((s) => (s.projectId === projectId ? { ...s, projectId: null } : s)),
        );
    }, []);

    const setOrganizationMode = useCallback((mode: OrganizationMode) => {
        setOrganizationModeState(mode);
    }, []);

    const sortedProjects = useMemo(
        () =>
            [...projects].sort((a, b) => {
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                return b.updatedAt - a.updatedAt;
            }),
        [projects],
    );

    const filteredSessions = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return sessions
            .filter((s) => !needle || s.title.toLowerCase().includes(needle))
            .sort((a, b) => {
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                return b.updatedAt - a.updatedAt;
            });
    }, [sessions, search]);

    const sessionsInProject = useCallback(
        (projectId: string) => filteredSessions.filter((s) => s.projectId === projectId),
        [filteredSessions],
    );

    return {
        hydrated,
        sessions,
        projects,
        activeSessionId,
        activeSession,
        tree,
        organizationMode,
        setOrganizationMode,
        search,
        setSearch,
        filteredSessions,
        sortedProjects,
        sessionsInProject,
        setTree,
        newChat,
        selectSession,
        renameSession,
        toggleSessionPin,
        deleteSession,
        moveSessionToProject,
        clearActiveChat,
        createProject,
        renameProject,
        toggleProjectPin,
        deleteProject,
    };
}
