import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, BackHandler, KeyboardAvoidingView, Platform, Alert, Modal, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { StatusBar } from '@/components/ui/StatusBar';
import { TypingIndicator } from '@/components/ui/TypingIndicator';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { streamAIResponse, initializeAIClient, isAIClientInitialized } from '@/services/aiService';
import { transcribeAudio } from '@/services/speechService';

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
 * AI chat interface with real functionality
 * Matches Figma design exactly (node-id: 3331-39463)
 */
export default function ChatbotScreen() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]); // No mock data
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
  const recordingRef = useRef<Audio.Recording | null>(null);
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
    if (isRecording && recordingRef.current) {
      stopRecording();
    }
    router.back();
  };

  const handleClear = () => {
    // Stop any ongoing operations
    if (isStreaming && abortController) {
      abortController.abort();
    }
    if (isRecording && recordingRef.current) {
      stopRecording();
    }
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
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant microphone access for voice input.');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      setIsRecording(false);
      recordingRef.current = null;

      if (uri) {
        // Check duration
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
    }
  };

  const handleMicPress = () => {
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
      className="flex-1"
      style={{ backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar />

      {/* Header */}
      <View
        style={{
          paddingTop: top || 0,
          backgroundColor: colors.bg,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.bgStroke,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 8,
          }}
        >
          <Text
            style={{
              fontFamily: 'Manrope-SemiBold',
              fontSize: 16,
              color: colors.titleText,
              textTransform: 'capitalize',
            }}
          >
            Ask Tiwi AI
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <TouchableOpacity
              onPress={handleClear}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <View style={{ width: 20, height: 20 }}>
                <Image
                  source={require('../assets/home/bot/delete-03.svg')}
                  className="w-full h-full"
                  contentFit="contain"
                />
              </View>
              <Text
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 14,
                  color: colors.bodyText,
                }}
              >
                Clear
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose} style={{ width: 24, height: 24 }}>
              <Image
                source={require('../assets/home/bot/cancel-01.svg')}
                className="w-full h-full"
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
          style={{
            position: 'absolute',
            right: 20,
            bottom: 120, // Above input bar
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.bgCards,
            borderWidth: 1,
            borderColor: colors.bgStroke,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            elevation: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
          }}
        >
          <Image
            source={require('../assets/home/arrow-down-01.svg')}
            style={{ width: 20, height: 20 }}
            contentFit="contain"
          />
        </TouchableOpacity>
      )}

      {/* Chat Messages */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: 16,
          paddingHorizontal: 20,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 14,
                color: colors.bodyText,
                textAlign: 'center',
              }}
            >
              Start a conversation with Tiwi AI
            </Text>
          </View>
        )}
        {messages.map((message) => (
          <View
            key={message.id}
            style={{
              width: '100%',
              alignItems: message.type === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {message.type === 'ai' ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  paddingHorizontal: 20,
                  width: '100%',
                }}
              >
                <View
                  style={{
                    backgroundColor: '#081f02',
                    borderRadius: 22,
                    paddingHorizontal: 9.41,
                    paddingVertical: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View style={{ width: 21.184, height: 24 }}>
                    <Image
                      source={require('../assets/home/bot/Layer_1.svg')}
                      className="w-full h-full"
                      contentFit="contain"
                    />
                  </View>
                </View>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  {/* Typing indicator - shows when waiting for response (like WhatsApp) */}
                  {message.isStreaming && message.text === '' && (
                    <View style={{ marginTop: 2, flexShrink: 0 }}>
                      <TypingIndicator size={8} color={colors.bodyText} spacing={4} />
                    </View>
                  )}
                  {/* Loading box - shows when streaming with text (like ChatGPT) */}
                  {message.isStreaming && message.text !== '' && (
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 3,
                        backgroundColor: '#1F261E',
                        marginTop: 2,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: 'Manrope-Medium',
                      fontSize: 14,
                      color: colors.bodyText,
                      letterSpacing: -0.28,
                      lineHeight: 20,
                    }}
                  >
                    {message.text}
                  </Text>
                </View>
              </View>
            ) : (
              <View
                style={{
                  paddingHorizontal: 20,
                  alignItems: 'flex-end',
                  width: '100%',
                }}
              >
                {message.imageUris && message.imageUris.length > 0 && (
                  <View
                    style={{
                      marginBottom: 8,
                      flexDirection: 'row',
                      gap: 8,
                      maxWidth: '80%',
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                    }}
                  >
                    {message.imageUris.map((uri, index) => (
                      <View
                        key={index}
                        style={{
                          borderRadius: 12,
                          overflow: 'hidden',
                          width: 150,
                          height: 150,
                        }}
                      >
                        <Image
                          source={{ uri }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                        />
                      </View>
                    ))}
                  </View>
                )}
                {message.text && (
                  <View
                    style={{
                      backgroundColor: colors.bgStroke,
                      borderRadius: 100,
                      paddingHorizontal: 10.5,
                      paddingVertical: 10.5,
                      maxWidth: '80%',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Manrope-Medium',
                        fontSize: 14,
                        color: colors.bodyText,
                      }}
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
        className="border-t px-5 pt-4 relative"
        style={{
          borderTopColor: colors.bg,
          borderTopWidth: 0.5,
          paddingBottom: (bottom || 16),
          backgroundColor: colors.bg,
        }}
      >
        {/* Square Expand Icon - Outside input box, shows only when input is near max height */}
        {inputHeight >= MAX_INPUT_HEIGHT * 0.8 && (
          <TouchableOpacity
            onPress={handleOpenFullScreen}
            disabled={isStreaming}
            className="absolute w-5 h-5 items-center justify-center z-10"
            style={{
              opacity: isStreaming ? 0.5 : 1,
              // Position: top padding (16px) + container padding top (6 or 10px) = where input box content starts
              top: 26 + (selectedImages.length > 0 ? 75 : 10),
              // Position outside the input box: right padding (20px) - icon width/2 to sit outside border
              right: 40, // 10px from right edge, placing it outside the input box border
            }}
          >
            <Image
              source={require('../assets/home/bot/square-expand.svg')}
              className="w-5 h-5"
              contentFit="contain"
            />
          </TouchableOpacity>
        )}

        <View
          className="border relative"
          style={{
            backgroundColor: colors.bgCards,
            borderWidth: 1,
            borderColor: colors.bgStroke,
            // Dynamic border radius: rounded-full when small, rounded-2xl when tall OR when images are selected
            borderRadius: (inputHeight > 40 || selectedImages.length > 0) ? 24 : 100,
            paddingHorizontal: selectedImages.length > 0 ? 12 : 8,
            paddingVertical: selectedImages.length > 0 ? 10 : 6,
            minHeight: selectedImages.length > 0 ? 56 : 48,
          }}
        >
          {/* Image Preview Section (inside input box, like ChatGPT) */}
          {selectedImages.length > 0 && (
            <View className="mb-2 mt-1">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="max-h-20"
                contentContainerStyle={{
                  gap: 8,
                  paddingHorizontal: 0,
                }}
              >
                {selectedImages.map((image, index) => (
                  <View
                    key={index}
                    className="relative w-16 h-16 rounded-lg overflow-hidden bg-bg-stroke"
                  >
                    <Image
                      source={{ uri: image.uri }}
                      className="w-full h-full"
                      contentFit="cover"
                    />
                    <TouchableOpacity
                      onPress={() => handleRemoveImage(index)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full items-center justify-center z-10"
                      style={{
                        backgroundColor: colors.bg,
                        borderWidth: 1,
                        borderColor: colors.bgStroke,
                      }}
                    >
                      <Text
                        className="text-xs leading-[14px]"
                        style={{ color: colors.bodyText }}
                      >
                        ×
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input Row - All elements in a straight line */}
          {/* Align buttons to bottom when input height increases */}
          <View className={`flex-row gap-2 p-[2px] ${inputHeight > 40 ? 'items-end' : 'items-center'}`}>

            {/* Image Add Icon */}
            <TouchableOpacity
              onPress={handleImageUpload}
              disabled={selectedImages.length >= MAX_IMAGES || isStreaming}
              className="w-5 h-5 items-center justify-center"
              style={{
                opacity: (selectedImages.length >= MAX_IMAGES || isStreaming) ? 0.5 : 1,
                marginBottom: inputHeight > 40 ? 2 : 0, // Small bottom margin when aligned to bottom
              }}
            >
              <Image
                source={require('../assets/home/bot/image-add-02.svg')}
                className="w-5 h-5"
                contentFit="contain"
              />
            </TouchableOpacity>

            {/* Input Field - Dynamic height with scrolling */}
            <TextInput
              ref={inputTextRef}
              value={inputText}
              onChangeText={setInputText}
              onContentSizeChange={handleContentSizeChange}
              placeholder="Ask anything"
              placeholderTextColor={colors.bodyText}
              className="flex-1 text-sm py-0 px-0"
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 14,
                color: colors.bodyText,
                minHeight: 20,
                maxHeight: MAX_INPUT_HEIGHT,
                height: inputHeight, // Dynamic height - updates in real-time as content changes
                textAlignVertical: 'top',
                includeFontPadding: false,
                ...Platform.select({
                  ios: {
                    lineHeight: 20,
                  },
                  android: {
                    textAlignVertical: 'top',
                  },
                }),
              }}
              multiline
              maxLength={MAX_CHARACTERS}
              editable={!isStreaming}
              scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
            />

            {/* Mic Icon - Only shows when input is empty */}
            {!inputText.trim() && (
              <TouchableOpacity
                onPress={handleMicPress}
                disabled={isStreaming}
                className="w-5 h-5 items-center justify-center"
                style={{
                  opacity: isStreaming ? 0.5 : 1,
                  marginBottom: inputHeight > 40 ? 2 : 0, // Small bottom margin when aligned to bottom
                }}
              >
                {isRecording ? (
                  <View className="w-4 h-4 rounded-full bg-[#FF3B30]" />
                ) : (
                  <Image
                    source={require('../assets/home/bot/mic-02.svg')}
                    className="w-5 h-5"
                    contentFit="contain"
                  />
                )}
              </TouchableOpacity>
            )}

            {/* Send Button - Always visible */}
            {!isStreaming ? (
              <TouchableOpacity
                onPress={() => handleSend(false)}
                activeOpacity={0.8}
                disabled={!inputText.trim() && selectedImages.length === 0}
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{
                  backgroundColor: colors.primaryCTA,
                  opacity: (!inputText.trim() && selectedImages.length === 0) ? 0.5 : 1,
                  marginBottom: inputHeight > 40 ? 2 : 0, // Small bottom margin when aligned to bottom
                }}
              >
                <Image
                  source={require('../assets/home/bot/arrow-up-02.svg')}
                  className="w-5 h-5"
                  contentFit="contain"
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleStop}
                activeOpacity={0.8}
                className="w-9 h-9 rounded-lg items-center justify-center"
                style={{
                  backgroundColor: '#000000',
                  marginBottom: inputHeight > 40 ? 2 : 0, // Small bottom margin when aligned to bottom
                }}
              >
                <Image
                  source={require('../assets/home/bot/stop-button.svg')}
                  className="w-3.5 h-3.5"
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
          style={{ flex: 1, backgroundColor: colors.bg }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <StatusBar />

          {/* Header */}
          <View
            style={{
              paddingTop: top || 0,
              backgroundColor: colors.bg,
              borderBottomWidth: 0.5,
              borderBottomColor: colors.bgStroke,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 12,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-SemiBold',
                fontSize: 16,
                color: colors.titleText,
              }}
            >
              Ask Tiwi AI
            </Text>

            {/* Minimize Button (2 diagonal arrows) */}
            <TouchableOpacity
              onPress={handleCloseFullScreen}
              style={{
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Image
                source={require('../assets/home/bot/minimize-arrows.svg')}
                style={{ width: 20, height: 20 }}
                contentFit="contain"
              />
            </TouchableOpacity>
          </View>

          {/* Full-Screen Input Area */}
          <View style={{ flex: 1, padding: 20 }}>
            {/* Image Preview in Full Screen */}
            {selectedImages.length > 0 && (
              <View
                style={{
                  marginBottom: 16,
                }}
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    gap: 12,
                  }}
                >
                  {selectedImages.map((image, index) => (
                    <View
                      key={index}
                      style={{
                        position: 'relative',
                        width: 100,
                        height: 100,
                        borderRadius: 12,
                        overflow: 'hidden',
                        backgroundColor: colors.bgStroke,
                      }}
                    >
                      <Image
                        source={{ uri: image.uri }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                      />
                      <TouchableOpacity
                        onPress={() => handleRemoveImage(index)}
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: colors.bg,
                          borderWidth: 1,
                          borderColor: colors.bgStroke,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: colors.bodyText, fontSize: 14 }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Full-Screen TextInput */}
            <TextInput
              ref={fullScreenInputRef}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask anything..."
              placeholderTextColor={colors.bodyText}
              style={{
                flex: 1,
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: colors.bodyText,
                textAlignVertical: 'top',
                includeFontPadding: false,
                padding: 0,
              }}
              multiline
              maxLength={MAX_CHARACTERS}
              editable={!isStreaming}
              autoFocus
            />
          </View>

          {/* Bottom Actions Bar */}
          <View
            style={{
              borderTopWidth: 0.5,
              borderTopColor: colors.bgStroke,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: (bottom || 16) + 16,
              backgroundColor: colors.bg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            {/* Image Add Icon */}
            <TouchableOpacity
              onPress={handleImageUpload}
              disabled={selectedImages.length >= MAX_IMAGES || isStreaming}
              style={{
                width: 24,
                height: 24,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: (selectedImages.length >= MAX_IMAGES || isStreaming) ? 0.5 : 1,
              }}
            >
              <Image
                source={require('../assets/home/bot/image-add-02.svg')}
                style={{ width: 24, height: 24 }}
                contentFit="contain"
              />
            </TouchableOpacity>

            {/* Mic Icon */}
            <TouchableOpacity
              onPress={handleMicPress}
              disabled={isStreaming}
              style={{
                width: 24,
                height: 24,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isStreaming ? 0.5 : 1,
              }}
            >
              {isRecording ? (
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: '#FF3B30',
                  }}
                />
              ) : (
                <Image
                  source={require('../assets/home/bot/mic-02.svg')}
                  style={{ width: 24, height: 24 }}
                  contentFit="contain"
                />
              )}
            </TouchableOpacity>

            {/* Send Button */}
            <TouchableOpacity
              onPress={() => handleSend(true)}
              activeOpacity={0.8}
              disabled={!inputText.trim() && selectedImages.length === 0}
              style={{
                width: 40,
                height: 40,
                borderRadius: 100,
                backgroundColor: colors.primaryCTA,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: (!inputText.trim() && selectedImages.length === 0) ? 0.5 : 1,
                marginLeft: 'auto',
              }}
            >
              <Image
                source={require('../assets/home/bot/arrow-up-02.svg')}
                style={{ width: 22, height: 22 }}
                contentFit="contain"
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}
