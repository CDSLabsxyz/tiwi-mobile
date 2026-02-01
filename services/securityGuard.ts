/**
 * Tiwi Protocol Security Guard Service
 * 
 * This service provides real-time risk assessment for addresses, tokens, and contracts.
 * It integrates with external security providers to detect phishing, honeypots, and other scams.
 */

import axios from 'axios';

// Interfaces for Risk Results
export interface RiskCheckResult {
    isSafe: boolean;
    riskScore: number; // 0 (Safe) to 100 (Severe Risk)
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    warnings: string[];
    details?: any;
}

export interface TokenRiskResult extends RiskCheckResult {
    isHoneypot: boolean;
    isMintable: boolean;
    canRenounceOwnership: boolean;
    buyTax: string;
    sellTax: string;
}

class SecurityGuardService {
    // We use GoPlus Security API (v1) - it's free and public for basic checks
    private baseApi = 'https://api.gopluslabs.io/api/v1';

    /**
     * Checks an address for security risks (phishing, blacklists, etc.)
     * @param address The wallet or contract address to check
     * @param chainId The chain ID (e.g. '1' for Ethereum, '56' for BSC)
     */
    async checkAddressRisk(address: string, chainId: string = '1'): Promise<RiskCheckResult> {
        try {
            // Placeholder: In a production app, we hit the GoPlus /address_security endpoint
            // For now, we simulate the logic and return a structured response
            const response = await axios.get(`${this.baseApi}/address_security/${address}?chain_id=${chainId}`);
            const data = response.data?.result;

            if (!data) {
                return { isSafe: true, riskScore: 0, riskLevel: 'low', warnings: [] };
            }

            const warnings: string[] = [];
            let riskScore = 0;

            if (data.is_blacklisted === '1' || data.is_scammer === '1') {
                warnings.push('Address is blacklisted or flagged for scams.');
                riskScore = 100;
            }

            if (data.is_sanctioned === '1') {
                warnings.push('Address is on a global sanctions list.');
                riskScore = Math.max(riskScore, 90);
            }

            return {
                isSafe: riskScore < 70,
                riskScore,
                riskLevel: this.getRiskLevel(riskScore),
                warnings,
                details: data
            };
        } catch (error) {
            console.error('Tiwi Protocol Security Guard Error (Address):', error);
            // Default to safe if API is down, or implement a stricter "block on error" policy
            return { isSafe: true, riskScore: 0, riskLevel: 'low', warnings: [] };
        }
    }

    /**
     * Checks a token contract for honeypot or malicious logic
     */
    async checkTokenRisk(tokenAddress: string, chainId: string = '1'): Promise<TokenRiskResult> {
        try {
            const response = await axios.get(`${this.baseApi}/token_security/${chainId}?contract_addresses=${tokenAddress}`);
            const data = response.data?.result?.[tokenAddress.toLowerCase()];

            if (!data) {
                return {
                    isSafe: true, riskScore: 0, riskLevel: 'low', warnings: [],
                    isHoneypot: false, isMintable: false, canRenounceOwnership: true, buyTax: '0%', sellTax: '0%'
                };
            }

            const warnings: string[] = [];
            let riskScore = 0;

            const isHoneypot = data.is_honeypot === '1';
            const isMintable = data.is_mintable === '1';
            const canStealFunds = data.can_take_back_ownership === '1' || data.is_proxy === '1';

            if (isHoneypot) {
                warnings.push('This token is a HONEYPOT. You cannot sell once you buy.');
                riskScore = 100;
            }

            if (data.buy_tax > 0.1 || data.sell_tax > 0.1) {
                warnings.push(`High tax detected (Buy: ${data.buy_tax * 100}%, Sell: ${data.sell_tax * 100}%).`);
                riskScore = Math.max(riskScore, 40);
            }

            if (isMintable) {
                warnings.push('The developer can mint new tokens at any time.');
                riskScore = Math.max(riskScore, 50);
            }

            return {
                isSafe: riskScore < 80,
                riskScore,
                riskLevel: this.getRiskLevel(riskScore),
                warnings,
                isHoneypot,
                isMintable,
                canRenounceOwnership: !canStealFunds,
                buyTax: `${(data.buy_tax * 100).toFixed(1)}%`,
                sellTax: `${(data.sell_tax * 100).toFixed(1)}%`,
                details: data
            };
        } catch (error) {
            console.error('Tiwi Protocol Security Guard Error (Token):', error);
            return {
                isSafe: true, riskScore: 0, riskLevel: 'low', warnings: [],
                isHoneypot: false, isMintable: false, canRenounceOwnership: true, buyTax: '0', sellTax: '0'
            };
        }
    }

    private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
        if (score >= 90) return 'critical';
        if (score >= 70) return 'high';
        if (score >= 40) return 'medium';
        return 'low';
    }
}

export const securityGuard = new SecurityGuardService();
