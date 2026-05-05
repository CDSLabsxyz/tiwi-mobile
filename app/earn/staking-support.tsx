/**
 * Staking Support — mobile chat screen.
 *
 * Mirrors the super-app's <StakingSupportChat />:
 *   • One chat per wallet (get-or-created server side).
 *   • Polls for new messages while waiting for the AI agent / admin reply.
 *   • Renders an intro screen with suggested prompts on an empty chat.
 *
 * All endpoints live on the super-app backend (TIWI_API_BASE_URL); the dex
 * just talks to those routes.
 */

import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { SettingsHeader } from '@/components/ui/settings-header';
import { colors } from '@/constants/colors';
import { TIWI_API_BASE_URL } from '@/lib/mobile/api-client';
import { useWalletStore } from '@/store/walletStore';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Types ───────────────────────────────────────────────────────────────────

type Sender = 'user' | 'admin';

interface SupportMessage {
  id: string;
  chatId: string;
  sender: Sender;
  body: string;
  txHash?: string | null;
  poolName?: string | null;
  adminId?: string | null;
  isAuto?: boolean;
  createdAt: string;
}

interface SupportChat {
  id: string;
  userWallet: string;
  status: 'open' | 'closed';
  agentEnabled: boolean;
  escalatedAt?: string | null;
}

const SUGGESTED_PROMPTS = [
  "My stake isn't showing up in Active Positions",
  "I sent a stake but it's still pending",
  'How do I claim my staking rewards?',
  'I want to unstake — when can I withdraw?',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const truncateMid = (s: string, head = 6, tail = 4) =>
  s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${TIWI_API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StakingSupportScreen() {
  const router = useRouter();
  const activeAddress = useWalletStore((s) => s.activeAddress);

  const [chat, setChat] = useState<SupportChat | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [body, setBody] = useState('');
  const [txHash, setTxHash] = useState('');
  const [poolName, setPoolName] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // ── bootstrap chat ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeAddress) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const d = await api(
          `/api/v1/staking-support/chats?userWallet=${encodeURIComponent(activeAddress)}`,
        );
        if (cancelled) return;
        setChat(d.chat);
        const md = await api(`/api/v1/staking-support/chats/${d.chat.id}/messages`);
        if (cancelled) return;
        setMessages(md.messages || []);
        // mark-read fire-and-forget
        api('/api/v1/staking-support/chats', {
          method: 'PATCH',
          body: JSON.stringify({ id: d.chat.id, markReadFor: 'user' }),
        }).catch(() => {});
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load chat');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAddress]);

  // ── poll for new messages ─────────────────────────────────────────────────
  useEffect(() => {
    if (!chat?.id) return;
    const last = messages[messages.length - 1];
    const lastAge = last
      ? Date.now() - new Date(last.createdAt).getTime()
      : Infinity;
    const isAwaitingAgent =
      !!last &&
      lastAge < 60_000 &&
      (last.sender === 'user' || (last.sender === 'admin' && last.isAuto));
    const intervalMs = isAwaitingAgent ? 1500 : 10_000;

    const id = setInterval(async () => {
      try {
        const lastTs = messages[messages.length - 1]?.createdAt;
        const url = lastTs
          ? `/api/v1/staking-support/chats/${chat.id}/messages?after=${encodeURIComponent(lastTs)}`
          : `/api/v1/staking-support/chats/${chat.id}/messages`;
        const d = await api(url);
        if (d.messages?.length) {
          setMessages((prev) => [...prev, ...d.messages]);
        }
      } catch {
        /* non-fatal */
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [chat?.id, messages]);

  // ── auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  // ── send ──────────────────────────────────────────────────────────────────
  const sendBody = async (text: string) => {
    if (!chat?.id || !text.trim() || isSending) return;
    setIsSending(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const d = await api(`/api/v1/staking-support/chats/${chat.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          sender: 'user',
          body: text.trim(),
          txHash: txHash.trim() || null,
          poolName: poolName.trim() || null,
        }),
      });
      setMessages((prev) => [...prev, d.message]);
      setBody('');
      setTxHash('');
      setPoolName('');
      setShowAttach(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to send');
    } finally {
      setIsSending(false);
    }
  };

  const showIntro = !isLoading && messages.length === 0;

  // ── render ────────────────────────────────────────────────────────────────
  if (!activeAddress) {
    return (
      <View style={styles.root}>
        <CustomStatusBar />
        <SettingsHeader title="Staking Support" onBack={() => router.back()} />
        <View style={styles.centerEmpty}>
          <Text style={styles.dimText}>
            Connect your wallet to chat with staking support.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CustomStatusBar />
      <SettingsHeader title="Staking Support" onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading ? (
            <View style={styles.centerEmpty}>
              <ActivityIndicator color="#b1f128" />
            </View>
          ) : showIntro ? (
            <IntroScreen onPromptPress={(p) => sendBody(p)} />
          ) : (
            <>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              <TypingIndicator messages={messages} chat={chat} />
            </>
          )}
        </ScrollView>

        {showAttach && (
          <View style={styles.attachBlock}>
            <TextInput
              value={txHash}
              onChangeText={setTxHash}
              placeholder="Transaction hash (optional)"
              placeholderTextColor="#5a5f58"
              style={styles.attachInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              value={poolName}
              onChangeText={setPoolName}
              placeholder="Pool name (optional)"
              placeholderTextColor="#5a5f58"
              style={styles.attachInput}
            />
          </View>
        )}

        <View style={styles.composer}>
          {error && (
            <View style={styles.errorRow}>
              <Ionicons name="close-circle" color="#f87171" size={14} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <View style={styles.composerRow}>
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={() => setShowAttach((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.attachBtnText}>
                {showAttach ? 'Hide' : 'Attach'} tx
              </Text>
            </TouchableOpacity>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Type your message…"
              placeholderTextColor="#5a5f58"
              style={styles.input}
              multiline
              returnKeyType="send"
              onSubmitEditing={() => sendBody(body)}
              blurOnSubmit
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!body.trim() || isSending) && { opacity: 0.4 }]}
              onPress={() => sendBody(body)}
              disabled={!body.trim() || isSending}
              activeOpacity={0.7}
            >
              <Ionicons name="send" color="#0a0d08" size={18} />
            </TouchableOpacity>
          </View>
          <Text style={styles.walletText}>
            Wallet: {truncateMid(activeAddress)}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Intro screen ────────────────────────────────────────────────────────────

function IntroScreen({ onPromptPress }: { onPromptPress: (p: string) => void }) {
  return (
    <View style={styles.intro}>
      <View style={styles.introBadge}>
        <Ionicons name="chatbubble-ellipses" size={36} color="#b1f128" />
      </View>
      <Text style={styles.introTitle}>Hi, I&apos;m Tiwi Assistant</Text>
      <Text style={styles.introSub}>
        I can help with stakes that aren&apos;t showing, missing rewards, or
        stuck transactions. Ask me anything about staking.
      </Text>
      <View style={{ width: '100%', gap: 8, marginTop: 8 }}>
        {SUGGESTED_PROMPTS.map((p) => (
          <TouchableOpacity
            key={p}
            style={styles.promptCard}
            onPress={() => onPromptPress(p)}
            activeOpacity={0.7}
          >
            <Text style={styles.promptText}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Bubble + typing ─────────────────────────────────────────────────────────

function MessageBubble({ message: m }: { message: SupportMessage }) {
  const isUser = m.sender === 'user';
  const isAssistant = !isUser && (m.isAuto || m.adminId === 'agent');
  const isSystem = !isUser && m.adminId === 'system';
  return (
    <View
      style={[
        styles.bubbleRow,
        { justifyContent: isUser ? 'flex-end' : 'flex-start' },
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser
            ? styles.bubbleUser
            : isAssistant || isSystem
              ? styles.bubbleAgent
              : styles.bubbleAdmin,
        ]}
      >
        {!isUser && (
          <View style={styles.bubbleHeader}>
            <Text style={styles.bubbleHeaderText}>
              {isAssistant ? 'TIWI ASSISTANT' : isSystem ? 'AUTO-REPLY' : 'SUPPORT'}
            </Text>
            {isAssistant && (
              <View style={styles.aiPill}>
                <Text style={styles.aiPillText}>AI</Text>
              </View>
            )}
            {isSystem && (
              <View style={[styles.aiPill, { backgroundColor: 'rgba(251,146,60,0.2)' }]}>
                <Text style={[styles.aiPillText, { color: '#fb923c' }]}>offline</Text>
              </View>
            )}
          </View>
        )}
        <Text style={[styles.bubbleBody, { color: isUser ? '#0a0d08' : '#fff' }]}>
          {m.body}
        </Text>
        {(m.txHash || m.poolName) && (
          <View style={styles.bubbleMeta}>
            {!!m.poolName && (
              <Text style={[styles.bubbleMetaText, { color: isUser ? 'rgba(0,0,0,0.6)' : '#b5b5b5' }]}>
                Pool: {m.poolName}
              </Text>
            )}
            {!!m.txHash && (
              <Text
                style={[styles.bubbleMetaText, { color: isUser ? 'rgba(0,0,0,0.6)' : '#b5b5b5' }]}
                numberOfLines={1}
              >
                Tx: {m.txHash}
              </Text>
            )}
          </View>
        )}
        <Text
          style={[
            styles.bubbleTime,
            { color: isUser ? 'rgba(0,0,0,0.5)' : '#7a7f78' },
          ]}
        >
          {formatTime(m.createdAt)}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator({
  messages,
  chat,
}: {
  messages: SupportMessage[];
  chat: SupportChat | null;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const dots = useRef([new Animated.Value(0.4), new Animated.Value(0.4), new Animated.Value(0.4)]).current;
  useEffect(() => {
    const animate = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration: 400, delay, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.4, duration: 400, easing: Easing.linear, useNativeDriver: true }),
        ]),
      ).start();
    animate(dots[0], 0);
    animate(dots[1], 150);
    animate(dots[2], 300);
  }, [dots]);

  if (chat?.escalatedAt) return null;
  if (chat && !chat.agentEnabled) return null;

  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx === -1) return null;
  const after = messages.slice(lastUserIdx + 1);
  const hasFinalReply = after.some((m) => m.sender === 'admin' && !m.isAuto);
  if (hasFinalReply) return null;
  const ageMs = Date.now() - new Date(messages[lastUserIdx].createdAt).getTime();
  if (ageMs > 90_000) return null;
  const hasAck = after.some((m) => m.sender === 'admin' && m.isAuto);

  return (
    <View style={[styles.bubbleRow, { justifyContent: 'flex-start' }]}>
      <View style={[styles.bubble, styles.bubbleAgent, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
        <View style={styles.bubbleHeader}>
          <Text style={styles.bubbleHeaderText}>TIWI ASSISTANT</Text>
          <View style={styles.aiPill}>
            <Text style={styles.aiPillText}>AI</Text>
          </View>
        </View>
        <View style={styles.dotsRow}>
          {dots.map((d, i) => (
            <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
          ))}
        </View>
        {hasAck && <Text style={styles.dotsHint}>still digging…</Text>}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0d08' },
  scroll: { padding: 16, gap: 12 },
  centerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dimText: { color: '#b5b5b5', textAlign: 'center' },

  // intro
  intro: { alignItems: 'center', gap: 12, paddingTop: 24 },
  introBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(177,241,40,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  introSub: { color: '#b5b5b5', fontSize: 13, textAlign: 'center', paddingHorizontal: 16 },
  promptCard: {
    backgroundColor: '#13180f',
    borderColor: '#1f261e',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  promptText: { color: '#e5e5e5', fontSize: 13 },

  // bubbles
  bubbleRow: { flexDirection: 'row', marginBottom: 4 },
  bubble: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: '#b1f128', borderBottomRightRadius: 4 },
  bubbleAgent: {
    backgroundColor: '#1a1f17',
    borderBottomLeftRadius: 4,
    borderColor: 'rgba(177,241,40,0.25)',
    borderWidth: 1,
  },
  bubbleAdmin: { backgroundColor: '#1a1f17', borderBottomLeftRadius: 4 },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  bubbleHeaderText: {
    color: '#b1f128',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  bubbleBody: { fontSize: 14, lineHeight: 20 },
  bubbleMeta: {
    marginTop: 6,
    paddingTop: 6,
    borderTopColor: 'rgba(0,0,0,0.1)',
    borderTopWidth: 1,
    gap: 2,
  },
  bubbleMetaText: { fontSize: 11 },
  bubbleTime: { fontSize: 10, marginTop: 4 },
  aiPill: {
    backgroundColor: 'rgba(177,241,40,0.2)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  aiPillText: { color: '#b1f128', fontSize: 9, fontWeight: '600' },

  // typing
  dotsRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#b1f128' },
  dotsHint: { color: '#7a7f78', fontStyle: 'italic', fontSize: 11 },

  // attach
  attachBlock: {
    borderTopColor: '#1f261e',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#0f130d',
  },
  attachInput: {
    backgroundColor: '#0a0d08',
    borderColor: '#1f261e',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 12,
  },

  // composer
  composer: {
    borderTopColor: '#1f261e',
    borderTopWidth: 1,
    backgroundColor: '#0f130d',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 18 : 12,
    gap: 6,
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  attachBtn: {
    borderColor: '#1f261e',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  attachBtnText: { color: '#b5b5b5', fontSize: 11 },
  input: {
    flex: 1,
    backgroundColor: '#0a0d08',
    borderColor: '#1f261e',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: '#b1f128',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  walletText: { color: '#5a5f58', fontSize: 11 },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { color: '#f87171', fontSize: 12 },
});
