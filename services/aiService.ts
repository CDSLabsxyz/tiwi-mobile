/**
 * AI Service for Tiwi Mobile App
 * Uses Gemini API directly for reliable AI responses
 * Falls back to Tiwi backend if needed
 */

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const BACKEND_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL || 'https://tiwiprotocol-ai.vercel.app/api/chat';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_STREAM_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are TIWI AI, the intelligent assistant for TIWI Protocol — a multichain DeFi super-app. You help users with:
- Crypto trading, swaps, and bridging across EVM chains, Solana, TRON, TON, and Cosmos
- Understanding DeFi concepts (staking, liquidity, yield farming)
- Token analysis and market insights
- Wallet management and security best practices
- Troubleshooting transaction issues

Be concise, helpful, and crypto-native. Use simple language. When discussing prices or tokens, remind users to DYOR (Do Your Own Research). Never give financial advice — provide education and information only.`;

/**
 * Helper: Convert URI to Base64
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
 * Stream AI response using Gemini API directly with SSE streaming
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
  // Try Gemini direct first, fall back to backend
  try {
    await streamFromGemini(prompt, imageUri, imageMimeType, onChunk, onComplete, onError, abortSignal);
  } catch (primaryError: any) {
    console.warn('[AIService] Gemini direct failed, trying backend:', primaryError.message);
    try {
      await streamFromBackend(prompt, imageUri, imageMimeType, onChunk, onComplete, onError, abortSignal);
    } catch (fallbackError: any) {
      console.error('[AIService] Both AI sources failed');
      onError?.(new Error('AI service is temporarily unavailable. Please try again.'));
    }
  }
};

/**
 * Stream from Gemini API directly
 */
async function streamFromGemini(
  prompt: string,
  imageUri?: string,
  imageMimeType?: string,
  onChunk?: (chunk: string) => void,
  onComplete?: (fullText: string) => void,
  onError?: (error: Error) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  if (!GEMINI_API_KEY) throw new Error('No Gemini API key');

  let imageBase64: string | undefined;
  if (imageUri) {
    imageBase64 = await imageUriToBase64(imageUri);
  }

  // Build request parts
  const parts: any[] = [{ text: prompt }];
  if (imageBase64) {
    parts.unshift({
      inlineData: {
        mimeType: imageMimeType || 'image/jpeg',
        data: imageBase64,
      }
    });
  }

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  });

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', GEMINI_STREAM_URL);
    xhr.setRequestHeader('Content-Type', 'application/json');

    let lastIndex = 0;
    let fullText = '';

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 3 || xhr.readyState === 4) {
        const responseText = xhr.responseText;
        const newText = responseText.substring(lastIndex);
        lastIndex = responseText.length;

        // Parse SSE lines from Gemini
        const lines = newText.split('\n');
        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          const jsonStr = line.replace('data: ', '').trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              fullText += text;
              onChunk?.(text);
            }
          } catch {
            // Incomplete JSON chunk, skip
          }
        }
      }

      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          onComplete?.(fullText);
          resolve();
        } else {
          const error = new Error(`Gemini returned status ${xhr.status}`);
          onError?.(error);
          reject(error);
        }
      }
    };

    xhr.onerror = () => {
      const error = new Error('Network request failed');
      reject(error);
    };

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => xhr.abort());
    }

    xhr.send(body);
  });
}

/**
 * Fallback: Stream from Tiwi backend
 */
async function streamFromBackend(
  prompt: string,
  imageUri?: string,
  imageMimeType?: string,
  onChunk?: (chunk: string) => void,
  onComplete?: (fullText: string) => void,
  onError?: (error: Error) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  let imageBase64: string | undefined;
  if (imageUri) {
    imageBase64 = await imageUriToBase64(imageUri);
  }

  const body = JSON.stringify({
    message: prompt,
    imageBase64,
    threadId: 'mobile_user_session',
  });

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', BACKEND_URL);
    xhr.setRequestHeader('Content-Type', 'application/json');

    let lastIndex = 0;
    let fullText = '';

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 3 || xhr.readyState === 4) {
        const responseText = xhr.responseText;
        const newText = responseText.substring(lastIndex);
        lastIndex = responseText.length;

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
          } catch {
            // Incomplete JSON
          }
        }
      }

      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          onComplete?.(fullText);
          resolve();
        } else {
          const error = new Error(`Backend returned status ${xhr.status}`);
          onError?.(error);
          reject(error);
        }
      }
    };

    xhr.onerror = () => {
      const error = new Error('Network request failed');
      reject(error);
    };

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => xhr.abort());
    }

    xhr.send(body);
  });
}

export const initializeAIClient = (apiKey: string) => {};
export const isAIClientInitialized = (): boolean => true;
