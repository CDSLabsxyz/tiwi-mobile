import Foundation

// MARK: - API Client Configuration

public enum TiwiApiError: Error, LocalizedError {
    case invalidURL
    case networkError(Error)
    case invalidResponse(Int)
    case decodedError(String)
    
    public var errorDescription: String? {
        switch self {
        case .invalidURL: return "The API endpoint URL is invalid."
        case .networkError(let error): return error.localizedDescription
        case .invalidResponse(let code): return "The server returned an invalid HTTP response (\(code))."
        case .decodedError(let message): return message
        }
    }
}

/// A fully typed API client for TIWI Protocol Next.js backend, built for Xcode / iOS Apps (Swift 5.5+).
public class TiwiApiClient {
    /// Singleton instance for easy access
    public static let shared = TiwiApiClient()
    
    /// Default Base URL (Production)
    public var baseURL: String = "https://app.tiwiprotocol.xyz"
    
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    // MARK: - Core Networking Logic

    // Fetch with Body (POST/PATCH)
    private func fetch<T: Decodable, U: Encodable>(path: String, method: String = "GET", queryItems: [URLQueryItem]? = nil, body: U? = nil) async throws -> T {
        var components = URLComponents(string: baseURL + path)
        if let queryItems = queryItems, !queryItems.isEmpty {
            components?.queryItems = queryItems
        }

        guard let url = components?.url else {
            throw TiwiApiError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")

        if let body = body {
            let encoder = JSONEncoder()
            // Some endpoints might use snake_case, but JS generally uses camelCase.
            // Adjust keyEncodingStrategy if needed: encoder.keyEncodingStrategy = .convertToSnakeCase
            request.httpBody = try? encoder.encode(body)
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw TiwiApiError.invalidResponse(0)
        }

        // Handle success
        if (200...299).contains(httpResponse.statusCode) {
            let decoder = JSONDecoder()
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                print("🚨 JSON Decoding Error: \(error)")
                throw TiwiApiError.networkError(error)
            }
        } else {
            // Map server error formats
            if let errorData = try? JSONDecoder().decode(TiwiErrorResponse.self, from: data) {
                throw TiwiApiError.decodedError(errorData.error)
            }
            throw TiwiApiError.invalidResponse(httpResponse.statusCode)
        }
    }

    // Fetch without Body (GET)
    private func fetch<T: Decodable>(path: String, method: String = "GET", queryItems: [URLQueryItem]? = nil) async throws -> T {
        return try await fetch(path: path, method: method, queryItems: queryItems, body: String?.none)
    }

    // MARK: - Endpoints

    /// Fetch tokens (Search, Trending, Categories)
    public func getTokens(category: String? = nil, limit: Int = 60, chains: [Int]? = nil, query: String? = nil) async throws -> TokensResponse {
        var items = [
            URLQueryItem(name: "limit", value: String(limit))
        ]
        if let category = category { items.append(URLQueryItem(name: "category", value: category)) }
        if let query = query { items.append(URLQueryItem(name: "query", value: query)) }
        if let chains = chains, !chains.isEmpty {
            let chainsStr = chains.map { String($0) }.joined(separator: ",")
            items.append(URLQueryItem(name: "chains", value: chainsStr))
        }
        return try await fetch(path: "/api/v1/tokens", queryItems: items)
    }

    /// Fetch unified market assets (Spot, Perp)
    public func getMarketList(marketType: String = "all", limit: Int = 100) async throws -> MarketListResponse {
        let items = [
            URLQueryItem(name: "marketType", value: marketType),
            URLQueryItem(name: "limit", value: String(limit))
        ]
        return try await fetch(path: "/api/v1/market/list", queryItems: items)
    }

    /// Fetch rich token information (Socials, Liquidity Pools)
    public func getTokenInfo(chainId: Int, address: String) async throws -> TokenInfoResponse {
        return try await fetch(path: "/api/v1/token-info/\(chainId)/\(address)")
    }

    /// Fetch a wallet's balances across multiple chains
    public func getWalletBalances(address: String, chains: [Int]? = nil) async throws -> WalletBalanceResponse {
        var items = [URLQueryItem(name: "address", value: address)]
        if let chains = chains, !chains.isEmpty {
            let chainsStr = chains.map { String($0) }.joined(separator: ",")
            items.append(URLQueryItem(name: "chains", value: chainsStr))
        }
        return try await fetch(path: "/api/v1/wallet/balances", queryItems: items)
    }

    /// Get cross-chain swap routing
    public func requestSwapRoute(payload: RouteRequestPayload) async throws -> RouteResponsePayload {
        return try await fetch(path: "/api/v1/route", method: "POST", body: payload)
    }
    
    /// Get staking pools
    public func getStakingPools(status: String? = "active") async throws -> StakingPoolsResponse {
        var items = [URLQueryItem]()
        if let status = status { items.append(URLQueryItem(name: "status", value: status)) }
        return try await fetch(path: "/api/v1/staking-pools", queryItems: items)
    }
    
    /// Scan token security
    public func scanTokenSecurity(chainId: Int, address: String) async throws -> TokenSecurityResponse {
        return try await fetch(path: "/api/v1/token/security/\(chainId)/\(address)")
    }
    
    /// Fetch app notifications
    public func getNotifications(userWallet: String? = nil) async throws -> NotificationsResponse {
        var items = [URLQueryItem]()
        if let w = userWallet { items.append(URLQueryItem(name: "userWallet", value: w)) }
        return try await fetch(path: "/api/v1/notifications", queryItems: items)
    }
}

// MARK: - Data Models

public struct TiwiErrorResponse: Codable {
    public let error: String
}

// MARK: Tokens
public struct TokenItem: Codable, Identifiable {
    public let id: String
    public let symbol: String
    public let name: String
    public let address: String
    public let chainId: Int
    public let chainName: String?
    public let logoURI: String?
    public let decimals: Int?
    public let priceUSD: String?
    public let priceChange24h: Double?
    public let volume24h: Double?
    public let marketCap: Double?
    public let marketCapRank: Int?
    public let circulatingSupply: Double?
    public let totalSupply: Double?
}

public struct TokensResponse: Codable {
    public let tokens: [TokenItem]
    public let total: Int
    public let chainIds: [Int]?
    public let query: String?
    public let limit: Int
}

// MARK: Market
public struct MarketAsset: Codable, Identifiable {
    public let id: String
    public let symbol: String
    public let name: String
    public let address: String
    public let chainId: Int
    public let price: String?
    public let priceChange24h: Double?
    public let marketCap: Double?
    public let rank: Int?
    public let volume24h: Double?
    public let marketType: String
    public let provider: String
    public let logo: String?
    public let logoURI: String?
    public let hasSpot: Bool
    public let hasPerp: Bool
    public let verified: Bool
}

public struct MarketListResponse: Codable {
    public let success: Bool
    public let count: Int
    public let markets: [MarketAsset]
}

// MARK: Token Info
public struct TokenInfoResponse: Codable {
    public struct TokenDetails: Codable {
        public let address: String
        public let name: String
        public let symbol: String
        public let decimals: Int
        public let logo: String?
        public let description: String?
        public let website: String?
        public let twitter: String?
        public let telegram: String?
    }
    public struct PoolDetails: Codable {
        public let address: String
        public let name: String
        public let dex: String
        public let liquidity: Double
        public let volume24h: Double
        public let priceUsd: Double
        public let priceChange24h: Double
        public let marketCap: Double
    }
    public struct TransactionDetail: Codable {
        public let type: String
        public let priceUsd: Double
        public let amount: Double
        public let valueUsd: Double
        public let maker: String
        public let txHash: String
        public let timestamp: String
    }
    
    public let token: TokenDetails
    public let pool: PoolDetails?
    public let transactions: [TransactionDetail]?
    public let score: Int?
    public let chainId: Int?
}

// MARK: Wallet Balances
public struct WalletBalance: Codable {
    public let token: TokenItem
    public let balance: String
    public let usdValue: String
}

public struct WalletBalanceResponse: Codable {
    public let address: String
    public let balances: [WalletBalance]
    public let totalUSD: String
    public let chains: [Int]?
}

// MARK: Swap Routes
public struct RouteRequestPayload: Codable {
    public struct RouteToken: Codable {
        public let chainId: Int
        public let address: String
        public let symbol: String?
        public let decimals: Int?
        
        public init(chainId: Int, address: String, symbol: String? = nil, decimals: Int? = nil) {
            self.chainId = chainId
            self.address = address
            self.symbol = symbol
            self.decimals = decimals
        }
    }
    
    public let fromToken: RouteToken
    public let toToken: RouteToken
    public let fromAmount: String?
    public let toAmount: String?
    public let slippage: Double?
    public let order: String? // "RECOMMENDED", "FASTEST", "CHEAPEST"
    
    public init(fromToken: RouteToken, toToken: RouteToken, fromAmount: String? = nil, toAmount: String? = nil, slippage: Double? = nil, order: String? = nil) {
        self.fromToken = fromToken
        self.toToken = toToken
        self.fromAmount = fromAmount
        self.toAmount = toAmount
        self.slippage = slippage
        self.order = order
    }
}

public struct RouteResponsePayload: Codable {
    public struct RouteData: Codable {
        public let router: String?
        public let fromAmount: String?
        public let toAmount: String?
        // Note: Omitted massive payload elements like 'steps' and 'transactionRequest' for brevity.
        // A full integration should declare custom models matching the preferred router.
    }
    public let route: RouteData?
    public let error: String?
}

// MARK: Staking
public struct StakingPool: Codable, Identifiable {
    public let id: String
    public let chainId: Int
    public let chainName: String
    public let tokenAddress: String
    public let tokenSymbol: String?
    public let apy: Double?
    public let minStakeAmount: Double
    public let status: String
}

public struct StakingPoolsResponse: Codable {
    public let pools: [StakingPool]
    public let total: Int
}

// MARK: Security
public struct TokenSecurityResponse: Codable {
    public let chainId: Int
    public let address: String
    public let verdict: String
    public let score: Int
}

// MARK: Notifications
public struct AppNotification: Codable, Identifiable {
    public let id: String
    public let title: String
    public let messageBody: String
    public let status: String
    public let targetAudience: String
    public let priority: String
    public let createdAt: String
}

public struct NotificationsResponse: Codable {
    public let notifications: [AppNotification]
    public let total: Int
    public let unreadCount: Int?
}
