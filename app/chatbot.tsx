import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { TypingIndicator } from '@/components/ui/TypingIndicator';
import { colors } from '@/constants/colors';
import { initializeAIClient, isAIClientInitialized, streamAIResponse } from '@/services/aiService';
import { transcribeAudio } from '@/services/speechService';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from 'expo-audio';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Dimensions, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ChatMessage {
  id: string;
  type: 'ai' | 'user';
  text: string;
  imageUris?: string[]; // Support multiple images
  isStreaming?: boolean;
}

// Image size limit: 10MB (industry standard for mobile apps)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Audio recording limits: 60 seconds max (industry standard)
const MAX_AUDIO_DURATION = 60000; // 60 seconds in milliseconds

/**
 * Chatbot Screen Component
 * Currently in development — shows coming soon screen
 */
export default function ChatbotScreen() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();

  // ── COMING SOON MODE ──
  const COMING_SOON = true;

  if (COMING_SOON) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <CustomStatusBar />
        <View style={{ paddingTop: top, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#121712', alignItems: 'center', justifyContent: 'center' }}>
            <Image source={require('@/assets/settings/arrow-left-02.svg')} style={{ width: 20, height: 20 }} contentFit="contain" />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontFamily: 'Manrope-Bold', fontSize: 18, color: '#FFFFFF', marginRight: 40 }}>TIWI AI</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(177, 241, 40, 0.08)', borderWidth: 1, borderColor: 'rgba(177, 241, 40, 0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <Image source={require('@/assets/logo/tiwi-logo.svg')} style={{ width: 48, height: 48 }} contentFit="contain" />
          </View>
          <Text style={{ fontFamily: 'Manrope-Bold', fontSize: 24, color: '#FFFFFF', textAlign: 'center', marginBottom: 12 }}>Coming Soon</Text>
          <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 15, color: '#888888', textAlign: 'center', lineHeight: 22 }}>
            TIWI AI is being fine-tuned to give you the best DeFi experience. Our team is building an intelligent assistant that understands crypto, markets, and your portfolio.
          </Text>
          <Text style={{ fontFamily: 'Manrope-Medium', fontSize: 13, color: '#B1F128', textAlign: 'center', marginTop: 20 }}>Stay tuned for updates</Text>
        </View>
      </View>
    );
  }
  // ── END COMING SOON ──

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImages, setSelectedImages] = useState<{ uri: string; mimeType: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [isFullScreenInput, setIsFullScreenInput] = useState(false);
  const [inputHeight, setInputHeight] = useState(20);
  const [isCalculatingHeight, setIsCalculatingHeight] = useState(false);
  const inputContentHeightRef = useRef(0);
  const lastTextLengthRef = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingStartTimeRef = useRef<number>(0);
  const fullScreenInputRef = useRef<TextInput>(null);
  const inputTextRef = useRef<TextInput>(null);
  const MAX_IMAGES = 3;
  const MAX_INPUT_HEIGHT = 200; // Max height before scrolling
  const MAX_CHARACTERS = 10000; // Increased character limit

  // Initialize AI client on mount
  useEffect(() => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
    if (apiKey) {
      initializeAIClient(apiKey);
    } else {
      console.warn('Gemini API key not found. Set EXPO_PUBLIC_GEMINI_API_KEY in your .env file');
    }
  }, []);

  // Handle phone back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isNearBottom) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isNearBottom]);

  // Handle scroll position to show/hide scroll-to-bottom button
  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 100; // Threshold for "near bottom"
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    setIsNearBottom(isAtBottom);
    setShowScrollToBottom(!isAtBottom && messages.length > 0);
  };

  // Scroll to bottom handler
  const handleScrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
    setIsNearBottom(true);
    setShowScrollToBottom(false);
  };

  const handleClose = () => {
    // Stop any ongoing operations
    if (isStreaming && abortController) {
      abortController.abort();
    }
    // if (isRecording) {
    //   stopRecording();
    // }
    router.back();
  };

  const handleClear = () => {
    // Stop any ongoing operations
    if (isStreaming && abortController) {
      abortController.abort();
    }
    // if (isRecording) {
    //   stopRecording();
    // }
    setMessages([]);
    setSelectedImages([]);
    setInputText('');
  };

  // Image Upload Handler
  const handleImageUpload = async () => {
    try {
      // Check if already at max images
      if (selectedImages.length >= MAX_IMAGES) {
        Alert.alert('Maximum Images Reached', `You can only upload up to ${MAX_IMAGES} images at once.`);
        return;
      }

      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant access to your photos to upload images.');
        return;
      }

      // Calculate how many more images can be selected
      const remainingSlots = MAX_IMAGES - selectedImages.length;

      // Launch image picker with multiple selection
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
      });

      if (!result.canceled && result.assets.length > 0) {
        const validAssets = result.assets
          .filter((asset) => {
            // Check file size
            if (asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE) {
              Alert.alert('Image Too Large', `One or more images exceed ${MAX_IMAGE_SIZE / (1024 * 1024)}MB limit`);
              return false;
            }
            return true;
          })
          .slice(0, remainingSlots) // Ensure we don't exceed max
          .map((asset) => ({
            uri: asset.uri,
            mimeType: asset.mimeType || 'image/jpeg',
          }));

        setSelectedImages((prev) => [...prev, ...validAssets]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Remove selected image
  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Audio Recording Handlers
  const startRecording = async () => {
    try {
      // Request permissions
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Please grant microphone access for voice input.');
        return;
      }

      // Start recording using the new expo-audio API
      await recorder.record();
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      setIsRecording(false);

      if (uri) {
        // Check duration from the startTimeRef
        const duration = Date.now() - recordingStartTimeRef.current;
        if (duration > MAX_AUDIO_DURATION) {
          Alert.alert('Recording Too Long', `Please keep recordings under ${MAX_AUDIO_DURATION / 1000} seconds`);
          return;
        }

        // Transcribe audio
        try {
          const transcribedText = await transcribeAudio(uri);
          if (transcribedText) {
            setInputText((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText));
          } else {
            if (duration > 500) {
              Alert.alert('No Speech Detected', 'Could not detect any speech in the recording.');
            }
          }
        } catch (error) {
          console.error('Error transcribing audio:', error);
          Alert.alert('Error', 'Failed to transcribe audio. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
    }
  };

  const handleMicPress = () => {
    console.log('Mic pressed');
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Handle full-screen input open
  const handleOpenFullScreen = () => {
    setIsFullScreenInput(true);
    // Focus input after modal opens
    setTimeout(() => {
      fullScreenInputRef.current?.focus();
    }, 100);
  };

  // Handle full-screen input close (minimize)
  const handleCloseFullScreen = () => {
    setIsFullScreenInput(false);
  };

  // Handle content size change for dynamic height
  const handleContentSizeChange = (event: any) => {
    // If the text is empty, always snap back to the minimum height
    if (!inputText.trim()) {
      if (inputHeight !== 20) {
        setInputHeight(20);
      }
      return;
    }

    const { height } = event.nativeEvent.contentSize;
    if (height && height > 0) {
      inputContentHeightRef.current = height;

      // Calculate line height based on font size (14px font * 1.4 line height = ~20px per line)
      const lineHeight = 14 * 1.4; // Approx 20px per line
      const padding = 10; // Account for padding
      const border = 2; // Account for border

      // Calculate expected height based on actual text lines
      const lines = inputText.split('\n').length;
      const expectedHeight = Math.max(
        20, // Minimum height
        Math.min(
          (lines * lineHeight) + padding + border,
          MAX_INPUT_HEIGHT
        )
      );

      // Smooth transition - only update if significant change
      if (Math.abs(expectedHeight - inputHeight) >= 2) {
        setInputHeight(expectedHeight);
      }
    }
  };

  // Recalculate height when text changes to ensure immediate updates
  useEffect(() => {
    if (inputText.trim() === '') {
      // Immediate reset when text is empty
      setInputHeight(20);
      return;
    }
    const timeoutId = setTimeout(() => {
      // Calculate height based on line count and characters
      const lines = inputText.split('\n').length;
      const lineHeight = 20; // Approx line height
      const padding = 10;

      // Calculate base height
      let calculatedHeight = (lines * lineHeight) + padding;

      // Account for word wrapping (approx 40 characters per line on mobile)
      const charsPerLine = 40;
      const wrappedLines = Math.ceil(inputText.length / charsPerLine);
      const totalLines = Math.max(lines, wrappedLines);

      calculatedHeight = (totalLines * lineHeight) + padding;

      // Clamp between min and max
      const newHeight = Math.min(Math.max(20, calculatedHeight), MAX_INPUT_HEIGHT);

      // Only update if changed significantly
      if (Math.abs(newHeight - inputHeight) >= 2) {
        setInputHeight(newHeight);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [inputText]);

  // Send Message Handler
  const handleSend = async (closeFullScreen = false) => {
    const text = inputText.trim();
    // Don't send if no input and no images
    if (!text && selectedImages.length === 0) return;

    // Close full screen if it's open
    if (closeFullScreen || isFullScreenInput) {
      setIsFullScreenInput(false);
    }

    if (!isAIClientInitialized()) {
      Alert.alert('AI Not Available', 'Please configure the Gemini API key in your environment variables.');
      return;
    }

    // Create user message with all images
    const imagesToSend = [...selectedImages];
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: text || (selectedImages.length > 0 ? '[Image]' : ''),
      imageUris: imagesToSend.map(img => img.uri),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setSelectedImages([]);

    // Create streaming AI message
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      type: 'ai',
      text: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, aiMessage]);
    setStreamingMessageId(aiMessageId);
    setIsStreaming(true);

    // Create abort controller for cancellation
    const controller = new AbortController();
    setAbortController(controller);

    // Stream AI response
    // For now, send first image (Gemini API supports multiple images but we'll use first for simplicity)
    let accumulatedText = '';

    await streamAIResponse(
      text || (imagesToSend.length > 0 ? 'What is in this image?' : ''),
      imagesToSend.length > 0 ? imagesToSend[0].uri : undefined,
      imagesToSend.length > 0 ? imagesToSend[0].mimeType : undefined,
      (chunk) => {
        accumulatedText += chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, text: accumulatedText, isStreaming: true }
              : msg
          )
        );
        // Auto-scroll during streaming
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 50);
      },
      (fullText) => {
        // Streaming complete
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, text: fullText, isStreaming: false }
              : msg
          )
        );
        setIsStreaming(false);
        setStreamingMessageId(null);
        setAbortController(null);
      },
      (error) => {
        console.error('AI Error:', error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, text: 'Sorry, I encountered an error. Please try again.', isStreaming: false }
              : msg
          )
        );
        setIsStreaming(false);
        setStreamingMessageId(null);
        setAbortController(null);
        Alert.alert('Error', error.message || 'Failed to get AI response. Please try again.');
      },
      controller.signal
    );
  };

  // Stop streaming handler
  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setIsStreaming(false);
      setStreamingMessageId(null);
      setAbortController(null);

      // Update the streaming message to show it was stopped
      if (streamingMessageId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === streamingMessageId
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <CustomStatusBar />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: top || 0,
            borderBottomColor: colors.bgStroke,
            backgroundColor: colors.bg,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.titleText },
            ]}
          >
            Ask Tiwi AI
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <View style={styles.icon20}>
                <Image
                  source={require('../assets/home/bot/delete-03.svg')}
                  style={styles.fullSize}
                  contentFit="contain"
                />
              </View>
              <Text
                style={[
                  styles.clearText,
                  { color: colors.bodyText },
                ]}
              >
                Clear
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose} style={styles.icon24}>
              <Image
                source={require('../assets/home/bot/cancel-01.svg')}
                style={styles.fullSize}
                contentFit="contain"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Scroll to Bottom Button */}
      {showScrollToBottom && (
        <TouchableOpacity
          onPress={handleScrollToBottom}
          style={[
            styles.scrollToBottomButton,
            {
              backgroundColor: colors.bgCards,
              borderColor: colors.bgStroke,
            },
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
            <Text
              style={[
                styles.emptyStateText,
                { color: colors.bodyText },
              ]}
            >
              Start a conversation with Tiwi AI
            </Text>
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
                  <Text
                    style={[
                      styles.aiMessageText,
                      { color: colors.bodyText },
                    ]}
                  >
                    {message.text}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.userMessageContainer}>
                {message.imageUris && message.imageUris.length > 0 && (
                  <View style={styles.userImageContainer}>
                    {message.imageUris.map((uri, index) => (
                      <View key={index} style={styles.userImageWrapper}>
                        <Image
                          source={{ uri }}
                          style={styles.fullSize}
                          contentFit="cover"
                        />
                      </View>
                    ))}
                  </View>
                )}
                {message.text && (
                  <View
                    style={[
                      styles.userBubble,
                      { backgroundColor: colors.bgStroke },
                    ]}
                  >
                    <Text
                      style={[
                        styles.userMessageText,
                        { color: colors.bodyText },
                      ]}
                    >
                      {message.text}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Input Bar */}
      <View
        style={[
          styles.inputBar,
          {
            paddingBottom: (bottom || 16),
            backgroundColor: colors.bg,
          },
        ]}
      >
        {/* Square Expand Icon */}
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

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.bgCards,
              borderColor: colors.bgStroke,
              borderRadius: 16,
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
                    <Image
                      source={{ uri: image.uri }}
                      style={styles.fullSize}
                      contentFit="cover"
                    />
                    <TouchableOpacity
                      onPress={() => handleRemoveImage(index)}
                      style={[
                        styles.removeImageButton,
                        { backgroundColor: colors.bg, borderColor: colors.bgStroke },
                      ]}
                    >
                      <Text style={[styles.removeImageText, { color: colors.bodyText }]}>
                        ×
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input Row */}
          <View style={[styles.inputRow, styles.itemsCenter]}>
            {/* Image Add Icon */}
            <TouchableOpacity
              onPress={handleImageUpload}
              disabled={selectedImages.length >= MAX_IMAGES || isStreaming}
              style={[
                styles.iconAction,
                { opacity: (selectedImages.length >= MAX_IMAGES || isStreaming) ? 0.5 : 1 },
              ]}
            >
              <Image
                source={require('../assets/home/bot/image-add-02.svg')}
                style={styles.icon20}
                contentFit="contain"
              />
            </TouchableOpacity>

            {/* Input Field */}
            <TextInput
              ref={inputTextRef}
              value={inputText}
              onChangeText={setInputText}
              onContentSizeChange={handleContentSizeChange}
              placeholder="Ask anything"
              placeholderTextColor={colors.bodyText}
              style={[
                styles.textInput,
                {
                  color: colors.bodyText,
                  height: inputHeight,
                  ...Platform.select({
                    ios: { lineHeight: 20 },
                  }),
                },
              ]}
              multiline
              maxLength={MAX_CHARACTERS}
              editable={!isStreaming}
              scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
            />

            {/* Mic Icon */}
            {!inputText.trim() && (
              <TouchableOpacity
                onPress={handleMicPress}
                disabled={isStreaming}
                style={[
                  styles.iconAction,
                  { opacity: isStreaming ? 0.5 : 1 },
                ]}
              >
                {isRecording ? (
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

            {/* Send/Stop Button */}
            {!isStreaming ? (
              <TouchableOpacity
                onPress={() => handleSend(false)}
                activeOpacity={0.8}
                disabled={!inputText.trim() && selectedImages.length === 0}
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: colors.primaryCTA,
                    opacity: (!inputText.trim() && selectedImages.length === 0) ? 0.5 : 1,
                  },
                ]}
              >
                <Image
                  source={require('../assets/home/bot/arrow-up-02.svg')}
                  style={styles.icon20}
                  contentFit="contain"
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleStop}
                activeOpacity={0.8}
                style={[
                  styles.stopButton,
                  {},
                ]}
              >
                <Image
                  source={require('../assets/home/bot/stop-button.svg')}
                  style={styles.icon14}
                  contentFit="contain"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Full-Screen Input Modal */}
      <Modal
        visible={isFullScreenInput}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseFullScreen}
      >
        <KeyboardAvoidingView
          style={[styles.flex1, { backgroundColor: colors.bg }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <CustomStatusBar />

          {/* Modal Header */}
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
            <Text style={[styles.headerTitle, { color: colors.titleText }]}>
              Ask Tiwi AI
            </Text>
            <TouchableOpacity onPress={handleCloseFullScreen} style={styles.minimizeButton}>
              <Image
                source={require('../assets/home/bot/minimize-arrows.svg')}
                style={styles.icon20}
                contentFit="contain"
              />
            </TouchableOpacity>
          </View>

          {/* Modal Input Area */}
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
                      <Image
                        source={{ uri: image.uri }}
                        style={styles.fullSize}
                        contentFit="cover"
                      />
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
              style={[
                styles.modalTextInput,
                { color: colors.bodyText },
              ]}
              multiline
              maxLength={MAX_CHARACTERS}
              editable={!isStreaming}
              autoFocus
            />
          </View>

          {/* Modal Bottom Bar */}
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
                { opacity: (selectedImages.length >= MAX_IMAGES || isStreaming) ? 0.5 : 1 },
              ]}
            >
              <Image
                source={require('../assets/home/bot/image-add-02.svg')}
                style={styles.icon24}
                contentFit="contain"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleMicPress}
              disabled={isStreaming}
              style={[
                styles.icon24,
                { opacity: isStreaming ? 0.5 : 1 },
              ]}
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
              disabled={!inputText.trim() && selectedImages.length === 0}
              style={[
                styles.modalSendButton,
                {
                  backgroundColor: colors.primaryCTA,
                  opacity: (!inputText.trim() && selectedImages.length === 0) ? 0.5 : 1,
                },
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  headerTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 16,
    textTransform: 'capitalize',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 14,
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
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyStateText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 14,
    textAlign: 'center',
  },
  messageWrapper: {
    width: '100%',
  },
  aiMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 20,
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
  aiMessageText: {
    flex: 1,
    fontFamily: 'Manrope-Medium',
    fontSize: 14,
    letterSpacing: -0.28,
    lineHeight: 20,
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
    paddingHorizontal: 20,
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
    borderRadius: 100,
    paddingHorizontal: 10.5,
    paddingVertical: 10.5,
    maxWidth: '80%',
  },
  userMessageText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 14,
  },
  inputBar: {
    borderTopWidth: 0.5,
    paddingTop: 6,
    paddingHorizontal: 5,
    position: 'relative',
    borderTopColor: 'transparent',
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
    alignItems: 'center', // Added permanent center alignment
  },
  itemsEnd: {
    alignItems: 'flex-end',
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
});
