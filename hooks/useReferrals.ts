import { apiClient } from '@/services/apiClient';
import { useWalletStore } from '@/store/walletStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Hook to fetch referral stats for the current wallet
 */
export const useReferralStats = () => {
    const { address } = useWalletStore();
    return useQuery({
        queryKey: ['referralStats', address],
        queryFn: async () => {
            if (!address) return null;
            return apiClient.getReferralStats(address);
        },
        enabled: !!address,
        staleTime: 60000, // 1 minute
    });
};

/**
 * Hook to fetch recent referral activity across the platform
 */
export const useReferralActivity = (limit = 5) => {
    return useQuery({
        queryKey: ['referralActivity', limit],
        queryFn: () => apiClient.getRecentReferralActivity(limit),
        staleTime: 30000, // 30 seconds
    });
};

/**
 * Hook to fetch the referral leaderboard
 */
export const useReferralLeaderboard = (limit = 10) => {
    return useQuery({
        queryKey: ['referralLeaderboard', limit],
        queryFn: () => apiClient.getReferralLeaderboard(limit),
        staleTime: 300000, // 5 minutes
    });
};

/**
 * Hook to fetch rebate stats for the current wallet
 */
export const useReferralRebateStats = () => {
    const { address } = useWalletStore();
    return useQuery({
        queryKey: ['referralRebateStats', address],
        queryFn: async () => {
            if (!address) return null;
            return apiClient.getReferralRebateStats(address);
        },
        enabled: !!address,
        staleTime: 60000,
    });
};

/**
 * Mutation hook to apply a referral code
 */
export const useApplyReferralCode = () => {
    const queryClient = useQueryClient();
    const { address } = useWalletStore();

    return useMutation({
        mutationFn: async (code: string) => {
            if (!address) throw new Error('Wallet not connected');
            return apiClient.applyReferralCode(address, code);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['referralStats', address] });
        },
    });
};

/**
 * Mutation hook to create or fetch the user's referral code
 */
export const useCreateReferralCode = () => {
    const queryClient = useQueryClient();
    const { address } = useWalletStore();

    return useMutation({
        mutationFn: async (customCode?: string) => {
            if (!address) throw new Error('Wallet not connected');
            return apiClient.createReferralCode(address, customCode);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['referralStats', address] });
        },
    });
};

/**
 * Mutation hook to validate a referral code existence
 */
export const useValidateReferralCode = () => {
    return useMutation({
        mutationFn: (code: string) => apiClient.validateReferralCode(code),
    });
};
