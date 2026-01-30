/**
 * AI Service using Google GenAI SDK (new version)
 * Implements streaming responses with Gemini models
 * Based on helpful.txt migration guide
 */

import { GoogleGenAI } from '@google/genai';

// API Key will be provided via environment variable or config
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

// Initialize the AI client
let aiClient: GoogleGenAI | null = null;

/**
 * Initialize the AI client
 */
export const initializeAIClient = (apiKey: string) => {
  if (!apiKey) {
    console.warn('Gemini API key not provided');
    return;
  }
  try {
    aiClient = new GoogleGenAI({ apiKey });
  } catch (error) {
    console.error('Error initializing AI client:', error);
  }
};

/**
 * Check if AI client is initialized
 */
export const isAIClientInitialized = (): boolean => {
  return aiClient !== null;
};

/**
 * Convert image URI to base64 for inline data
 */
const imageUriToBase64 = async (uri: string): Promise<string> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data URL prefix
        const base64 = base64String.split(',')[1] || base64String;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    throw new Error('Failed to convert image to base64');
  }
};

/**
 * Stream AI response
 * @param prompt - User's text prompt
 * @param imageUri - Optional image URI (if image was uploaded)
 * @param imageMimeType - Optional image MIME type
 * @param onChunk - Callback for each chunk of response
 * @param onComplete - Callback when streaming is complete
 * @param onError - Callback for errors
 * @param abortSignal - Abort signal to cancel the request
 */
export const streamAIResponse = async (
  prompt: string,
  imageUri?: string,
  imageMimeType?: string,
  onChunk?: (chunk: string) => void,
  onComplete?: (fullText: string) => void,
  onError?: (error: Error) => void,
  abortSignal?: AbortSignal
): Promise<void> => {
  if (!aiClient) {
    const error = new Error('AI client not initialized. Please provide API key.');
    onError?.(error);
    return;
  }

  try {
    let contents: string | any[];
    
    // If image is provided, use array format with role and parts
    if (imageUri && imageMimeType) {
      try {
        const base64Image = await imageUriToBase64(imageUri);
        const parts: any[] = [{ text: prompt }];
        parts.push({
          inlineData: {
            data: base64Image,
            mimeType: imageMimeType,
          },
        });
        
        // Use array format for multimodal (text + image)
        contents = [{
          role: 'user',
          parts,
        }];
      } catch (error) {
        console.error('Error processing image:', error);
        // Fall back to text-only if image processing fails
        contents = prompt;
      }
    } else {
      // Text-only: use string format (simpler, matches helpful.txt)
      contents = prompt;
    }

    // Stream the response using new SDK format (from helpful.txt)
    // contents can be string (text-only) or array (multimodal)
    const response = await aiClient.models.generateContentStream({
      model: 'gemini-2.0-flash', // Using stable model from helpful.txt
      contents,
    });

    let fullText = '';

    // Process stream chunks
    for await (const chunk of response) {
      if (abortSignal?.aborted) {
        return;
      }

      // Extract text from chunk
      const chunkText = chunk.text || '';
      if (chunkText) {
        fullText += chunkText;
        onChunk?.(chunkText);
      }
    }

    onComplete?.(fullText);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
  }
};