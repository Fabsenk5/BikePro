/**
 * F4: Trail-Video Curator — Edits of the Week
 * Agent Manifest: f4_trail_video.md
 *
 * Kuratierter MTB-Video-Feed (YouTube).
 * Phase 1: Curated list mit YouTube Embeds (kein API Key nötig)
 * Phase 2: YouTube Data API v3 für automatische Suche
 */
import { BPCard, BPPicker } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { Stack } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Dimensions,
    Image,
    Linking,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const ACCENT = '#00E5FF'; // Trail-Video accent
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_WIDTH = Math.min(SCREEN_WIDTH - theme.spacing.lg * 2, 800);
const VIDEO_HEIGHT = VIDEO_WIDTH * 0.5625; // 16:9

// --- Curated video data ---
interface CuratedVideo {
    id: string;
    youtubeId: string;
    title: string;
    channel: string;
    category: string;
    duration: string;
    featured?: boolean;
}

const curatedVideos: CuratedVideo[] = [
    {
        id: '1',
        youtubeId: 'i1FGCaXhUts',
        title: 'Brendog Sends Hardline 2024',
        channel: 'Red Bull Bike',
        category: 'downhill',
        duration: '4:32',
        featured: true,
    },
    {
        id: '2',
        youtubeId: 'D7yMP6fy4qQ',
        title: 'DARKFEST 2024 - Biggest Jumps in MTB',
        channel: 'Red Bull Bike',
        category: 'freeride',
        duration: '12:45',
        featured: true,
    },
    {
        id: '3',
        youtubeId: 'nkXFhQDRNQk',
        title: 'Fabio Wibmer - Fabiolous Escape 2',
        channel: 'Fabio Wibmer',
        category: 'street',
        duration: '7:21',
    },
    {
        id: '4',
        youtubeId: '7YYrTSmhcig',
        title: 'Jackson Goldstone Winning Run - Leogang',
        channel: 'UCI MTB',
        category: 'downhill',
        duration: '4:08',
    },
    {
        id: '5',
        youtubeId: 'rJvgFVYmwHU',
        title: 'Line of the Year - Rampage 2024',
        channel: 'Red Bull Bike',
        category: 'freeride',
        duration: '3:55',
        featured: true,
    },
    {
        id: '6',
        youtubeId: '9zTJLQdCM4c',
        title: 'How To Jump a MTB - Complete Guide',
        channel: 'GMBN',
        category: 'technik',
        duration: '15:30',
    },
    {
        id: '7',
        youtubeId: 'C3hDKOeVxbo',
        title: 'Whistler Bike Park - Top to Bottom',
        channel: 'Skills with Phil',
        category: 'trail',
        duration: '10:12',
    },
    {
        id: '8',
        youtubeId: 'vt4oR0cRXpo',
        title: 'Enduro World Series Highlights',
        channel: 'EWS',
        category: 'enduro',
        duration: '6:44',
    },
    {
        id: '9',
        youtubeId: 'a1LNPhMbw5Y',
        title: 'Cornering Masterclass - Faster on Trails',
        channel: 'GMBN',
        category: 'technik',
        duration: '8:15',
    },
    {
        id: '10',
        youtubeId: 'FW8Wbq7yMFo',
        title: 'Building the Perfect Backyard Trail',
        channel: 'Berm Peak',
        category: 'trail',
        duration: '18:22',
    },
];

const categoryOptions = [
    { label: '🏆 Alle', value: 'all' },
    { label: '⛰️ Downhill', value: 'downhill' },
    { label: '🦅 Freeride', value: 'freeride' },
    { label: '🌲 Trail', value: 'trail' },
    { label: '🏁 Enduro', value: 'enduro' },
    { label: '🏙️ Street', value: 'street' },
    { label: '📚 Technik', value: 'technik' },
];

function getThumbnail(youtubeId: string): string {
    return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
}

export default function TrailVideoScreen() {
    const [category, setCategory] = useState('all');

    const filtered =
        category === 'all'
            ? curatedVideos
            : curatedVideos.filter((v) => v.category === category);

    const openVideo = useCallback((youtubeId: string) => {
        Linking.openURL(`https://www.youtube.com/watch?v=${youtubeId}`);
    }, []);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: '🎬 Trail-Video',
                    headerStyle: { backgroundColor: theme.colors.surface },
                    headerTintColor: theme.colors.text,
                }}
            />
            <StatusBar barStyle="light-content" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Category filter */}
                <BPPicker
                    label="Kategorie"
                    options={categoryOptions}
                    value={category}
                    onValueChange={setCategory}
                    accentColor={ACCENT}
                />

                {/* Featured section */}
                {category === 'all' && (
                    <View style={styles.featuredSection}>
                        <Text style={styles.sectionTitle}>🔥 Edits of the Week</Text>
                    </View>
                )}

                {/* Video cards */}
                {filtered.map((video) => (
                    <TouchableOpacity
                        key={video.id}
                        onPress={() => openVideo(video.youtubeId)}
                        activeOpacity={0.85}
                    >
                        <BPCard
                            style={[
                                styles.videoCard,
                                video.featured && category === 'all' && styles.featuredCard,
                            ]}
                        >
                            {/* Thumbnail */}
                            <View style={styles.thumbnailWrap}>
                                <Image
                                    source={{ uri: getThumbnail(video.youtubeId) }}
                                    style={styles.thumbnail}
                                    resizeMode="cover"
                                />
                                {/* Play overlay */}
                                <View style={styles.playOverlay}>
                                    <View style={styles.playButton}>
                                        <Text style={styles.playIcon}>▶</Text>
                                    </View>
                                </View>
                                {/* Duration badge */}
                                <View style={styles.durationBadge}>
                                    <Text style={styles.durationText}>{video.duration}</Text>
                                </View>
                                {/* Featured badge */}
                                {video.featured && (
                                    <View style={[styles.featuredBadge, { backgroundColor: ACCENT }]}>
                                        <Text style={styles.featuredBadgeText}>🔥 FEATURED</Text>
                                    </View>
                                )}
                            </View>

                            {/* Info */}
                            <View style={styles.videoInfo}>
                                <Text style={styles.videoTitle} numberOfLines={2}>
                                    {video.title}
                                </Text>
                                <View style={styles.videoMeta}>
                                    <Text style={styles.videoChannel}>{video.channel}</Text>
                                    <Text style={styles.videoCat}>
                                        {categoryOptions.find((c) => c.value === video.category)?.label}
                                    </Text>
                                </View>
                            </View>
                        </BPCard>
                    </TouchableOpacity>
                ))}

                {filtered.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🎬</Text>
                        <Text style={styles.emptyTitle}>Keine Videos in dieser Kategorie</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        padding: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
    },
    featuredSection: {
        marginBottom: theme.spacing.sm,
    },
    sectionTitle: {
        color: theme.colors.text,
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    videoCard: {
        marginBottom: theme.spacing.md,
        overflow: 'hidden',
    },
    featuredCard: {
        borderColor: ACCENT + '40',
        borderWidth: 1.5,
    },
    thumbnailWrap: {
        position: 'relative',
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: theme.colors.elevated,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    playButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    playIcon: {
        color: '#fff',
        fontSize: 22,
        marginLeft: 3,
    },
    durationBadge: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    durationText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    featuredBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    featuredBadgeText: {
        color: '#000',
        fontSize: 10,
        fontWeight: '800',
    },
    videoInfo: {
        padding: theme.spacing.md,
    },
    videoTitle: {
        color: theme.colors.text,
        fontSize: 15,
        fontWeight: '700',
        lineHeight: 20,
    },
    videoMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
    },
    videoChannel: {
        color: theme.colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    videoCat: {
        color: theme.colors.textMuted,
        fontSize: 12,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: theme.spacing.xxl * 2,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: theme.spacing.md,
    },
    emptyTitle: {
        color: theme.colors.text,
        fontSize: 18,
        fontWeight: '700',
    },
});
