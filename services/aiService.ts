/**
 * AI Service for Tiwi Mobile App
 * Optimized for React Native / Expo to handle streaming correctly
 */

const BACKEND_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL || 'http://localhost:3000/api/chat';

/**
 * Helper: Convert URI to Base64 (Standard for image uploads)
 */
const imageUriToBase64 = async (uri: string): Promise<string> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64 = base64String.split(',')[1] || base64String;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Base64 Error:', error);
    throw new Error('Failed to process image');
  }
};

/**
 * Stream AI response from the backend using XMLHttpRequest 
 * (Standard fetch streams are not supported in React Native/Hermes)
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
  try {
    let imageBase64 = undefined;
    if (imageUri) {
      imageBase64 = await imageUriToBase64(imageUri);
    }

    const body = JSON.stringify({
      message: prompt,
      imageBase64,
      threadId: 'mobile_user_session',
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', BACKEND_URL);
    xhr.setRequestHeader('Content-Type', 'application/json');

    let lastIndex = 0;
    let fullText = '';

    xhr.onreadystatechange = () => {
      // 3 means "LOADING" (partial data received)
      if (xhr.readyState === 3 || xhr.readyState === 4) {
        const responseText = xhr.responseText;
        const newText = responseText.substring(lastIndex);
        lastIndex = responseText.length;

        // Process the new chunks
        const lines = newText.split('\n\n');
        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          
          const jsonStr = line.replace('data: ', '').trim();
          try {
            const data = JSON.parse(jsonStr);
            if (data.token) {
              fullText += data.token;
              onChunk?.(data.token);
            }
            if (data.done) {
              // Completion signal inside the data
            }
          } catch (e) {
            // Incomplete JSON or other data
          }
        }
      }

      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          onComplete?.(fullText);
        } else {
          onError?.(new Error(`Server returned status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      onError?.(new Error('Network request failed'));
    };

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => xhr.abort());
    }

    xhr.send(body);

  } catch (error: any) {
    console.error('AI Service Error:', error);
    onError?.(error);
  }
};

export const initializeAIClient = (apiKey: string) => {};
export const isAIClientInitialized = (): boolean => true;
