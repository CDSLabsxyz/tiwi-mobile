import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RecordedRewardWithdrawal {
    txHash: string;
    withdrawnAt: string;
}

function storageKey(chainId: number, poolAddress: string) {
    return `tiwi:staking-reward-withdrawal:${chainId}:${poolAddress.toLowerCase()}`;
}

export async function readRecordedRewardWithdrawal(
    chainId: number,
    poolAddress: string,
): Promise<RecordedRewardWithdrawal | null> {
    try {
        const value = await AsyncStorage.getItem(storageKey(chainId, poolAddress));
        return value ? JSON.parse(value) as RecordedRewardWithdrawal : null;
    } catch {
        return null;
    }
}

export async function recordRewardWithdrawal(
    chainId: number,
    poolAddress: string,
    txHash: string,
): Promise<RecordedRewardWithdrawal> {
    const record = { txHash, withdrawnAt: new Date().toISOString() };
    await AsyncStorage.setItem(storageKey(chainId, poolAddress), JSON.stringify(record));
    return record;
}
