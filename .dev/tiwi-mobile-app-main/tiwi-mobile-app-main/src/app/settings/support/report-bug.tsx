/**
 * Report Bug Screen
 * Report bug page with file upload and email submission matching Figma design exactly (node-id: 3279-121427)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, BackHandler, TextInput, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const CloudAddIcon = require('@/assets/settings/cloud-add.svg');

// Toggle Switch Component
interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ value, onValueChange }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
      style={{
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 40,
          height: 24,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: value ? colors.primaryCTA : '#4e634b',
          backgroundColor: colors.bg,
          padding: 2,
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 10,
            backgroundColor: value ? colors.primaryCTA : '#4e634b',
            transform: [{ translateX: value ? 16 : 0 }],
          }}
        />
      </View>
    </TouchableOpacity>
  );
};

export default function ReportBugScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [logFileUri, setLogFileUri] = useState<string | null>(null);
  const [sendDeviceInfo, setSendDeviceInfo] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle phone back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });

    return () => backHandler.remove();
  }, []);

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings/support' as any);
    }
  };

  const handleBrowseScreenshot = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setScreenshotUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleBrowseLogFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/pdf', 'application/msword'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setLogFileUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const getDeviceInfo = () => {
    return {
      platform: Platform.OS,
      version: Platform.Version,
      deviceName: Constants.deviceName || 'Unknown',
      appVersion: Constants.expoConfig?.version || '1.0.0',
      installationId: Constants.installationId || 'Unknown',
    };
  };

  const handleSubmitBugReport = async () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please describe the issue');
      return;
    }

    try {
      setIsSubmitting(true);

      const deviceInfo = sendDeviceInfo ? getDeviceInfo() : null;
      const supportEmail = 'support@tiwiprotocol.com'; // TODO: Replace with actual support email

      // Create email body
      let emailBody = `Bug Report\n\n`;
      emailBody += `Description:\n${description}\n\n`;

      if (deviceInfo) {
        emailBody += `Device Information:\n`;
        emailBody += `Platform: ${deviceInfo.platform}\n`;
        emailBody += `Version: ${deviceInfo.version}\n`;
        emailBody += `Device Name: ${deviceInfo.deviceName}\n`;
        emailBody += `App Version: ${deviceInfo.appVersion}\n`;
        emailBody += `Installation ID: ${deviceInfo.installationId}\n\n`;
      }

      emailBody += `Submitted: ${new Date().toISOString()}\n`;

      // Create email subject
      const emailSubject = `Bug Report - TIWI Protocol`;

      // Create mailto link
      const mailtoLink = `mailto:${supportEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

      // For attachments, we'll need to use a different approach
      // Since mailto doesn't support attachments, we'll include file info in the body
      if (screenshotUri) {
        emailBody += `\nScreenshot attached: Yes\n`;
      }
      if (logFileUri) {
        emailBody += `\nLog file attached: Yes\n`;
      }

      // Open email client
      const canOpen = await Linking.canOpenURL(mailtoLink);
      if (canOpen) {
        await Linking.openURL(mailtoLink);
        Alert.alert(
          'Success',
          'Email client opened. Please attach the screenshot and log file if you selected them, then send the email.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Reset form
                setDescription('');
                setScreenshotUri(null);
                setLogFileUri(null);
                router.back();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Unable to open email client');
      }
    } catch (error) {
      console.error('Error submitting bug report:', error);
      Alert.alert('Error', 'Failed to submit bug report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Header */}
      <View
        style={{
          paddingTop: top || 0,
          backgroundColor: colors.bg,
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 15,
            paddingVertical: 10,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleBackPress}
            style={{
              width: 24,
              height: 24,
            }}
          >
            <Image
              source={ChevronLeftIcon}
              className="w-full h-full"
              contentFit="contain"
            />
          </TouchableOpacity>

          <Text
            style={{
              fontFamily: 'Manrope-Medium',
              fontSize: 18,
              lineHeight: 18,
              color: colors.titleText,
              flex: 1,
              textAlign: 'center',
            }}
          >
            Report a Bug
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 18,
          paddingBottom: (bottom || 16) + 24,
          paddingHorizontal: 20,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {/* Intro Text */}
          <Text
            style={{
              fontFamily: 'Manrope-Medium',
              fontSize: 12,
              lineHeight: 18,
              color: colors.bodyText,
            }}
          >
            Help us improve TIWI Protocol by reporting any issues you encounter. Our team will review your report promptly.
          </Text>

          {/* Attach Screenshot */}
          <View
            style={{
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: colors.titleText,
              }}
            >
              Attach Screenshot (Recommended)
            </Text>
            <View
              style={{
                borderWidth: 2,
                borderColor: colors.bgStroke,
                borderStyle: 'dashed',
                height: 202,
                borderRadius: 16,
                padding: 10,
                flexDirection: 'column',
                gap: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 71.649,
                  height: 71.649,
                }}
              >
                <Image
                  source={CloudAddIcon}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              </View>
              <View
                style={{
                  flexDirection: 'column',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 12,
                    color: colors.bodyText,
                    textAlign: 'center',
                  }}
                >
                  {screenshotUri ? 'Screenshot selected' : 'Choose a file or drag & drop it here'}
                </Text>
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 12,
                    color: '#a9acb4',
                    textAlign: 'center',
                  }}
                >
                  JPEG, PNG formats, up to 50MB
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleBrowseScreenshot}
                style={{
                  borderWidth: 1,
                  borderColor: colors.bgStroke,
                  height: 46,
                  borderRadius: 24.921,
                  paddingHorizontal: 51.4,
                  paddingVertical: 24.921,
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 16,
                    color: colors.titleText,
                  }}
                >
                  Browse File
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Add Log File */}
          <View
            style={{
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: colors.titleText,
              }}
            >
              Add Log File (Optional)
            </Text>
            <View
              style={{
                borderWidth: 2,
                borderColor: colors.bgStroke,
                borderStyle: 'dashed',
                height: 202,
                borderRadius: 16,
                padding: 10,
                flexDirection: 'column',
                gap: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 71.649,
                  height: 71.649,
                }}
              >
                <Image
                  source={CloudAddIcon}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              </View>
              <View
                style={{
                  flexDirection: 'column',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 12,
                    color: colors.bodyText,
                    textAlign: 'center',
                  }}
                >
                  {logFileUri ? 'Log file selected' : 'Choose a file or drag & drop it here'}
                </Text>
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 12,
                    color: '#a9acb4',
                    textAlign: 'center',
                  }}
                >
                  TXT, PDF, DOCX formats, up to 50MB
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleBrowseLogFile}
                style={{
                  borderWidth: 1,
                  borderColor: colors.bgStroke,
                  height: 46,
                  borderRadius: 24.921,
                  paddingHorizontal: 51.4,
                  paddingVertical: 24.921,
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 16,
                    color: colors.titleText,
                  }}
                >
                  Browse File
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Describe the Issue */}
          <View
            style={{
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: colors.titleText,
              }}
            >
              Describe the Issue
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.bgSemi,
                borderRadius: 16,
                paddingHorizontal: 17,
                paddingVertical: 10,
                minHeight: 127,
                fontFamily: 'Manrope-Medium',
                fontSize: 14,
                color: colors.titleText,
                textAlignVertical: 'top',
              }}
              placeholder="Tell us what happened…"
              placeholderTextColor={colors.mutedText}
              multiline
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Send Device Info Automatically */}
          <View
            style={{
              height: 40,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: colors.bodyText,
              }}
            >
              Send Device Info Automatically
            </Text>
            <ToggleSwitch
              value={sendDeviceInfo}
              onValueChange={setSendDeviceInfo}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSubmitBugReport}
            disabled={isSubmitting || !description.trim()}
            style={{
              width: '100%',
              height: 54,
              backgroundColor: description.trim() ? colors.primaryCTA : colors.bgCards,
              borderRadius: 100,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              paddingVertical: 14,
              opacity: description.trim() ? 1 : 0.5,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: description.trim() ? '#010501' : colors.bodyText,
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Bug Report'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}





