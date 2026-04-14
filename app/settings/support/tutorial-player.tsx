import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { SettingsHeader } from '@/components/ui/settings-header';
import { colors } from '@/constants/colors';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Extract YouTube video ID from various URL formats */
function extractYouTubeId(url: string): string | null {
    if (!url) return null;
    const trimmed = url.trim();

    // Match YouTube URL patterns:
    // - youtu.be/VIDEO_ID
    // - youtube.com/watch?v=VIDEO_ID
    // - youtube.com/embed/VIDEO_ID
    // - youtube.com/shorts/VIDEO_ID
    // - youtube.com/v/VIDEO_ID
    // - m.youtube.com/watch?v=VIDEO_ID
    // Works with or without query params (?si=, &t=, etc.) and trailing slashes.
    const regex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{6,})/i;
    const match = trimmed.match(regex);
    if (match && match[1]) return match[1];

    // Fallback — if the URL is just a raw 11-char video ID
    if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

    return null;
}

export default function TutorialPlayerScreen() {
    const router = useRouter();
    const { bottom } = useSafeAreaInsets();
    const params = useLocalSearchParams<{
        id?: string;
        title?: string;
        description?: string;
        videoUrl?: string;
        thumbnailUrl?: string;
        category?: string;
    }>();

    // URL-decode in case it was encoded to survive Expo Router param passing
    const videoUrl = (() => {
        const raw = params.videoUrl || '';
        try { return decodeURIComponent(raw); } catch { return raw; }
    })();
    console.log('[TutorialPlayer] videoUrl:', videoUrl);
    const youtubeId = extractYouTubeId(videoUrl);
    console.log('[TutorialPlayer] youtubeId:', youtubeId);
    const isYouTube = !!youtubeId;

    // expo-video player — only initialize for direct video URLs (not YouTube links)
    const player = useVideoPlayer(isYouTube ? null : videoUrl, (p) => {
        p.loop = false;
        p.muted = false;
    });

    const youtubeHtml = youtubeId ? `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
body, html { margin: 0; padding: 0; background: #000; overflow: hidden; height: 100%; width: 100%; }
#player { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="player"></div>
<script>
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
var player;
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    videoId: '${youtubeId}',
    playerVars: {
      'playsinline': 1,
      'rel': 0,
      'modestbranding': 1,
      'fs': 1,
      'controls': 1,
      'origin': 'https://www.youtube.com'
    }
  });
}
</script>
</body>
</html>
` : null;

    return (
        <View style={styles.container}>
            <CustomStatusBar />
            <SettingsHeader
                title="Tutorial"
                showBack={true}
                onBack={() => router.back()}
            />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: bottom + 24 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Video Player */}
                <View style={styles.videoWrapper}>
                    {isYouTube && youtubeId ? (
                        <WebView
                            source={{ uri: `https://www.youtube-nocookie.com/embed/${youtubeId}?playsinline=1&rel=0&modestbranding=1&autoplay=0&controls=1&fs=1` }}
                            style={styles.video}
                            allowsInlineMediaPlayback
                            mediaPlaybackRequiresUserAction={false}
                            javaScriptEnabled
                            domStorageEnabled
                            allowsFullscreenVideo
                            scrollEnabled={false}
                            startInLoadingState
                            mixedContentMode="always"
                            // Desktop-like user agent bypasses some mobile embed restrictions
                            userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
                        />
                    ) : videoUrl ? (
                        <VideoView
                            player={player}
                            style={styles.video}
                            contentFit="contain"
                            allowsFullscreen
                            allowsPictureInPicture
                            nativeControls
                        />
                    ) : (
                        <View style={styles.noVideo}>
                            <Text style={styles.noVideoText}>No video available</Text>
                        </View>
                    )}
                </View>

                {/* Metadata */}
                <View style={styles.infoSection}>
                    {params.category ? (
                        <View style={styles.categoryBadge}>
                            <Text style={styles.categoryText}>{params.category}</Text>
                        </View>
                    ) : null}

                    <Text style={styles.title}>{params.title || 'Tutorial'}</Text>

                    {params.description ? (
                        <Text style={styles.description}>{params.description}</Text>
                    ) : null}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    videoWrapper: {
        width: '100%',
        height: (SCREEN_WIDTH * 9) / 16, // 16:9 aspect ratio
        backgroundColor: '#000',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    noVideo: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
    },
    noVideoText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#B5B5B5',
    },
    infoSection: {
        padding: 20,
        gap: 12,
    },
    categoryBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(177, 241, 40, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    categoryText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.primaryCTA,
    },
    title: {
        fontFamily: 'Manrope-Bold',
        fontSize: 22,
        color: colors.titleText,
        lineHeight: 30,
    },
    description: {
        fontFamily: 'Manrope-Regular',
        fontSize: 15,
        color: colors.bodyText,
        lineHeight: 22,
        opacity: 0.9,
    },
});
