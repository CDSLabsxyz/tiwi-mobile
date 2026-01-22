/**
 * Speech-to-Text Service using Google Speech-to-Text API
 * Converts audio recordings to text
 * 
 * Note: For production, you may want to use the same API key as Gemini
 * or set up a separate Google Cloud project for Speech-to-Text
 */

import { Platform } from 'react-native';

const SPEECH_TO_TEXT_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_SPEECH_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

/**
 * Convert audio file to text using Google Speech-to-Text API
 * @param audioUri - URI of the recorded audio file
 * @param languageCode - Language code (default: 'en-US')
 */
export const transcribeAudio = async (
  audioUri: string,
  languageCode: string = 'en-US'
): Promise<string> => {
  if (!SPEECH_TO_TEXT_API_KEY) {
    throw new Error('Google Speech-to-Text API key not configured. Set EXPO_PUBLIC_GOOGLE_SPEECH_API_KEY or EXPO_PUBLIC_GEMINI_API_KEY');
  }

  try {
    // For React Native, we need to read the file differently
    // Using fetch to get the file as blob
    const response = await fetch(audioUri);
    
    if (!response.ok) {
      throw new Error('Failed to read audio file');
    }

    // Convert response to blob, then to base64
    const blob = await response.blob();
    const base64Audio = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data URL prefix if present
        const base64 = base64String.includes(',') ? base64String.split(',')[1] : base64String;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Call Google Speech-to-Text API
    // Note: Audio format depends on expo-av recording format
    // expo-av typically records in m4a (iOS) or 3gp (Android)
    const apiResponse = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${SPEECH_TO_TEXT_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            encoding: Platform.OS === 'ios' ? 'LINEAR16' : 'AMR_WB', // Adjust based on platform
            sampleRateHertz: 44100, // Standard sample rate
            languageCode,
            alternativeLanguageCodes: ['en-US'],
          },
          audio: {
            content: base64Audio,
          },
        }),
      }
    );

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json().catch(() => ({}));
      throw new Error(`Speech-to-Text API error: ${apiResponse.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await apiResponse.json();
    
    if (data.results && data.results.length > 0 && data.results[0].alternatives) {
      return data.results[0].alternatives[0].transcript || '';
    }

    return '';
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
};

