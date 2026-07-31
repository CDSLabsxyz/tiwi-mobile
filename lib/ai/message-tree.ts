/**
 * Message tree for the TIWI AI chat.
 *
 * Each message is a node in a tree. Editing a user message creates a NEW
 * SIBLING under the same parent rather than overwriting the original — so the
 * previous prompt + AI reply stay reachable. The visible conversation is just
 * the active path from root to leaf, picking each parent's activeChild at every
 * step. Switching versions is a one-line state update on activeChildByParent.
 *
 * (The web app edits messages in place and marks them "(edited)". Mobile keeps
 * the branching model, which is a superset: every prior version is still
 * reachable via the version pager.)
 */

import type { AiValidationResult } from '@/lib/mobile/api-client';

export const ROOT_KEY = '__root__';

export interface ChatMessage {
    id: string;
    type: 'ai' | 'user';
    text: string;
    /** Local image URIs shown with a user message. */
    imageUris?: string[];
    /** Mime types parallel to `imageUris`, so Retry can re-upload them. */
    imageMimeTypes?: string[];
    isStreaming?: boolean;
    /** Security-validation verdict returned by the backend for an AI reply. */
    validation?: AiValidationResult;
    /** Whether the backend charged a credit for this reply. */
    creditCharged?: boolean;
    /** Thumbs up/down the user left on an AI reply. */
    feedback?: 'up' | 'down';
}

export interface MessageNode extends ChatMessage {
    parentId: string | null;
}

export interface MessageTree {
    nodes: Record<string, MessageNode>;
    childrenByParent: Record<string, string[]>;
    activeChildByParent: Record<string, number>;
}

export const emptyTree: MessageTree = {
    nodes: {},
    childrenByParent: {},
    activeChildByParent: {},
};

export function getActivePath(tree: MessageTree): MessageNode[] {
    const path: MessageNode[] = [];
    let parentKey: string = ROOT_KEY;
    // Hard cap to avoid pathological loops; real conversations stay well below.
    for (let i = 0; i < 1000; i++) {
        const kids = tree.childrenByParent[parentKey];
        if (!kids?.length) break;
        let idx = tree.activeChildByParent[parentKey];
        if (idx === undefined || idx < 0 || idx >= kids.length) idx = kids.length - 1;
        const childId = kids[idx];
        const node = tree.nodes[childId];
        if (!node) break;
        path.push(node);
        parentKey = childId;
    }
    return path;
}

/**
 * Root → `id` (inclusive) by walking parent links. Used to build the history
 * window for a request without depending on which branch is currently active.
 */
export function getPathTo(tree: MessageTree, id: string): MessageNode[] {
    const path: MessageNode[] = [];
    let cursor: MessageNode | undefined = tree.nodes[id];
    while (cursor) {
        path.unshift(cursor);
        cursor = cursor.parentId ? tree.nodes[cursor.parentId] : undefined;
    }
    return path;
}

export function appendChild(
    tree: MessageTree,
    parentId: string | null,
    node: MessageNode,
): MessageTree {
    const parentKey = parentId ?? ROOT_KEY;
    const kids = tree.childrenByParent[parentKey] || [];
    const next = [...kids, node.id];
    return {
        nodes: { ...tree.nodes, [node.id]: node },
        childrenByParent: { ...tree.childrenByParent, [parentKey]: next },
        activeChildByParent: { ...tree.activeChildByParent, [parentKey]: next.length - 1 },
    };
}

export function patchNode(
    tree: MessageTree,
    id: string,
    patch: Partial<MessageNode>,
): MessageTree {
    const existing = tree.nodes[id];
    if (!existing) return tree;
    return { ...tree, nodes: { ...tree.nodes, [id]: { ...existing, ...patch } } };
}

export function setActiveChild(tree: MessageTree, parentKey: string, idx: number): MessageTree {
    return { ...tree, activeChildByParent: { ...tree.activeChildByParent, [parentKey]: idx } };
}

/**
 * Drop a node and everything under it. Used by Retry: the stale answer (and
 * any continuation after it) is removed before the new one streams in.
 */
export function removeSubtree(tree: MessageTree, id: string): MessageTree {
    const node = tree.nodes[id];
    if (!node) return tree;

    const doomed: string[] = [];
    const walk = (nodeId: string) => {
        doomed.push(nodeId);
        for (const child of tree.childrenByParent[nodeId] || []) walk(child);
    };
    walk(id);

    const nodes = { ...tree.nodes };
    const childrenByParent = { ...tree.childrenByParent };
    const activeChildByParent = { ...tree.activeChildByParent };

    for (const doomedId of doomed) {
        delete nodes[doomedId];
        delete childrenByParent[doomedId];
        delete activeChildByParent[doomedId];
    }

    const parentKey = node.parentId ?? ROOT_KEY;
    const siblings = (childrenByParent[parentKey] || []).filter((sid) => sid !== id);
    childrenByParent[parentKey] = siblings;
    if (siblings.length === 0) {
        delete activeChildByParent[parentKey];
    } else {
        const current = activeChildByParent[parentKey];
        activeChildByParent[parentKey] = Math.min(
            current === undefined ? siblings.length - 1 : current,
            siblings.length - 1,
        );
    }

    return { nodes, childrenByParent, activeChildByParent };
}

/** Migrate legacy flat-array storage into a single linear branch. */
export function buildTreeFromArray(messages: ChatMessage[]): MessageTree {
    let tree = emptyTree;
    let parentId: string | null = null;
    for (const m of messages) {
        const node: MessageNode = { ...m, isStreaming: false, parentId };
        tree = appendChild(tree, parentId, node);
        parentId = m.id;
    }
    return tree;
}

export function isMessageTree(value: unknown): value is MessageTree {
    return !!value && typeof value === 'object' && !!(value as MessageTree).nodes;
}

/** Clear any half-streamed flag so a reload never resurrects a partial reply. */
export function settleTree(tree: MessageTree): MessageTree {
    const nodes: Record<string, MessageNode> = {};
    for (const [id, node] of Object.entries(tree.nodes)) {
        nodes[id] = node.isStreaming ? { ...node, isStreaming: false } : node;
    }
    return { ...tree, nodes };
}

// ─── Sessions & projects ─────────────────────────────────────────────────────

export interface ChatSession {
    id: string;
    title: string;
    tree: MessageTree;
    updatedAt: number;
    projectId: string | null;
    pinned: boolean;
}

export interface ChatProject {
    id: string;
    title: string;
    pinned: boolean;
    createdAt: number;
    updatedAt: number;
}

export type OrganizationMode = 'list' | 'project';

export const createSessionId = () =>
    `tiwi-ai-${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const createProjectId = () =>
    `tiwi-project-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** Title a chat from its first user prompt, same rule as the web app. */
export function getChatTitle(tree: MessageTree): string {
    const firstPrompt = getActivePath(tree).find(
        (m) => m.type === 'user' && m.text.trim().length > 0,
    )?.text.trim();
    if (!firstPrompt) return 'New chat';
    return firstPrompt.length > 36 ? `${firstPrompt.slice(0, 36)}...` : firstPrompt;
}

export function createChatSession(
    tree: MessageTree = emptyTree,
    projectId: string | null = null,
): ChatSession {
    return {
        id: createSessionId(),
        title: getChatTitle(tree),
        tree,
        updatedAt: Date.now(),
        projectId,
        pinned: false,
    };
}

export function createChatProject(title = 'New project'): ChatProject {
    const now = Date.now();
    return { id: createProjectId(), title, pinned: false, createdAt: now, updatedAt: now };
}

/** Seed projects, matching the web app's starter set. */
export const createDefaultProjects = (): ChatProject[] => [
    createChatProject('Market Insights'),
    createChatProject('Liquidity Hub'),
    createChatProject('Security Review'),
];

export function normalizeSessions(value: unknown): ChatSession[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((raw): ChatSession | null => {
            if (!raw || typeof raw !== 'object') return null;
            const s = raw as Partial<ChatSession> & { messages?: ChatMessage[] };
            // Accept either the tree shape or a legacy flat message array.
            const tree = isMessageTree(s.tree)
                ? settleTree(s.tree)
                : Array.isArray(s.messages)
                    ? buildTreeFromArray(s.messages)
                    : emptyTree;
            return {
                id: typeof s.id === 'string' ? s.id : createSessionId(),
                title: typeof s.title === 'string' && s.title.trim() ? s.title : getChatTitle(tree),
                tree,
                updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : Date.now(),
                projectId: typeof s.projectId === 'string' ? s.projectId : null,
                pinned: Boolean(s.pinned),
            };
        })
        .filter((s): s is ChatSession => Boolean(s));
}

export function normalizeProjects(value: unknown): ChatProject[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((raw): ChatProject | null => {
            if (!raw || typeof raw !== 'object') return null;
            const p = raw as Partial<ChatProject>;
            const now = Date.now();
            return {
                id: typeof p.id === 'string' ? p.id : createProjectId(),
                title: typeof p.title === 'string' && p.title.trim() ? p.title.trim() : 'Untitled project',
                pinned: Boolean(p.pinned),
                createdAt: typeof p.createdAt === 'number' ? p.createdAt : now,
                updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : now,
            };
        })
        .filter((p): p is ChatProject => Boolean(p));
}
