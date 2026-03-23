package com.tiwiprotocol.api

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*
import com.google.gson.annotations.SerializedName

// MARK: - Data Models

// Tokens
data class TokensResponse(
    val tokens: List<TokenItem>,
    val total: Int,
    val chainIds: List<Int>?,
    val query: String?,
    val limit: Int
)

data class TokenItem(
    val id: String,
    val symbol: String,
    val name: String,
    val address: String,
    val chainId: Int,
    val chainName: String?,
    val logoURI: String?,
    val decimals: Int?,
    val priceUSD: String?,
    val priceChange24h: Double?,
    val volume24h: Double?,
    val marketCap: Double?,
    val marketCapRank: Int?,
    val circulatingSupply: Double?,
    val totalSupply: Double?
)

// Market
data class MarketListResponse(
    val success: Boolean,
    val count: Int,
    val markets: List<MarketAsset>
)

data class MarketAsset(
    val id: String,
    val symbol: String,
    val name: String,
    val address: String,
    val chainId: Int,
    val price: String?,
    val priceChange24h: Double?,
    val marketCap: Double?,
    val rank: Int?,
    val volume24h: Double?,
    val marketType: String,
    val provider: String,
    val logo: String?,
    val logoURI: String?,
    val hasSpot: Boolean,
    val hasPerp: Boolean,
    val verified: Boolean
)

// Token Info
data class TokenInfoResponse(
    val token: TokenDetails,
    val pool: PoolDetails?,
    val transactions: List<TransactionDetail>?,
    val score: Int?,
    val chainId: Int?
)

data class TokenDetails(
    val address: String,
    val name: String,
    val symbol: String,
    val decimals: Int,
    val logo: String?,
    val description: String?,
    val website: String?,
    val twitter: String?,
    val telegram: String?
)

data class PoolDetails(
    val address: String,
    val name: String,
    val dex: String,
    val liquidity: Double,
    val volume24h: Double,
    val priceUsd: Double,
    val priceChange24h: Double,
    val marketCap: Double
)

data class TransactionDetail(
    val type: String,
    val priceUsd: Double,
    val amount: Double,
    val valueUsd: Double,
    val maker: String,
    val txHash: String,
    val timestamp: String
)

// Wallet Balances
data class WalletBalanceResponse(
    val address: String,
    val balances: List<WalletBalance>,
    val totalUSD: String,
    val chains: List<Int>?
)

data class WalletBalance(
    val token: TokenItem,
    val balance: String,
    val usdValue: String
)

// Swap Routes
data class RouteRequestPayload(
    val fromToken: RouteToken,
    val toToken: RouteToken,
    val fromAmount: String? = null,
    val toAmount: String? = null,
    val slippage: Double? = null,
    val order: String? = null // "RECOMMENDED", "FASTEST", "CHEAPEST"
)

data class RouteToken(
    val chainId: Int,
    val address: String,
    val symbol: String? = null,
    val decimals: Int? = null
)

data class RouteResponsePayload(
    val route: RouteData?,
    val error: String?
)

data class RouteData(
    val router: String?,
    val fromAmount: String?,
    val toAmount: String?
)

// Staking
data class StakingPoolsResponse(
    val pools: List<StakingPool>,
    val total: Int
)

data class StakingPool(
    val id: String,
    val chainId: Int,
    val chainName: String,
    val tokenAddress: String,
    val tokenSymbol: String?,
    val apy: Double?,
    val minStakeAmount: Double,
    val status: String
)

// Security
data class TokenSecurityResponse(
    val chainId: Int,
    val address: String,
    val verdict: String,
    val score: Int
)

// Notifications
data class NotificationsResponse(
    val notifications: List<AppNotification>,
    val total: Int,
    val unreadCount: Int?
)

data class AppNotification(
    val id: String,
    val title: String,
    val messageBody: String?,
    val status: String,
    val targetAudience: String?,
    val priority: String,
    val createdAt: String?
)

// MARK: - API Interface

/**
 * Retrofit Interface for TIWI Protocol Next.js Backend.
 * Represents all endpoints needed for Android app integration.
 */
interface TiwiApiService {
    // 1. Tokens
    @GET("api/v1/tokens")
    suspend fun getTokens(
        @Query("category") category: String? = null,
        @Query("limit") limit: Int = 60,
        @Query("chains") chains: String? = null, // comma-separated e.g. "1,56"
        @Query("query") query: String? = null
    ): TokensResponse

    // 2. Unified Market List
    @GET("api/v1/market/list")
    suspend fun getMarketList(
        @Query("marketType") marketType: String = "all",
        @Query("limit") limit: Int = 100
    ): MarketListResponse

    // 3. Token Info
    @GET("api/v1/token-info/{chainId}/{address}")
    suspend fun getTokenInfo(
        @Path("chainId") chainId: Int,
        @Path("address") address: String
    ): TokenInfoResponse

    // 4. Wallet Balances
    @GET("api/v1/wallet/balances")
    suspend fun getWalletBalances(
        @Query("address") address: String,
        @Query("chains") chains: String? = null
    ): WalletBalanceResponse

    // 5. Swap Route
    @POST("api/v1/route")
    suspend fun requestSwapRoute(
        @Body payload: RouteRequestPayload
    ): RouteResponsePayload

    // 6. Staking Pools
    @GET("api/v1/staking-pools")
    suspend fun getStakingPools(
        @Query("status") status: String? = "active"
    ): StakingPoolsResponse

    // 7. Token Security Scan
    @GET("api/v1/token/security/{chainId}/{address}")
    suspend fun scanTokenSecurity(
        @Path("chainId") chainId: Int,
        @Path("address") address: String
    ): TokenSecurityResponse

    // 8. App Notifications
    @GET("api/v1/notifications")
    suspend fun getNotifications(
        @Query("userWallet") userWallet: String? = null
    ): NotificationsResponse
}

// MARK: - Client Singleton

/**
 * Singleton object providing a configured Retrofit TiwiApiService instance.
 * Call TiwiApiClient.apiService from Android ViewModels or Repositories.
 */
object TiwiApiClient {
    private const val BASE_URL = "https://app.tiwiprotocol.xyz/"

    val apiService: TiwiApiService by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(TiwiApiService::class.java)
    }
}
