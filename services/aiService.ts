/**
 * AI Service for Tiwi Mobile App
 * Primary: TIWI super-app backend (knowledge base + live data + brand scrubbing)
 * Fallback chain: OpenAI direct → Gemini → legacy backend
 */

import { api } from '@/lib/mobile/api-client';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const BACKEND_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL || 'https://tiwiprotocol-ai.vercel.app/api/chat';
const SUPERAPP_AI_URL = process.env.EXPO_PUBLIC_SUPERAPP_AI_URL || 'https://app.tiwiprotocol.xyz/api/v1/ai/chat';
const OPENAI_STREAM_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_STREAM_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

export interface AIChatContext {
  walletAddress?: string | null;
  portfolio?: {
    totalUsd: string;
    tokens: Array<{ symbol: string; balance: string; usdValue: string }>;
  };
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const SYSTEM_PROMPT = `You are TIWI AI, the intelligent assistant for TIWI Protocol — a multichain DeFi super-app.

You have access to LIVE real-time market data that is injected into the conversation. When market data is provided in a [LIVE MARKET DATA] block, use it to answer the user's question with specific numbers. Present prices, market caps, volumes, and changes clearly.

Format prices nicely:
- Under $1: show up to 6 decimal places as needed (e.g. $0.000234)
- $1-$1000: show 2 decimal places (e.g. $45.67)
- Over $1000: use commas (e.g. $67,890.12)
- Market cap/volume: use abbreviations (e.g. $1.2B, $450M, $12.3K)

You help users with:
- Real-time crypto prices, market data, and token analysis
- Crypto trading, swaps, and bridging across EVM chains, Solana, TRON, TON, and Cosmos
- Understanding DeFi concepts (staking, liquidity, yield farming)
- Wallet management and security best practices
- Troubleshooting transaction issues

Be concise, helpful, and crypto-native. Always remind users to DYOR. Never give financial advice.`;

// ─── Market Data Enrichment ──────────────────────────────────────────────────

/**
 * Detect if user is asking about token prices/market data
 * Returns extracted token symbols/names
 */
function detectMarketQuery(prompt: string): string[] {
  const lower = prompt.toLowerCase();

  // Check if it's a price/market question
  const marketKeywords = [
    'price', 'worth', 'cost', 'value', 'how much',
    'market cap', 'mcap', 'volume', 'vol',
    'ath', 'all time high', 'change', '24h',
    'trending', 'top', 'hot', 'gainers', 'losers',
    'what is', "what's", 'tell me about', 'info on',
    'current', 'today', 'now', 'live',
  ];

  const isMarketQuestion = marketKeywords.some(kw => lower.includes(kw));
  if (!isMarketQuestion) return [];

  // Extract potential token symbols/names
  // Common tokens to recognize
  const knownTokens: Record<string, string> = {
    'bitcoin': 'BTC', 'btc': 'BTC',
    'ethereum': 'ETH', 'eth': 'ETH',
    'solana': 'SOL', 'sol': 'SOL',
    'bnb': 'BNB', 'binance': 'BNB',
    'xrp': 'XRP', 'ripple': 'XRP',
    'cardano': 'ADA', 'ada': 'ADA',
    'dogecoin': 'DOGE', 'doge': 'DOGE',
    'polygon': 'POL', 'matic': 'POL', 'pol': 'POL',
    'avalanche': 'AVAX', 'avax': 'AVAX',
    'chainlink': 'LINK', 'link': 'LINK',
    'toncoin': 'TON', 'ton': 'TON',
    'tron': 'TRX', 'trx': 'TRX',
    'shiba': 'SHIB', 'shib': 'SHIB',
    'pepe': 'PEPE',
    'sui': 'SUI',
    'near': 'NEAR',
    'aptos': 'APT', 'apt': 'APT',
    'arbitrum': 'ARB', 'arb': 'ARB',
    'optimism': 'OP', 'op': 'OP',
    'cosmos': 'ATOM', 'atom': 'ATOM',
    'uniswap': 'UNI', 'uni': 'UNI',
    'aave': 'AAVE',
    'usdt': 'USDT', 'tether': 'USDT',
    'usdc': 'USDC',
    'twc': 'TWC', 'tiwicat': 'TWC', 'tiwi': 'TWC', 'tiwicat token': 'TWC',
    'litecoin': 'LTC', 'ltc': 'LTC',
    'polkadot': 'DOT', 'dot': 'DOT',
  };

  const found: string[] = [];

  // Check known tokens
  for (const [keyword, symbol] of Object.entries(knownTokens)) {
    // Word boundary match
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(lower)) {
      if (!found.includes(symbol)) found.push(symbol);
    }
  }

  // Also try to extract unknown tokens (words in ALL CAPS that look like tickers)
  const capsMatches = prompt.match(/\b[A-Z]{2,10}\b/g);
  if (capsMatches) {
    for (const match of capsMatches) {
      // Skip common English words
      const skipWords = ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'WHAT', 'HOW', 'MUCH', 'DYOR', 'AI', 'DeFi'];
      if (!skipWords.includes(match) && !found.includes(match)) {
        found.push(match);
      }
    }
  }

  // If it's a general market question with no specific token
  if (found.length === 0 && (lower.includes('trending') || lower.includes('top') || lower.includes('hot') || lower.includes('gainers') || lower.includes('losers'))) {
    found.push('__TRENDING__');
  }

  return found;
}

/**
 * Fetch live market data for detected tokens
 */
async function fetchMarketContext(tokens: string[]): Promise<string> {
  try {
    // Fetch trending/top tokens
    if (tokens.includes('__TRENDING__')) {
      const response = await api.market.list({ marketType: 'all', limit: 15 });
      const markets = response.markets || [];
      if (markets.length === 0) return '';

      let context = '[LIVE MARKET DATA — Top Trending Tokens]\n';
      markets.forEach((m: any, i: number) => {
        context += `${i + 1}. ${m.symbol}: Price $${m.price || m.priceUSD || '?'} | 24h Change: ${(m.priceChange24h || 0).toFixed(2)}% | Vol: $${formatCompact(m.volume24h || 0)} | MCap: $${formatCompact(m.marketCap || 0)}\n`;
      });
      context += '[END MARKET DATA]\n';
      return context;
    }

    // Fetch specific tokens
    const response = await api.market.list({ marketType: 'all', limit: 250 });
    const markets = response.markets || [];

    // Override display names for tokens we know
    const displayNames: Record<string, string> = {
      'TWC': 'TIWICAT',
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'SOL': 'Solana',
      'BNB': 'BNB',
      'XRP': 'XRP',
      'DOGE': 'Dogecoin',
      'ADA': 'Cardano',
      'SHIB': 'Shiba Inu',
      'PEPE': 'Pepe',
      'AVAX': 'Avalanche',
      'LINK': 'Chainlink',
      'TON': 'Toncoin',
      'TRX': 'TRON',
      'POL': 'Polygon',
      'SUI': 'Sui',
      'NEAR': 'NEAR Protocol',
      'APT': 'Aptos',
      'ARB': 'Arbitrum',
      'OP': 'Optimism',
      'ATOM': 'Cosmos',
      'DOT': 'Polkadot',
      'LTC': 'Litecoin',
      'UNI': 'Uniswap',
    };

    const results: string[] = [];

    for (const symbol of tokens) {
      // Match from market list
      const match = markets.find((m: any) =>
        m.symbol?.toUpperCase() === symbol ||
        m.symbol?.toUpperCase().startsWith(symbol + '/') ||
        m.symbol?.toUpperCase().startsWith(symbol + '-')
      );

      if (match) {
        const name = displayNames[symbol] || match.name || symbol;
        results.push(
          `${symbol}:\n` +
          `  Name: ${name}\n` +
          `  Price: $${match.price || match.priceUSD || '?'}\n` +
          `  24h Change: ${(match.priceChange24h || 0).toFixed(2)}%\n` +
          `  24h Volume: $${formatCompact(match.volume24h || 0)}\n` +
          `  Market Cap: $${formatCompact(match.marketCap || 0)}\n` +
          (match.rank ? `  Rank: #${match.rank}\n` : '')
        );
      } else {
        // Try search API for lesser-known tokens
        try {
          const searchRes = await api.tokens.list({ query: symbol, limit: 1 });
          const token = searchRes.tokens?.[0];
          if (token) {
            const name = displayNames[symbol] || token.name;
            results.push(
              `${symbol}:\n` +
              `  Name: ${name}\n` +
              `  Price: $${token.priceUSD || '?'}\n` +
              `  24h Change: ${(token.priceChange24h || 0).toFixed(2)}%\n` +
              `  Chain: ${token.chainName || `Chain ${token.chainId}`}\n` +
              `  Address: ${token.address}\n`
            );
          } else {
            results.push(`${symbol}: No data found. This token may not be listed yet.\n`);
          }
        } catch {
          results.push(`${symbol}: Unable to fetch data.\n`);
        }
      }
    }

    if (results.length === 0) return '';

    return `[LIVE MARKET DATA — fetched just now]\n${results.join('\n')}[END MARKET DATA]\n`;
  } catch (err) {
    console.warn('[AIService] Market data fetch failed:', err);
    return '';
  }
}

function formatCompact(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

// ─── Image helpers ───────────────────────────────────────────────────────────

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

// ─── Main streaming API ──────────────────────────────────────────────────────

/**
 * Stream AI response.
 *
 * Strategy order:
 *  1. TIWI super-app backend — has the knowledge base, live market data,
 *     site scraping, portfolio injection, and brand scrubbing
 *  2. OpenAI direct — client-side fallback if backend unreachable
 *  3. Gemini — secondary fallback
 *  4. Legacy backend — last resort
 */
export const streamAIResponse = async (
  prompt: string,
  imageUri?: string,
  imageMimeType?: string,
  onChunk?: (chunk: string) => void,
  onComplete?: (fullText: string) => void,
  onError?: (error: Error) => void,
  abortSignal?: AbortSignal,
  context?: AIChatContext,
): Promise<void> => {
  // 1. Super-app backend (primary) — handles enrichment server-side
  try {
    await streamFromSuperApp(prompt, imageUri, imageMimeType, onChunk, onComplete, abortSignal, context);
    return;
  } catch (e: any) {
    if (abortSignal?.aborted) return;
    console.warn('[AIService] Super-app backend failed, falling back to OpenAI:', e?.message);
  }

  // Fallbacks need client-side market enrichment since they hit raw model APIs
  let enrichedPrompt = prompt;
  const detectedTokens = detectMarketQuery(prompt);
  if (detectedTokens.length > 0) {
    const marketContext = await fetchMarketContext(detectedTokens);
    if (marketContext) {
      enrichedPrompt = `${marketContext}\nUser question: ${prompt}`;
    }
  }

  // 2. OpenAI direct
  if (OPENAI_API_KEY) {
    try {
      await streamFromOpenAI(enrichedPrompt, imageUri, imageMimeType, onChunk, onComplete, onError, abortSignal);
      return;
    } catch (e: any) {
      console.warn('[AIService] OpenAI failed, trying Gemini:', e.message);
    }
  }

  // 3. Gemini
  if (GEMINI_API_KEY) {
    try {
      await streamFromGemini(enrichedPrompt, imageUri, imageMimeType, onChunk, onComplete, onError, abortSignal);
      return;
    } catch (e: any) {
      console.warn('[AIService] Gemini failed, trying legacy backend:', e.message);
    }
  }

  // 4. Legacy backend
  try {
    await streamFromBackend(prompt, imageUri, imageMimeType, onChunk, onComplete, onError, abortSignal);
  } catch {
    onError?.(new Error('AI service is temporarily unavailable. Please try again.'));
  }
};

// ─── Super-app backend (primary) ─────────────────────────────────────────────

/**
 * Convert image URI to a `data:` URL the super-app endpoint expects.
 */
async function imageUriToDataUrl(uri: string, mimeType?: string): Promise<string> {
  const base64 = await imageUriToBase64(uri);
  return `data:${mimeType || 'image/jpeg'};base64,${base64}`;
}

/**
 * Drip the full reply into onChunk so the UI's streaming animation still
 * works even though the backend returns a single JSON response.
 */
async function fakeStream(
  text: string,
  onChunk: ((chunk: string) => void) | undefined,
  abortSignal?: AbortSignal,
): Promise<void> {
  if (!onChunk || !text) return;
  const chunkSize = 6;
  const intervalMs = 12;
  for (let i = 0; i < text.length; i += chunkSize) {
    if (abortSignal?.aborted) return;
    onChunk(text.slice(i, i + chunkSize));
    if (i + chunkSize < text.length) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}

async function streamFromSuperApp(
  prompt: string,
  imageUri: string | undefined,
  imageMimeType: string | undefined,
  onChunk: ((chunk: string) => void) | undefined,
  onComplete: ((fullText: string) => void) | undefined,
  abortSignal: AbortSignal | undefined,
  context: AIChatContext | undefined,
): Promise<void> {
  const images: string[] = [];
  if (imageUri) {
    images.push(await imageUriToDataUrl(imageUri, imageMimeType));
  }

  const body: Record<string, unknown> = { message: prompt };
  if (context?.walletAddress) body.walletAddress = context.walletAddress;
  if (context?.portfolio) body.portfolio = context.portfolio;
  if (context?.history?.length) body.history = context.history.slice(-8);
  if (images.length) body.images = images;

  const response = await fetch(SUPERAPP_AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: abortSignal,
  });

  if (!response.ok) {
    throw new Error(`Super-app AI returned ${response.status}`);
  }

  const json = await response.json();
  const reply: string = json?.reply || '';
  if (!reply) throw new Error('Empty reply from super-app AI');

  await fakeStream(reply, onChunk, abortSignal);
  onComplete?.(reply);
}

// ─── OpenAI streaming ────────────────────────────────────────────────────────

async function streamFromOpenAI(
  prompt: string,
  imageUri?: string,
  imageMimeType?: string,
  onChunk?: (chunk: string) => void,
  onComplete?: (fullText: string) => void,
  onError?: (error: Error) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  if (!OPENAI_API_KEY) throw new Error('No OpenAI API key');

  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  if (imageUri) {
    const imageBase64 = await imageUriToBase64(imageUri);
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        {
          type: 'image_url',
          image_url: {
            url: `data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}`,
          },
        },
      ],
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const body = JSON.stringify({
    model: 'gpt-4o-mini',
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 2048,
  });

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', OPENAI_STREAM_URL);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${OPENAI_API_KEY}`);

    let lastIndex = 0;
    let fullText = '';

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 3 || xhr.readyState === 4) {
        const responseText = xhr.responseText;
        const newText = responseText.substring(lastIndex);
        lastIndex = responseText.length;

        const lines = newText.split('\n');
        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          const jsonStr = line.replace('data: ', '').trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            const text = data?.choices?.[0]?.delta?.content;
            if (text) {
              fullText += text;
              onChunk?.(text);
            }
          } catch {}
        }
      }

      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          onComplete?.(fullText);
          resolve();
        } else {
          reject(new Error(`OpenAI returned status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network request failed'));
    if (abortSignal) abortSignal.addEventListener('abort', () => xhr.abort());
    xhr.send(body);
  });
}

// ─── Gemini streaming ────────────────────────────────────────────────────────

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

  const parts: any[] = [{ text: prompt }];
  if (imageBase64) {
    parts.unshift({
      inlineData: { mimeType: imageMimeType || 'image/jpeg', data: imageBase64 },
    });
  }

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
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
          } catch {}
        }
      }

      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          onComplete?.(fullText);
          resolve();
        } else {
          reject(new Error(`Gemini returned status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network request failed'));
    if (abortSignal) abortSignal.addEventListener('abort', () => xhr.abort());
    xhr.send(body);
  });
}

// ─── Backend fallback ────────────────────────────────────────────────────────

async function streamFromBackend(
  prompt: string,
  imageUri?: string,
  _imageMimeType?: string,
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
          } catch {}
        }
      }

      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          onComplete?.(fullText);
          resolve();
        } else {
          reject(new Error(`Backend returned status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network request failed'));
    if (abortSignal) abortSignal.addEventListener('abort', () => xhr.abort());
    xhr.send(body);
  });
}

export const initializeAIClient = (_apiKey: string) => {};
export const isAIClientInitialized = (): boolean => true;
