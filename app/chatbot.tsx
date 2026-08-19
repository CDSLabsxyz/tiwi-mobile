/**
 * TIWI AI chat screen.
 *
 * Feature parity with the web super-app's AI panel (`components/ai/ai-chat-modal.tsx`):
 *   • the same backend pipeline (knowledge base + live market lookups + site
 *     grounding + security validation + brand scrubbing) via /api/v1/ai/chat
 *   • security-validation chips, "1 credit used" chips, Share insight, Copy,
 *     Retry, and thumbs up/down on every reply
 *   • an AI credit balance: a free monthly allowance plus paid credits bought
 *     with TWC, with an on-chain payment and a shareable receipt
 *   • many chats organised into projects, renameable / pinnable / searchable
 *   • image attachments (up to 4), voice input, and full markdown rendering
 *
 * Mobile-only extras kept from the previous screen: pinch-to-zoom image viewer,
 * the full-screen composer, and the edit-as-branch message tree (a superset of
 * the web app's in-place edit - every earlier version stays reachable).
 */

import { AiCreditsSheet } from '@/components/ai/AiCreditsSheet';
import { AI_CREDIT_PACKS_ENABLED } from '@/services/aiCreditsService';
import { AiMessageFooter } from '@/components/ai/AiMessageFooter';
import { AiReceiptModal } from '@/components/ai/AiReceiptModal';
import { ChatHistoryDrawer } from '@/components/ai/ChatHistoryDrawer';
import { MarkdownMessage } from '@/components/ai/MarkdownMessage';
import { ProjectHomeView } from '@/components/ai/ProjectHomeView';
import { ProjectSettingsModal } from '@/components/ai/ProjectSettingsModal';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { TypingIndicator } from '@/components/ui/TypingIndicator';
import { colors } from '@/constants/colors';
import { useAiChatSessions } from '@/hooks/useAiChatSessions';
import { useAiCredits } from '@/hooks/useAiCredits';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import {
  appendChild,
  getActivePath,
  getPathTo,
  patchNode,
  removeSubtree,
  ROOT_KEY,
  setActiveChild,
  type MessageNode,
} from '@/lib/ai/message-tree';
import { isEvmAddress, type Receipt } from '@/services/aiCreditsService';
import {
  OutOfCreditsError,
  streamAIResponse,
  type AIAttachment,
  type AIChatContext,
  type AIChatMeta,
} from '@/services/aiService';
import { transcribeAudio } from '@/services/speechService';
import { useWalletStore } from '@/store/walletStore';
import Feather from '@expo/vector-icons/Feather';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Image limits match the web panel: up to 4 attachments per message. The size
// cap stays at the mobile-friendly 10MB (photos off a phone camera are big);
// the backend re-encodes them as data URLs regardless.
const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// Audio recording limit: 60 seconds (industry standard for voice input).
const MAX_AUDIO_DURATION = 60000;

/** The same four starters the web panel offers on an empty chat. */
const SUGGESTIONS = [
  'Interpret this chart setup',
  'Give me DeFi ideas for my holdings',
  'Check this token for risk signs',
  'Explain TIWI Protocol liquidity',
];

const SHARE_URL = 'https://app.tiwiprotocol.xyz';

// ─── Image zoom viewer ───────────────────────────────────────────────────────
//
// Full-screen modal that lets the user pinch to zoom and pan the image.
// Double-tap toggles between fit-to-screen and 2x. Closing resets state.

const AnimatedExpoImage = Animated.createAnimatedComponent(Image);

function ImageZoomViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const { top } = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const reset = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    savedTranslateX.value = 0;
    translateY.value = withSpring(0);
    savedTranslateY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.5, Math.min(savedScale.value * e.scale, 5));
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        savedTranslateX.value = 0;
        translateY.value = withSpring(0);
        savedTranslateY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        savedTranslateX.value = 0;
        translateY.value = withSpring(0);
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
    });

  const composed = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Reset transforms whenever a new image is opened.
  useEffect(() => {
    if (uri) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={zoomStyles.backdrop}>
        <TouchableOpacity
          onPress={onClose}
          style={[zoomStyles.closeButton, { top: (top || 16) + 8 }]}
          hitSlop={12}
        >
          <Image
            source={require('../assets/home/bot/cancel-01.svg')}
            style={zoomStyles.closeIcon}
            contentFit="contain"
          />
        </TouchableOpacity>
        {uri && (
          <GestureDetector gesture={composed}>
            <Animated.View style={zoomStyles.canvas}>
              <AnimatedExpoImage
                source={{ uri }}
                style={[zoomStyles.image, animatedStyle]}
                contentFit="contain"
              />
            </Animated.View>
          </GestureDetector>
        )}
        <Text style={zoomStyles.hint}>Pinch to zoom · double-tap to toggle</Text>
      </View>
    </Modal>
  );
}

const zoomStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.97)',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeIcon: {
    width: 24,
    height: 24,
  },
  canvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  hint: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#7C7C7C',
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
  },
});

export default function ChatbotScreen() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const activeAddress = useWalletStore((state) => state.activeAddress);
  const activeGroupId = useWalletStore((state) => state.activeGroupId);
  const walletGroups = useWalletStore((state) => state.walletGroups);
  const { data: balancesData } = useWalletBalances();
  const creditWalletAddress = useMemo(() => {
    if (isEvmAddress(activeAddress)) return activeAddress;
    const activeGroup =
      walletGroups.find((group) => group.id === activeGroupId) ||
      walletGroups.find((group) =>
        Object.values(group.addresses).some(
          (address) => address?.toLowerCase() === (activeAddress || '').toLowerCase(),
        ),
      );
    const evm = activeGroup?.addresses?.EVM;
    return isEvmAddress(evm) ? evm : activeAddress;
  }, [activeAddress, activeGroupId, walletGroups]);

  const sessionsApi = useAiChatSessions(activeAddress);
  // The balance list doubles as a second opinion on the TWC balance shown in
  // the billing sheet, so a flaky RPC read can't report "No TWC detected".
  const creditsApi = useAiCredits(creditWalletAddress, balancesData?.tokens);
  const { tree, setTree } = sessionsApi;
  const messages = useMemo(() => getActivePath(tree), [tree]);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [viewerImageUri, setViewerImageUri] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inputText, setInputText] = useState('');
  const [selectedImages, setSelectedImages] = useState<AIAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [isFullScreenInput, setIsFullScreenInput] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Panels
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptToShow, setReceiptToShow] = useState<Receipt | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [projectHomeId, setProjectHomeId] = useState<string | null>(null);
  const [projectPrompt, setProjectPrompt] = useState('');
  const [projectSettingsId, setProjectSettingsId] = useState<string | null>(null);
  const [listeningField, setListeningField] = useState<'main' | 'project' | null>(null);

  // IME inset sourced from native WindowInsetsCompat (Android) / keyboard frame
  // (iOS) - works in release APKs with edge-to-edge + new arch where the older
  // Keyboard.addListener height workaround was unreliable.
  const keyboard = useAnimatedKeyboard();
  const keyboardPaddingStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.value,
  }));

  const [inputHeight, setInputHeight] = useState(20);
  const inputContentHeightRef = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingStartTimeRef = useRef<number>(0);
  const fullScreenInputRef = useRef<TextInput>(null);
  const inputTextRef = useRef<TextInput>(null);
  const MAX_INPUT_HEIGHT = 200;
  const MAX_CHARACTERS = 10000;

  const activeProject = projectHomeId
    ? sessionsApi.projects.find((p) => p.id === projectHomeId) || null
    : null;
  const settingsProject = projectSettingsId
    ? sessionsApi.projects.find((p) => p.id === projectSettingsId) || null
    : null;

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  // Handle phone back button: close whatever is on top, else leave the screen.
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (receiptOpen) { setReceiptOpen(false); return true; }
      if (projectSettingsId) { setProjectSettingsId(null); return true; }
      if (creditsOpen) { setCreditsOpen(false); return true; }
      if (drawerOpen) { setDrawerOpen(false); return true; }
      if (projectHomeId) { setProjectHomeId(null); return true; }
      handleClose();
      return true;
    });
    return () => backHandler.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptOpen, projectSettingsId, creditsOpen, drawerOpen, projectHomeId, isStreaming, abortController]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Stagger scrollToEnd across the keyboard animation window so we land at
  // the true bottom even after the layout resizes. A single scroll fires too
  // early and misses the post-resize layout.
  const scrollToBottomNow = useCallback(() => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    });
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 180);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 380);
  }, []);

  // Track keyboard visibility so the input bar can sit flush against it. The
  // upward shift itself comes from `useAnimatedKeyboard` above.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
      scrollToBottomNow();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToBottomNow]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isNearBottom) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isNearBottom]);

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 100;
    const isAtBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    setIsNearBottom(isAtBottom);
    setShowScrollToBottom(!isAtBottom && messages.length > 0);
  };

  const handleScrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
    setIsNearBottom(true);
    setShowScrollToBottom(false);
  };

  const abortStream = () => {
    if (isStreaming && abortController) abortController.abort();
  };

  function handleClose() {
    abortStream();
    router.back();
  }

  // ─── Clipboard / share ──────────────────────────────────────────────────

  const flashCopied = (messageId: string) => {
    setCopiedMessageId(messageId);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedMessageId(null), 1500);
  };

  const handleCopyMessage = async (messageId: string, text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      flashCopied(messageId);
    } catch (e) {
      console.warn('[Chatbot] Copy failed:', e);
    }
  };

  const copyText = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
    } catch {
      /* ignore */
    }
  };

  /**
   * Share insight - copy first (so the full text is always on the clipboard
   * regardless of which share target the OS picks), then open the share sheet.
   * Same two-step behaviour as the web panel.
   */
  const handleShareInsight = async (messageId: string, content: string) => {
    await copyText(content);
    flashCopied(messageId);
    try {
      await Share.share({
        message: `${content}\n\nvia TIWI AI\n${SHARE_URL}`,
        title: 'TIWI AI Insight',
      });
    } catch {
      /* user cancelled - the clipboard copy is the fallback */
    }
  };

  // ─── Editing / branching ────────────────────────────────────────────────

  // Begin editing a previously-sent user message. We DON'T mutate the tree
  // here - the original branch stays intact. On the next send we add a new
  // sibling under the same parent, so the user can flip between versions.
  const handleEditMessage = (messageId: string) => {
    const target = tree.nodes[messageId];
    if (!target || target.type !== 'user') return;
    setInputText(target.text);
    setEditingMessageId(messageId);
    setTimeout(() => inputTextRef.current?.focus(), 50);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setInputText('');
  };

  const handleSwitchSibling = (parentKey: string, idx: number) => {
    abortStream();
    setTree((prev) => {
      const kids = prev.childrenByParent[parentKey] || [];
      if (idx < 0 || idx >= kids.length) return prev;
      return setActiveChild(prev, parentKey, idx);
    });
  };

  const handleFeedback = (messageId: string, value: 'up' | 'down') => {
    setTree((prev) => {
      const node = prev.nodes[messageId];
      if (!node) return prev;
      return patchNode(prev, messageId, {
        feedback: node.feedback === value ? undefined : value,
      });
    });
  };

  // ─── Attachments ────────────────────────────────────────────────────────

  const handleImageUpload = async () => {
    try {
      if (selectedImages.length >= MAX_IMAGES) {
        setAttachError(`Max ${MAX_IMAGES} images per message`);
        return;
      }

      // Android goes straight to the system photo picker. It hands back only
      // the items the user picks and needs no READ_MEDIA_IMAGES, which Play
      // rejects as a broad storage permission when a picker would do. Asking
      // here would fail, because that permission is blocked in app.json.
      if (Platform.OS !== 'android') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please grant access to your photos to upload images.');
          return;
        }
      }

      const remainingSlots = MAX_IMAGES - selectedImages.length;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
      });

      if (!result.canceled && result.assets.length > 0) {
        setAttachError(null);
        const validAssets = result.assets
          .filter((asset) => {
            if (asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE) {
              setAttachError(
                `One or more images exceed the ${MAX_IMAGE_SIZE / (1024 * 1024)}MB limit`,
              );
              return false;
            }
            return true;
          })
          .slice(0, remainingSlots)
          .map((asset) => ({ uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg' }));

        setSelectedImages((prev) => [...prev, ...validAssets]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Voice input ────────────────────────────────────────────────────────

  const startRecording = async (field: 'main' | 'project') => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Please grant microphone access for voice input.');
        return;
      }
      await recorder.record();
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
      setListeningField(field);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
      setIsRecording(false);
      setListeningField(null);
    }
  };

  const stopRecording = async () => {
    const field = listeningField;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      setIsRecording(false);
      setListeningField(null);

      if (uri) {
        const duration = Date.now() - recordingStartTimeRef.current;
        if (duration > MAX_AUDIO_DURATION) {
          Alert.alert('Recording Too Long', `Please keep recordings under ${MAX_AUDIO_DURATION / 1000} seconds`);
          return;
        }
        try {
          const transcribedText = await transcribeAudio(uri);
          if (transcribedText) {
            if (field === 'project') {
              setProjectPrompt((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText));
            } else {
              setInputText((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText));
            }
          } else if (duration > 500) {
            Alert.alert('No Speech Detected', 'Could not detect any speech in the recording.');
          }
        } catch (error) {
          console.error('Error transcribing audio:', error);
          Alert.alert('Error', 'Failed to transcribe audio. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
      setListeningField(null);
    }
  };

  const handleMicPress = (field: 'main' | 'project') => {
    if (isRecording) stopRecording();
    else startRecording(field);
  };

  // ─── Composer sizing ────────────────────────────────────────────────────

  const handleOpenFullScreen = () => {
    setIsFullScreenInput(true);
    setTimeout(() => fullScreenInputRef.current?.focus(), 100);
  };

  const handleContentSizeChange = (event: any) => {
    if (!inputText.trim()) {
      if (inputHeight !== 20) setInputHeight(20);
      return;
    }
    const { height } = event.nativeEvent.contentSize;
    if (height && height > 0) {
      inputContentHeightRef.current = height;
      const lineHeight = 14 * 1.4;
      const lines = inputText.split('\n').length;
      const expectedHeight = Math.max(
        20,
        Math.min(lines * lineHeight + 10 + 2, MAX_INPUT_HEIGHT),
      );
      if (Math.abs(expectedHeight - inputHeight) >= 2) setInputHeight(expectedHeight);
    }
  };

  // Recalculate height when text changes so growth is immediate.
  useEffect(() => {
    if (inputText.trim() === '') {
      setInputHeight(20);
      return;
    }
    const timeoutId = setTimeout(() => {
      const lines = inputText.split('\n').length;
      const charsPerLine = 40;
      const wrappedLines = Math.ceil(inputText.length / charsPerLine);
      const totalLines = Math.max(lines, wrappedLines);
      const newHeight = Math.min(Math.max(20, totalLines * 20 + 10), MAX_INPUT_HEIGHT);
      if (Math.abs(newHeight - inputHeight) >= 2) setInputHeight(newHeight);
    }, 100);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText]);

  // ─── AI request ─────────────────────────────────────────────────────────

  /** Portfolio snapshot + recent history, the same context the web panel sends. */
  const buildContext = useCallback(
    (historyNodes: MessageNode[]): AIChatContext => {
      const context: AIChatContext = {};
      if (creditWalletAddress) context.walletAddress = creditWalletAddress;

      if (balancesData?.tokens?.length) {
        const tokens = balancesData.tokens
          .filter(
            (t: any) =>
              parseFloat(t.usdValue || '0') > 0 || parseFloat(t.balanceFormatted || '0') > 0,
          )
          .slice(0, 30)
          .map((t: any) => ({
            symbol: String(t.symbol || ''),
            balance: String(t.balanceFormatted || t.balance || '0'),
            usdValue: String(t.usdValue || '0'),
          }));
        if (tokens.length) {
          context.portfolio = {
            totalUsd: String(balancesData.totalNetWorthUsd || '0'),
            tokens,
          };
        }
      }

      const history = historyNodes
        .filter((m) => m.text && !m.isStreaming)
        .slice(-8)
        .map((m) => ({
          role: m.type === 'ai' ? ('assistant' as const) : ('user' as const),
          content: m.text,
        }));
      if (history.length) context.history = history;

      context.credits = {
        available: creditsApi.summary.totalLeft,
        monthlyLeft: creditsApi.summary.monthlyLeft,
        paidLeft: creditsApi.summary.paidLeft,
      };
      context.chargePaidCredit = creditsApi.summary.monthlyLeft <= 0 && creditsApi.summary.paidLeft > 0;

      return context;
    },
    [creditWalletAddress, balancesData, creditsApi.summary],
  );

  /**
   * Stream a reply into `aiMessageId`. Shared by send and Retry so both paths
   * charge credits and record the validation verdict identically.
   */
  const runAssistant = useCallback(
    async (
      aiMessageId: string,
      prompt: string,
      images: AIAttachment[],
      historyNodes: MessageNode[],
    ) => {
      setStreamingMessageId(aiMessageId);
      setIsStreaming(true);

      const controller = new AbortController();
      setAbortController(controller);

      const finish = () => {
        setIsStreaming(false);
        setStreamingMessageId(null);
        setAbortController(null);
      };

      let accumulatedText = '';
      const shouldUseLocalFreeCredit = creditsApi.summary.monthlyLeft > 0;

      await streamAIResponse({
        prompt: prompt || (images.length > 0 ? 'What is in this image?' : ''),
        images,
        context: buildContext(historyNodes),
        abortSignal: controller.signal,
        onChunk: (chunk) => {
          accumulatedText += chunk;
          setTree((prev) => patchNode(prev, aiMessageId, { text: accumulatedText, isStreaming: true }));
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
        },
        onComplete: (fullText: string, meta: AIChatMeta) => {
          const shouldSpendLocalFree =
            shouldUseLocalFreeCredit &&
            !meta.creditCharged &&
            meta.creditReason !== 'blocked_by_security_validation' &&
            meta.creditReason !== 'empty_model_response';
          if (shouldSpendLocalFree) void creditsApi.spendFreeCredit();
          setTree((prev) =>
            patchNode(prev, aiMessageId, {
              text: fullText,
              isStreaming: false,
              validation: meta.validation,
              creditCharged: meta.creditCharged || shouldSpendLocalFree,
            }),
          );
          // Paid credits are spent on the server; free credits are spent above
          // from this device's local allowance.
          creditsApi.applyServerBalance(meta.balance);
          finish();
        },
        onError: (error) => {
          // Out of credits isn't a failure to retry - drop the empty bubble and
          // send the user to the billing sheet.
          if (error instanceof OutOfCreditsError) {
            creditsApi.applyServerBalance(error.balance);
            setTree((prev) => removeSubtree(prev, aiMessageId));
            finish();
            setAttachError(error.message);
            setCreditsOpen(true);
            return;
          }
          console.error('AI Error:', error);
          setTree((prev) =>
            patchNode(prev, aiMessageId, {
              text: 'Sorry, I encountered an error. Please try again.',
              isStreaming: false,
            }),
          );
          finish();
          Alert.alert('Error', error.message || 'Failed to get AI response. Please try again.');
        },
      });
    },
    [buildContext, creditsApi, setTree],
  );

  /**
   * Local pre-check shared by send and Retry. Free credits are device-local;
   * paid credits are server-controlled once the local free bucket is empty.
   */
  const ensureCredits = () => {
    if (creditsApi.summary.totalLeft > 0) return true;
    setAttachError('You are out of AI credits. Buy more with TWC to continue.');
    setCreditsOpen(true);
    return false;
  };

  const handleSend = async (closeFullScreen = false) => {
    const text = inputText.trim();
    if (!text && selectedImages.length === 0) return;
    if (isStreaming) return;
    // Until the stored sessions have loaded there's no session to write into,
    // so a message sent now would be dropped on the floor.
    if (!sessionsApi.hydrated) return;
    if (closeFullScreen || isFullScreenInput) setIsFullScreenInput(false);
    if (!ensureCredits()) return;

    const imagesToSend = [...selectedImages];
    const userMessageId = Date.now().toString();
    const aiMessageId = (Date.now() + 1).toString();
    const userText = text || (imagesToSend.length > 0 ? '[Image]' : '');

    // Editing → the new user message is a SIBLING of the original under the
    // same parent. Otherwise it's a new leaf on the active path.
    const editingTarget = editingMessageId ? tree.nodes[editingMessageId] : null;
    const userParentId: string | null = editingTarget
      ? editingTarget.parentId
      : messages.length > 0
        ? messages[messages.length - 1].id
        : null;

    const userNode: MessageNode = {
      id: userMessageId,
      type: 'user',
      text: userText,
      imageUris: imagesToSend.map((img) => img.uri),
      imageMimeTypes: imagesToSend.map((img) => img.mimeType || 'image/jpeg'),
      parentId: userParentId,
    };
    const aiNode: MessageNode = {
      id: aiMessageId,
      type: 'ai',
      text: '',
      isStreaming: true,
      parentId: userMessageId,
    };

    // History = everything before the message being answered. Captured from
    // the pre-mutation tree so an edit branches from the right point.
    const historyNodes = userParentId ? getPathTo(tree, userParentId) : [];

    setTree((prev) => {
      let next = appendChild(prev, userParentId, userNode);
      next = appendChild(next, userMessageId, aiNode);
      return next;
    });
    setEditingMessageId(null);
    setInputText('');
    setSelectedImages([]);
    setAttachError(null);
    inputTextRef.current?.clear();
    fullScreenInputRef.current?.clear();

    await runAssistant(aiMessageId, text, imagesToSend, historyNodes);
  };

  /**
   * Retry - re-run the AI on the prompt that produced this reply, replacing the
   * stale answer (and anything after it) instead of appending a second reply.
   */
  const handleRetry = async (aiMessageId: string) => {
    if (isStreaming) return;
    const aiNode = tree.nodes[aiMessageId];
    const userNode = aiNode?.parentId ? tree.nodes[aiNode.parentId] : null;
    if (!userNode || userNode.type !== 'user') return;
    if (!ensureCredits()) return;

    const images: AIAttachment[] = (userNode.imageUris || []).map((uri, i) => ({
      uri,
      mimeType: userNode.imageMimeTypes?.[i] || 'image/jpeg',
    }));
    const historyNodes = userNode.parentId ? getPathTo(tree, userNode.parentId) : [];

    const newAiId = `${Date.now()}-retry`;
    setTree((prev) =>
      appendChild(removeSubtree(prev, aiMessageId), userNode.id, {
        id: newAiId,
        type: 'ai',
        text: '',
        isStreaming: true,
        parentId: userNode.id,
      }),
    );

    await runAssistant(newAiId, userNode.text, images, historyNodes);
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setIsStreaming(false);
      setAbortController(null);
      if (streamingMessageId) {
        setTree((prev) => patchNode(prev, streamingMessageId, { isStreaming: false }));
      }
      setStreamingMessageId(null);
    }
  };

  // ─── Sessions / projects ────────────────────────────────────────────────

  const resetComposer = () => {
    setEditingMessageId(null);
    setInputText('');
    setSelectedImages([]);
    setAttachError(null);
  };

  const handleNewChat = (projectId: string | null, seedPrompt = '') => {
    abortStream();
    sessionsApi.newChat(projectId);
    resetComposer();
    setInputText(seedPrompt);
    setProjectHomeId(null);
  };

  const handleSelectSession = (sessionId: string) => {
    abortStream();
    sessionsApi.selectSession(sessionId);
    resetComposer();
    setProjectHomeId(null);
  };

  const handleConfirmClear = () => {
    abortStream();
    sessionsApi.clearActiveChat();
    resetComposer();
    setShowClearConfirm(false);
  };

  const handleStartProjectChat = () => {
    if (!activeProject) return;
    handleNewChat(activeProject.id, projectPrompt);
    setProjectPrompt('');
  };

  const handleBuyPack = async (pack: Parameters<typeof creditsApi.buy>[0]) => {
    // Play builds ship without purchasable packs; nothing should reach the
    // treasury transfer even if a stale sheet is somehow still mounted.
    if (!AI_CREDIT_PACKS_ENABLED) return;

    const receipt = await creditsApi.buy(pack);
    if (receipt) {
      setAttachError(null);
      setReceiptToShow(receipt);
      setReceiptOpen(true);
    }
  };

  const openLastReceipt = () => {
    if (!creditsApi.lastReceipt) return;
    setReceiptToShow(creditsApi.lastReceipt);
    setReceiptOpen(true);
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  const canSend =
    (!!inputText.trim() || selectedImages.length > 0) &&
    creditsApi.summary.totalLeft > 0 &&
    sessionsApi.hydrated;

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.bg }, keyboardPaddingStyle]}>
      <CustomStatusBar />

      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: top || 0, borderBottomColor: colors.bgStroke, backgroundColor: colors.bg },
        ]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} hitSlop={10} style={styles.icon24}>
            <Feather name="sidebar" size={20} color={colors.primaryCTA} />
          </TouchableOpacity>

          <View style={styles.headerLeft}>
            <View style={styles.headerLogo}>
              <Image
                source={require('../assets/home/bot/Layer_1.svg')}
                style={styles.headerLogoImage}
                contentFit="contain"
              />
            </View>
            <View style={styles.headerTextBlock}>
              <Text style={[styles.headerTitle, { color: colors.primaryCTA }]}>TIWI AI</Text>
              <Text style={[styles.headerSubtitle, { color: colors.mutedText }]} numberOfLines={1}>
                {sessionsApi.activeSession?.title || 'Ask me anything about TIWI Protocol'}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => {
                // Re-read on open so a credit spent in the web app is
                // reflected here straight away.
                void creditsApi.refreshBalance();
                setCreditsOpen(true);
              }}
              style={styles.creditPill}
            >
              <Feather name="zap" size={11} color={colors.primaryCTA} />
              <Text style={styles.creditPillText}>{creditsApi.summary.totalLeft}</Text>
            </TouchableOpacity>
            {messages.length > 0 && (
              <TouchableOpacity onPress={() => setShowClearConfirm(true)} hitSlop={8} style={styles.icon20}>
                <Image
                  source={require('../assets/home/bot/delete-03.svg')}
                  style={styles.fullSize}
                  contentFit="contain"
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleClose} hitSlop={8} style={styles.icon24}>
              <Image
                source={require('../assets/home/bot/cancel-01.svg')}
                style={styles.fullSize}
                contentFit="contain"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {activeProject ? (
        <ProjectHomeView
          project={activeProject}
          sessions={sessionsApi.sessions.filter((s) => s.projectId === activeProject.id)}
          prompt={projectPrompt}
          onPromptChange={setProjectPrompt}
          onStartChat={handleStartProjectChat}
          onSelectSession={handleSelectSession}
          onOpenSettings={() => setProjectSettingsId(activeProject.id)}
          onClose={() => setProjectHomeId(null)}
          isListening={listeningField === 'project'}
          onToggleVoice={() => handleMicPress('project')}
        />
      ) : (
        <>
          {/* Scroll to Bottom Button */}
          {showScrollToBottom && (
            <TouchableOpacity
              onPress={handleScrollToBottom}
              style={[
                styles.scrollToBottomButton,
                { backgroundColor: colors.bgCards, borderColor: colors.bgStroke },
              ]}
            >
              <Image
                source={require('../assets/home/arrow-down-01.svg')}
                style={styles.icon20}
                contentFit="contain"
              />
            </TouchableOpacity>
          )}

          {/* Chat Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.flex1}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 && (
              <View style={styles.emptyState}>
                <View style={styles.welcomeLogoOuterGlow}>
                  <View style={styles.welcomeLogoInnerGlow}>
                    <View style={styles.welcomeLogoCore}>
                      <Image
                        source={require('../assets/home/bot/Layer_1.svg')}
                        style={styles.welcomeLogoImage}
                        contentFit="contain"
                      />
                    </View>
                  </View>
                </View>
                <Text style={[styles.welcomeTitle, { color: colors.titleText }]}>
                  Hi, I&apos;m TIWI AI
                </Text>
                <Text style={[styles.welcomeSubtitle, { color: colors.mutedText }]}>
                  Ask me anything about the platform
                </Text>
                <View style={styles.suggestionList}>
                  {SUGGESTIONS.map((suggestion) => (
                    <TouchableOpacity
                      key={suggestion}
                      activeOpacity={0.7}
                      onPress={() => setInputText(suggestion)}
                      style={[
                        styles.suggestionChip,
                        { backgroundColor: colors.bgCards, borderColor: colors.bgStroke },
                      ]}
                    >
                      <Text style={[styles.suggestionText, { color: colors.bodyText }]}>
                        {suggestion}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageWrapper,
                  { alignItems: message.type === 'user' ? 'flex-end' : 'flex-start' },
                ]}
              >
                {message.type === 'ai' ? (
                  <View style={styles.aiMessageContainer}>
                    <View style={styles.aiAvatar}>
                      <View style={styles.aiIconWrapper}>
                        <Image
                          source={require('../assets/home/bot/Layer_1.svg')}
                          style={styles.aiIcon}
                          contentFit="contain"
                        />
                      </View>
                    </View>
                    <View style={styles.aiTextContent}>
                      {message.isStreaming && message.text === '' && (
                        <View style={styles.typingIndicatorWrapper}>
                          <TypingIndicator size={8} color={colors.bodyText} spacing={4} />
                        </View>
                      )}
                      {message.isStreaming && message.text !== '' && (
                        <View style={styles.streamingIndicator} />
                      )}
                      <View style={styles.aiTextColumn}>
                        <MarkdownMessage content={message.text} />
                        {!message.isStreaming && message.text.length > 0 && (
                          <AiMessageFooter
                            validation={message.validation}
                            creditCharged={message.creditCharged}
                            feedback={message.feedback}
                            copied={copiedMessageId === message.id}
                            onShare={() => handleShareInsight(message.id, message.text)}
                            onCopy={() => handleCopyMessage(message.id, message.text)}
                            onRetry={() => handleRetry(message.id)}
                            onFeedback={(value) => handleFeedback(message.id, value)}
                            retryDisabled={isStreaming}
                          />
                        )}
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.userMessageContainer}>
                    {message.imageUris && message.imageUris.length > 0 && (
                      <View style={styles.userImageContainer}>
                        {message.imageUris.map((uri, index) => (
                          <TouchableOpacity
                            key={index}
                            activeOpacity={0.85}
                            onPress={() => setViewerImageUri(uri)}
                            style={styles.userImageWrapper}
                          >
                            <Image source={{ uri }} style={styles.fullSize} contentFit="cover" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {message.text && (
                      <View style={[styles.userBubble, { backgroundColor: colors.bgStroke }]}>
                        <Text style={[styles.userMessageText, { color: colors.bodyText }]}>
                          {message.text}
                        </Text>
                      </View>
                    )}
                    {message.text.length > 0 &&
                      (() => {
                        const node = tree.nodes[message.id];
                        const parentKey = node?.parentId ?? ROOT_KEY;
                        const siblings = tree.childrenByParent[parentKey] || [];
                        const myIdx = siblings.indexOf(message.id);
                        const hasVersions = siblings.length > 1 && myIdx >= 0;
                        return (
                          <View style={styles.userActionsRow}>
                            {hasVersions && (
                              <View style={styles.versionPager}>
                                <TouchableOpacity
                                  onPress={() => handleSwitchSibling(parentKey, myIdx - 1)}
                                  disabled={myIdx <= 0}
                                  hitSlop={6}
                                  style={[styles.versionArrow, { opacity: myIdx <= 0 ? 0.3 : 1 }]}
                                >
                                  <Image
                                    source={require('../assets/home/arrow-right-01.svg')}
                                    style={[styles.icon12, styles.flipX]}
                                    contentFit="contain"
                                  />
                                </TouchableOpacity>
                                <Text style={[styles.versionText, { color: colors.mutedText }]}>
                                  {myIdx + 1} / {siblings.length}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => handleSwitchSibling(parentKey, myIdx + 1)}
                                  disabled={myIdx >= siblings.length - 1}
                                  hitSlop={6}
                                  style={[
                                    styles.versionArrow,
                                    { opacity: myIdx >= siblings.length - 1 ? 0.3 : 1 },
                                  ]}
                                >
                                  <Image
                                    source={require('../assets/home/arrow-right-01.svg')}
                                    style={styles.icon12}
                                    contentFit="contain"
                                  />
                                </TouchableOpacity>
                              </View>
                            )}
                            <TouchableOpacity
                              onPress={() => handleCopyMessage(message.id, message.text)}
                              style={styles.messageActionButton}
                              hitSlop={8}
                            >
                              <Feather
                                name={copiedMessageId === message.id ? 'check' : 'copy'}
                                size={13}
                                color={
                                  copiedMessageId === message.id ? colors.primaryCTA : colors.mutedText
                                }
                              />
                              <Text
                                style={[
                                  styles.messageActionLabel,
                                  {
                                    color:
                                      copiedMessageId === message.id
                                        ? colors.primaryCTA
                                        : colors.mutedText,
                                  },
                                ]}
                              >
                                {copiedMessageId === message.id ? 'Copied' : 'Copy'}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleShareInsight(message.id, message.text)}
                              style={styles.messageActionButton}
                              hitSlop={8}
                            >
                              <Feather name="share-2" size={13} color={colors.mutedText} />
                              <Text style={[styles.messageActionLabel, { color: colors.mutedText }]}>
                                Share
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleEditMessage(message.id)}
                              style={styles.messageActionButton}
                              hitSlop={8}
                            >
                              <Image
                                source={require('../assets/settings/pencil-edit-01.svg')}
                                style={styles.icon14}
                                contentFit="contain"
                              />
                              <Text style={[styles.messageActionLabel, { color: colors.mutedText }]}>
                                Edit
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })()}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          {/* Editing banner */}
          {editingMessageId && (
            <View
              style={[
                styles.editingBanner,
                { backgroundColor: colors.bgCards, borderColor: colors.bgStroke },
              ]}
            >
              <View style={styles.editingBannerLeft}>
                <Image
                  source={require('../assets/settings/pencil-edit-01.svg')}
                  style={styles.icon14}
                  contentFit="contain"
                />
                <Text style={[styles.editingBannerText, { color: colors.bodyText }]}>
                  Editing message - send to create a new version
                </Text>
              </View>
              <TouchableOpacity onPress={handleCancelEdit} hitSlop={8}>
                <Text style={[styles.editingBannerCancel, { color: colors.primaryCTA }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Input Bar */}
          <View
            style={[
              styles.inputBar,
              { paddingBottom: isKeyboardVisible ? 8 : bottom || 16, backgroundColor: colors.bg },
            ]}
          >
            {inputHeight >= MAX_INPUT_HEIGHT * 0.8 && (
              <TouchableOpacity
                onPress={handleOpenFullScreen}
                disabled={isStreaming}
                style={[
                  styles.expandIcon,
                  { opacity: isStreaming ? 0.5 : 1, top: 26 + (selectedImages.length > 0 ? 75 : 10) },
                ]}
              >
                <Image
                  source={require('../assets/home/bot/square-expand.svg')}
                  style={styles.icon20}
                  contentFit="contain"
                />
              </TouchableOpacity>
            )}

            {attachError && <Text style={styles.attachError}>{attachError}</Text>}

            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: colors.bgCards,
                  borderColor: colors.primaryCTA,
                  borderRadius: 28,
                  paddingHorizontal: selectedImages.length > 0 ? 12 : 8,
                  paddingVertical: selectedImages.length > 0 ? 10 : 6,
                  minHeight: selectedImages.length > 0 ? 56 : 48,
                },
              ]}
            >
              {/* Image Preview Section */}
              {selectedImages.length > 0 && (
                <View style={styles.previewContainer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.maxH80}
                    contentContainerStyle={styles.gap8}
                  >
                    {selectedImages.map((image, index) => (
                      <View
                        key={index}
                        style={[styles.previewWrapper, { backgroundColor: colors.bgStroke }]}
                      >
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => setViewerImageUri(image.uri)}
                          style={styles.fullSize}
                        >
                          <Image source={{ uri: image.uri }} style={styles.fullSize} contentFit="cover" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleRemoveImage(index)}
                          style={[
                            styles.removeImageButton,
                            { backgroundColor: colors.bg, borderColor: colors.bgStroke },
                          ]}
                        >
                          <Text style={[styles.removeImageText, { color: colors.bodyText }]}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    <Text style={styles.attachCount}>
                      {selectedImages.length}/{MAX_IMAGES}
                    </Text>
                  </ScrollView>
                </View>
              )}

              {/* Input Row */}
              <View style={[styles.inputRow, styles.itemsCenter]}>
                <TouchableOpacity
                  onPress={handleImageUpload}
                  disabled={selectedImages.length >= MAX_IMAGES || isStreaming}
                  style={[
                    styles.iconAction,
                    { opacity: selectedImages.length >= MAX_IMAGES || isStreaming ? 0.5 : 1 },
                  ]}
                >
                  <Image
                    source={require('../assets/home/bot/image-add-02.svg')}
                    style={styles.icon20}
                    contentFit="contain"
                  />
                </TouchableOpacity>

                <TextInput
                  ref={inputTextRef}
                  value={inputText}
                  onChangeText={setInputText}
                  onContentSizeChange={handleContentSizeChange}
                  onPressIn={scrollToBottomNow}
                  onFocus={scrollToBottomNow}
                  placeholder="Ask TIWI AI Anything"
                  placeholderTextColor={colors.mutedText}
                  style={[
                    styles.textInput,
                    {
                      color: colors.bodyText,
                      height: inputHeight,
                      ...Platform.select({ ios: { lineHeight: 20 } }),
                    },
                  ]}
                  multiline
                  maxLength={MAX_CHARACTERS}
                  editable={!isStreaming}
                  scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
                />

                {!inputText.trim() && (
                  <TouchableOpacity
                    onPress={() => handleMicPress('main')}
                    disabled={isStreaming}
                    style={[styles.iconAction, { opacity: isStreaming ? 0.5 : 1 }]}
                  >
                    {isRecording && listeningField === 'main' ? (
                      <View style={styles.recordingIndicator} />
                    ) : (
                      <Image
                        source={require('../assets/home/bot/mic-02.svg')}
                        style={styles.icon20}
                        contentFit="contain"
                      />
                    )}
                  </TouchableOpacity>
                )}

                {!isStreaming ? (
                  <TouchableOpacity
                    onPress={() => handleSend(false)}
                    activeOpacity={0.8}
                    disabled={!canSend}
                    style={[
                      styles.sendButton,
                      { backgroundColor: colors.primaryCTA, opacity: canSend ? 1 : 0.5 },
                    ]}
                  >
                    <Image
                      source={require('../assets/home/bot/arrow-up-02.svg')}
                      style={styles.icon20}
                      contentFit="contain"
                    />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={handleStop} activeOpacity={0.8} style={styles.stopButton}>
                    <Image
                      source={require('../assets/home/bot/stop-button.svg')}
                      style={styles.icon14}
                      contentFit="contain"
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <Text style={[styles.disclaimer, { color: colors.mutedText }]}>
              {creditsApi.summary.totalLeft} AI credits left · Security validation active · Verify
              important info.
            </Text>
          </View>
        </>
      )}

      {/* Full-Screen Input Modal */}
      <Modal
        visible={isFullScreenInput}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsFullScreenInput(false)}
      >
        <KeyboardAvoidingView
          style={[styles.flex1, { backgroundColor: colors.bg }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <CustomStatusBar />

          <View
            style={[
              styles.modalHeader,
              {
                paddingTop: top || 0,
                backgroundColor: colors.bg,
                borderBottomColor: colors.bgStroke,
              },
            ]}
          >
            <Text style={[styles.headerTitle, { color: colors.titleText }]}>Ask Tiwi AI</Text>
            <TouchableOpacity onPress={() => setIsFullScreenInput(false)} style={styles.minimizeButton}>
              <Image
                source={require('../assets/home/bot/minimize-arrows.svg')}
                style={styles.icon20}
                contentFit="contain"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {selectedImages.length > 0 && (
              <View style={styles.mb16}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.gap12}
                >
                  {selectedImages.map((image, index) => (
                    <View
                      key={index}
                      style={[styles.modalPreviewWrapper, { backgroundColor: colors.bgStroke }]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setViewerImageUri(image.uri)}
                        style={styles.fullSize}
                      >
                        <Image source={{ uri: image.uri }} style={styles.fullSize} contentFit="cover" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveImage(index)}
                        style={[
                          styles.removeImageModal,
                          { backgroundColor: colors.bg, borderColor: colors.bgStroke },
                        ]}
                      >
                        <Text style={[styles.removeTextModal, { color: colors.bodyText }]}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <TextInput
              ref={fullScreenInputRef}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask anything..."
              placeholderTextColor={colors.bodyText}
              style={[styles.modalTextInput, { color: colors.bodyText }]}
              multiline
              maxLength={MAX_CHARACTERS}
              editable={!isStreaming}
              autoFocus
            />
          </View>

          <View
            style={[
              styles.modalBottomBar,
              {
                borderTopColor: colors.bgStroke,
                paddingBottom: (bottom || 16) + 16,
                backgroundColor: colors.bg,
              },
            ]}
          >
            <TouchableOpacity
              onPress={handleImageUpload}
              disabled={selectedImages.length >= MAX_IMAGES || isStreaming}
              style={[
                styles.icon24,
                { opacity: selectedImages.length >= MAX_IMAGES || isStreaming ? 0.5 : 1 },
              ]}
            >
              <Image
                source={require('../assets/home/bot/image-add-02.svg')}
                style={styles.icon24}
                contentFit="contain"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleMicPress('main')}
              disabled={isStreaming}
              style={[styles.icon24, { opacity: isStreaming ? 0.5 : 1 }]}
            >
              {isRecording ? (
                <View style={styles.recordingDot} />
              ) : (
                <Image
                  source={require('../assets/home/bot/mic-02.svg')}
                  style={styles.icon24}
                  contentFit="contain"
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleSend(true)}
              activeOpacity={0.8}
              disabled={!canSend}
              style={[
                styles.modalSendButton,
                { backgroundColor: colors.primaryCTA, opacity: canSend ? 1 : 0.5 },
              ]}
            >
              <Image
                source={require('../assets/home/bot/arrow-up-02.svg')}
                style={styles.icon22}
                contentFit="contain"
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Clear-history confirmation */}
      <Modal
        visible={showClearConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearConfirm(false)}
      >
        <View style={styles.confirmOverlay}>
          <Pressable style={styles.confirmBackdrop} onPress={() => setShowClearConfirm(false)} />
          <View style={styles.confirmCard}>
            <View style={styles.confirmAccent} />
            <View style={styles.confirmHeader}>
              <View style={styles.confirmIcon}>
                <Feather name="trash-2" size={18} color={colors.error} />
              </View>
              <View>
                <Text style={styles.confirmTitle}>Clear history</Text>
                <Text style={styles.confirmEyebrow}>IRREVERSIBLE ACTION</Text>
              </View>
            </View>
            <Text style={styles.confirmBody}>
              This will permanently remove all messages in this chat from your device. This action
              cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowClearConfirm(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDanger} onPress={handleConfirmClear}>
                <Text style={styles.confirmDangerText}>Confirm Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ChatHistoryDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sessions={sessionsApi.filteredSessions}
        projects={sessionsApi.sortedProjects}
        activeSessionId={sessionsApi.activeSessionId}
        organizationMode={sessionsApi.organizationMode}
        search={sessionsApi.search}
        sessionsInProject={sessionsApi.sessionsInProject}
        onSearchChange={sessionsApi.setSearch}
        onOrganizationModeChange={sessionsApi.setOrganizationMode}
        onNewChat={(projectId) => handleNewChat(projectId)}
        onSeedPrompt={(prompt) => handleNewChat(null, prompt)}
        onSelectSession={handleSelectSession}
        onRenameSession={sessionsApi.renameSession}
        onToggleSessionPin={sessionsApi.toggleSessionPin}
        onDeleteSession={sessionsApi.deleteSession}
        onCopy={copyText}
        onCreateProject={() => sessionsApi.createProject()}
        onRenameProject={sessionsApi.renameProject}
        onToggleProjectPin={sessionsApi.toggleProjectPin}
        onDeleteProject={sessionsApi.deleteProject}
        onOpenProjectHome={(projectId) => {
          setProjectHomeId(projectId);
          setDrawerOpen(false);
        }}
        onOpenProjectSettings={(projectId) => {
          setProjectSettingsId(projectId);
          setDrawerOpen(false);
        }}
      />

      <AiCreditsSheet
        visible={creditsOpen}
        onClose={() => setCreditsOpen(false)}
        summary={creditsApi.summary}
        freeMonthlyCredits={creditsApi.freeMonthlyCredits}
        packs={AI_CREDIT_PACKS_ENABLED ? creditsApi.packs : []}
        paySymbol={creditsApi.paySymbol}
        payTokenBalanceLabel={creditsApi.payTokenBalanceLabel}
        buyingPackId={creditsApi.buyingPackId}
        billingMessage={creditsApi.billingMessage}
        onBuy={handleBuyPack}
        hasReceipt={!!creditsApi.lastReceipt}
        onViewReceipt={openLastReceipt}
      />

      <AiReceiptModal
        visible={receiptOpen}
        receipt={receiptToShow || creditsApi.lastReceipt}
        onClose={() => setReceiptOpen(false)}
        onCopied={creditsApi.setBillingMessage}
      />

      <ProjectSettingsModal
        project={settingsProject}
        chatCount={
          settingsProject
            ? sessionsApi.sessions.filter((s) => s.projectId === settingsProject.id).length
            : 0
        }
        onClose={() => setProjectSettingsId(null)}
        onSave={(title) => {
          if (settingsProject) sessionsApi.renameProject(settingsProject.id, title);
          setProjectSettingsId(null);
        }}
        onTogglePin={() => {
          if (settingsProject) sessionsApi.toggleProjectPin(settingsProject.id);
        }}
      />

      <ImageZoomViewer uri={viewerImageUri} onClose={() => setViewerImageUri(null)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010501',
  },
  flex1: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 0.5,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  headerTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#081f02',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoImage: {
    width: 16,
    height: 18,
  },
  headerTextBlock: {
    flex: 1,
    flexShrink: 1,
  },
  headerSubtitle: {
    fontFamily: 'Manrope-Medium',
    fontSize: 11,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  creditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(177,241,40,0.35)',
    backgroundColor: '#0B0F0A',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  creditPillText: {
    color: '#B1F128',
    fontFamily: 'Manrope-SemiBold',
    fontSize: 11,
  },
  fullSize: {
    width: '100%',
    height: '100%',
  },
  icon20: {
    width: 20,
    height: 20,
  },
  icon14: {
    width: 14,
    height: 14,
  },
  icon22: {
    width: 22,
    height: 22,
  },
  icon24: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 20,
    bottom: 120,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    gap: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 24,
  },
  welcomeLogoOuterGlow: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(177, 241, 40, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeLogoInnerGlow: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(177, 241, 40, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeLogoCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#081f02',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeLogoImage: {
    width: 32,
    height: 36,
  },
  welcomeTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 22,
    marginTop: 16,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontFamily: 'Manrope-Medium',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  suggestionList: {
    width: '100%',
    marginTop: 28,
    gap: 10,
  },
  suggestionChip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  suggestionText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 14,
  },
  disclaimer: {
    fontFamily: 'Manrope-Medium',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  messageWrapper: {
    width: '100%',
  },
  aiMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
  },
  aiAvatar: {
    backgroundColor: '#081f02',
    borderRadius: 22,
    paddingHorizontal: 9.41,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiIconWrapper: {
    width: 21.184,
    height: 24,
  },
  aiIcon: {
    width: '100%',
    height: '100%',
  },
  aiTextContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  aiTextColumn: {
    flex: 1,
    flexDirection: 'column',
    gap: 6,
  },
  messageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  messageActionLabel: {
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
  },
  icon12: {
    width: 12,
    height: 12,
  },
  flipX: {
    transform: [{ scaleX: -1 }],
  },
  userActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  versionPager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  versionArrow: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
    minWidth: 28,
    textAlign: 'center',
  },
  editingBanner: {
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 12,
  },
  editingBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  editingBannerText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
    flex: 1,
  },
  editingBannerCancel: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 13,
  },
  typingIndicatorWrapper: {
    marginTop: 2,
    flexShrink: 0,
  },
  streamingIndicator: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: '#1F261E',
    marginTop: 2,
    flexShrink: 0,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
    width: '100%',
  },
  userImageContainer: {
    marginBottom: 8,
    flexDirection: 'row',
    gap: 8,
    maxWidth: '80%',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  userImageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    width: 150,
    height: 150,
  },
  userBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '85%',
  },
  userMessageText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  inputBar: {
    borderTopWidth: 0.5,
    paddingTop: 6,
    paddingHorizontal: 5,
    position: 'relative',
    borderTopColor: 'transparent',
  },
  attachError: {
    color: '#FF5C5C',
    fontFamily: 'Manrope-Medium',
    fontSize: 11,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  attachCount: {
    color: '#7C7C7C',
    fontFamily: 'Manrope-Medium',
    fontSize: 10,
    alignSelf: 'center',
    marginLeft: 4,
  },
  expandIcon: {
    position: 'absolute',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    right: 40,
  },
  inputContainer: {
    borderWidth: 1,
    position: 'relative',
    borderRadius: 16,
  },
  previewContainer: {
    marginBottom: 8,
    marginTop: 1,
  },
  maxH80: {
    maxHeight: 80,
  },
  gap8: {
    gap: 8,
    paddingHorizontal: 0,
  },
  previewWrapper: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
  },
  removeImageButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
  },
  removeImageText: {
    fontSize: 12,
    lineHeight: 14,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 2,
    alignItems: 'center',
  },
  itemsCenter: {
    alignItems: 'center',
  },
  iconAction: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontFamily: 'Manrope-Medium',
    fontSize: 14,
    minHeight: 20,
    textAlignVertical: 'top',
    includeFontPadding: false,
    padding: 0,
  },
  recordingIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeader: {
    borderBottomWidth: 0.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  minimizeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  mb16: {
    marginBottom: 16,
  },
  gap12: {
    gap: 12,
  },
  modalPreviewWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  removeImageModal: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTextModal: {
    fontSize: 14,
  },
  modalTextInput: {
    flex: 1,
    fontFamily: 'Manrope-Medium',
    fontSize: 16,
    textAlignVertical: 'top',
    includeFontPadding: false,
    padding: 0,
  },
  modalBottomBar: {
    borderTopWidth: 0.5,
    paddingHorizontal: 20,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  recordingDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
  },
  modalSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  confirmOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#3A160F',
    backgroundColor: '#0B0F0A',
    padding: 20,
    overflow: 'hidden',
  },
  confirmAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FF5C5C',
    opacity: 0.8,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  confirmIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,92,92,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,92,92,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    color: '#FFFFFF',
    fontFamily: 'Manrope-Bold',
    fontSize: 15,
  },
  confirmEyebrow: {
    color: '#7C7C7C',
    fontFamily: 'Manrope-Bold',
    fontSize: 9,
    letterSpacing: 1.4,
    marginTop: 3,
  },
  confirmBody: {
    color: '#B5B5B5',
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmCancel: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#1F3C19',
    alignItems: 'center',
    paddingVertical: 12,
  },
  confirmCancelText: {
    color: '#9AA39A',
    fontFamily: 'Manrope-Bold',
    fontSize: 12,
  },
  confirmDanger: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#FF5C5C',
    alignItems: 'center',
    paddingVertical: 12,
  },
  confirmDangerText: {
    color: '#FFFFFF',
    fontFamily: 'Manrope-Bold',
    fontSize: 12,
  },
});
