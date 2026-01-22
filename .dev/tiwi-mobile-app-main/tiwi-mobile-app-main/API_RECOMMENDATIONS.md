# API Recommendations for Spot and Perpetual Trading Data

This document provides recommendations for API endpoints to fetch real-time spot and perpetual trading data for the TIWI Protocol market page.

## 1. Spot Trading APIs

### CoinGecko API (Recommended for General Market Data)
- **Base URL**: `https://api.coingecko.com/api/v3`
- **Documentation**: https://www.coingecko.com/en/api
- **Endpoints**:
  - Get all coins: `GET /coins/markets?vs_currency=usdt&order=volume_desc`
  - Get coin price: `GET /simple/price?ids=bitcoin,ethereum&vs_currencies=usdt`
  - Get 24h ticker: `GET /coins/{id}/ticker`
- **Pros**: Free tier available, comprehensive data, good documentation
- **Cons**: Rate limits on free tier, may not have all tokens
- **Pricing**: Free tier: 10-50 calls/minute

### Binance API (Recommended for Spot Trading)
- **Base URL**: `https://api.binance.com/api/v3`
- **Documentation**: https://binance-docs.github.io/apidocs/spot/en/
- **Endpoints**:
  - 24hr ticker: `GET /api/v3/ticker/24hr`
  - Exchange info: `GET /api/v3/exchangeInfo`
  - Order book: `GET /api/v3/depth?symbol=BTCUSDT`
- **Pros**: Real-time data, high liquidity pairs, WebSocket support
- **Cons**: Requires API key for some endpoints
- **Pricing**: Free with API key

### DEX Aggregators

#### 1inch API
- **Base URL**: `https://api.1inch.io/v5.0/{chainId}`
- **Documentation**: https://docs.1inch.io/
- **Endpoints**:
  - Get tokens: `GET /tokens`
  - Get quote: `GET /quote?fromTokenAddress={}&toTokenAddress={}&amount={}`
- **Pros**: Aggregates multiple DEXs, best prices
- **Cons**: More complex integration

#### 0x Protocol API
- **Base URL**: `https://api.0x.org/swap/v1`
- **Documentation**: https://0x.org/docs/api
- **Endpoints**:
  - Get tokens: `GET /tokens`
  - Get quote: `GET /quote?buyToken={}&sellToken={}&sellAmount={}`
- **Pros**: Multi-chain support, good documentation
- **Cons**: Rate limits

#### Paraswap API
- **Base URL**: `https://apiv5.paraswap.io`
- **Documentation**: https://developers.paraswap.network/
- **Endpoints**:
  - Get tokens: `GET /tokens/{chainId}`
  - Get price: `GET /prices/?srcToken={}&destToken={}&amount={}`
- **Pros**: Aggregates 20+ DEXs, competitive rates
- **Cons**: Requires API key for production

## 2. Perpetual Trading APIs

### Bybit API (Recommended for Perpetuals)
- **Base URL**: `https://api.bybit.com`
- **Documentation**: https://bybit-exchange.github.io/docs/v5/intro
- **Endpoints**:
  - Get tickers: `GET /v5/market/tickers?category=linear`
  - Get instruments: `GET /v5/market/instruments-info?category=linear`
  - Get kline: `GET /v5/market/kline?category=linear&symbol=BTCUSDT`
- **Pros**: Excellent perpetuals data, WebSocket support, free tier
- **Cons**: Rate limits
- **Pricing**: Free with API key

### Binance Futures API
- **Base URL**: `https://fapi.binance.com`
- **Documentation**: https://binance-docs.github.io/apidocs/futures/en/
- **Endpoints**:
  - 24hr ticker: `GET /fapi/v1/ticker/24hr`
  - Exchange info: `GET /fapi/v1/exchangeInfo`
  - Mark price: `GET /fapi/v1/premiumIndex`
- **Pros**: High liquidity, real-time data
- **Cons**: Requires API key
- **Pricing**: Free with API key

### dYdX API (Decentralized Perpetuals)
- **Base URL**: `https://api.dydx.exchange`
- **Documentation**: https://docs.dydx.exchange/
- **Endpoints**:
  - Get markets: `GET /v3/markets`
  - Get ticker: `GET /v3/tickers/{market}`
  - Get orderbook: `GET /v3/orderbooks/{market}`
- **Pros**: Decentralized, no KYC required
- **Cons**: Limited markets, smaller liquidity
- **Pricing**: Free

### GMX API (Decentralized Perpetuals)
- **Base URL**: `https://gmx-server-mainnet.uw.app`
- **Documentation**: https://gmxio.gitbook.io/gmx/
- **Endpoints**:
  - Get prices: `GET /prices`
  - Get positions: `GET /positions`
- **Pros**: Decentralized, high leverage
- **Cons**: Limited documentation
- **Pricing**: Free

## 3. Recommended Implementation Strategy

### For Spot Trading:
1. **Primary**: Use **Binance API** for major pairs (BTC, ETH, etc.)
2. **Secondary**: Use **CoinGecko API** for comprehensive market data and smaller tokens
3. **DEX Integration**: Use **1inch** or **0x Protocol** for DEX aggregation

### For Perpetual Trading:
1. **Primary**: Use **Bybit API** for comprehensive perpetuals data
2. **Secondary**: Use **Binance Futures API** for high-liquidity pairs
3. **Decentralized**: Integrate **dYdX** or **GMX** for decentralized perpetuals

## 4. WebSocket Recommendations

For real-time updates, consider WebSocket connections:

- **Binance WebSocket**: `wss://stream.binance.com:9443/ws/btcusdt@ticker`
- **Bybit WebSocket**: `wss://stream.bybit.com/v5/public/linear`
- **CoinGecko WebSocket**: Limited support, consider polling

## 5. Implementation Example

```typescript
// Example service structure
interface MarketAPIService {
  // Spot Trading
  getSpotTickers(): Promise<SpotTicker[]>;
  getSpotOrderBook(symbol: string): Promise<OrderBook>;
  
  // Perpetual Trading
  getPerpTickers(): Promise<PerpTicker[]>;
  getPerpOrderBook(symbol: string): Promise<OrderBook>;
  
  // WebSocket
  subscribeToTicker(symbol: string, callback: (data: Ticker) => void): void;
}

// Recommended implementation
class BinanceMarketService implements MarketAPIService {
  private baseURL = 'https://api.binance.com/api/v3';
  
  async getSpotTickers(): Promise<SpotTicker[]> {
    const response = await fetch(`${this.baseURL}/ticker/24hr`);
    return response.json();
  }
  
  // ... implement other methods
}
```

## 6. Rate Limiting Considerations

- **Binance**: 1200 requests per minute (weighted)
- **Bybit**: 120 requests per minute
- **CoinGecko**: 10-50 calls per minute (free tier)
- **1inch**: 300 requests per minute

**Recommendation**: Implement caching and request batching to minimize API calls.

## 7. Data Structure Recommendations

```typescript
interface MarketTicker {
  symbol: string; // e.g., "BTCUSDT"
  price: string;
  priceChange: number; // percentage
  volume24h: string;
  high24h: string;
  low24h: string;
  lastPrice: string;
  leverage?: number; // for perpetuals
  fundingRate?: number; // for perpetuals
}
```

## 8. Next Steps

1. **Choose Primary APIs**: Start with Binance (spot) and Bybit (perp)
2. **Set Up API Keys**: Register for API keys where required
3. **Implement Service Layer**: Create abstraction layer for API calls
4. **Add Caching**: Implement Redis or in-memory caching
5. **WebSocket Integration**: Add real-time updates for selected pairs
6. **Error Handling**: Implement retry logic and fallback APIs
7. **Rate Limiting**: Implement request throttling

## 9. Additional Resources

- **Binance API Docs**: https://binance-docs.github.io/apidocs/spot/en/
- **Bybit API Docs**: https://bybit-exchange.github.io/docs/v5/intro
- **CoinGecko API Docs**: https://www.coingecko.com/en/api/documentation
- **1inch Docs**: https://docs.1inch.io/
- **0x Protocol Docs**: https://0x.org/docs/api





