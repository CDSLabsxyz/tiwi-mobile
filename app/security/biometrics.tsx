import { colors } from '@/constants/colors';
import { useSecurityStore } from '@/store/securityStore';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FingerprintIcon = require('@/assets/security/fingerprint.svg');

export default function BiometricsScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const enableBiometrics = useSecurityStore((state) => state.enableBiometrics);
  const [isSupported, setIsSupported] = useState(false);
  const [authType, setAuthType] = useState<LocalAuthentication.AuthenticationType[]>([]);

  useEffect(() => {
    checkDeviceHardware();
  }, []);

  const checkDeviceHardware = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      setAuthType(types);
      setIsSupported(hasHardware && isEnrolled);
    } catch (e) {
      console.log('Biometric check failed', e);
    }
  };

  const isFaceID = authType.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);

  const handleEnable = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: isFaceID ? 'Authenticate with Face ID' : 'Authenticate with Fingerprint',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        enableBiometrics(true);
        router.push('/security/notifications');
      }
    } catch (e) {
      Alert.alert('Error', 'An error occurred during authentication.');
    }
  };

  const handleSkip = () => {
    enableBiometrics(false);
    router.push('/security/notifications');
  };

  const authIcon = isFaceID
    ? require('@/assets/security/face-id.svg')
    : require('@/assets/security/fingerprint.svg');

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Image
            source={authIcon}
            style={styles.icon}
            contentFit="contain"
            tintColor="white"
          />
        </View>

        <Text style={styles.title}>
          {isFaceID ? 'Set Up Face ID' : 'Set Up Fingerprint'}
        </Text>
        <Text style={styles.subtitle}>
          Unlock your account and authorize payments effortlessly with {isFaceID ? 'Face ID' : 'your fingerprint'}.
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: bottom || 24 }]}>
        <TouchableOpacity
          style={[styles.primaryButton, !isSupported && { opacity: 0.5 }]}
          activeOpacity={0.8}
          onPress={handleEnable}
          disabled={!isSupported}
        >
          <Text style={styles.primaryButtonText}>
            {isSupported
              ? (isFaceID ? 'Enable Face ID' : 'Enable Fingerprint')
              : 'Biometrics Unavailable'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.6}
          onPress={handleSkip}
        >
          <Text style={styles.secondaryButtonText}>Skip for Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    marginBottom: 40,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 80,
    height: 80,
    tintColor: '#FFFFFF',
  },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Manrope-Regular',
    fontSize: 16,
    color: '#B5B5B5',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  footer: {
    paddingHorizontal: 24,
    gap: 16,
    width: '100%',
  },
  primaryButton: {
    height: 56,
    backgroundColor: colors.primaryCTA,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 16,
    color: '#000000',
  },
  secondaryButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 16,
    color: colors.primaryCTA,
  },
});
