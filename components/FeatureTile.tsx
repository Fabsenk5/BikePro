import { theme } from '@/constants/Colors';
import type { Feature } from '@/constants/Features';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface FeatureTileProps {
    feature: Feature;
    onPress: () => void;
    index: number;
    dynamicSubtitle?: string;
    badgeLabel?: string;
}

export default function FeatureTile({ feature, onPress, index, dynamicSubtitle, badgeLabel }: FeatureTileProps) {
    const { t } = useTranslation();
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    };

    return (
        <AnimatedTouchable
            style={[styles.tile, animatedStyle]}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.9}
        >
            {/* Accent glow line at top */}
            <View
                style={[
                    styles.accentBar,
                    { backgroundColor: feature.accentColor },
                ]}
            />

            {/* Icon circle */}
            <View
                style={[
                    styles.iconCircle,
                    { backgroundColor: feature.accentColor + '18' },
                ]}
            >
                <Text style={styles.iconEmoji}>{feature.icon}</Text>
            </View>

            {/* Title & subtitle */}
            <Text style={styles.title} numberOfLines={1}>
                {t(`features.${feature.id}.title`, { defaultValue: feature.title })}
            </Text>
            <Text style={[styles.subtitle, { color: feature.accentColor }]} numberOfLines={1}>
                {dynamicSubtitle || t(`features.${feature.id}.subtitle`, { defaultValue: feature.subtitle })}
            </Text>

            {/* Custom Active Badge (e.g., Shred Check Warnings) */}
            {badgeLabel ? (
                <View style={[styles.badge, styles.badgeActive]}>
                    <Text style={[styles.badgeText, { color: '#fff' }]}>{badgeLabel}</Text>
                </View>
            ) : !feature.ready ? (
                /* Coming Soon badge */
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{t('common.coming_soon', { defaultValue: 'SOON' }).toUpperCase()}</Text>
                </View>
            ) : null}
        </AnimatedTouchable>
    );
}

const styles = StyleSheet.create({
    tile: {
        width: '100%',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.md,
        paddingTop: theme.spacing.xs,
        borderWidth: 1,
        borderColor: theme.colors.border,
        position: 'relative',
        overflow: 'hidden',
        minHeight: 140,
        justifyContent: 'center',
        alignItems: 'center',
    },
    accentBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        borderTopLeftRadius: theme.radius.lg,
        borderTopRightRadius: theme.radius.lg,
    },
    iconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.sm,
        marginTop: theme.spacing.sm,
    },
    iconEmoji: {
        fontSize: 26,
    },
    title: {
        color: theme.colors.text,
        fontSize: 15,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    subtitle: {
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    badge: {
        position: 'absolute',
        top: theme.spacing.sm,
        right: theme.spacing.sm,
        backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius.sm,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    badgeActive: {
        backgroundColor: theme.colors.error,
        borderColor: theme.colors.error,
    },
    badgeText: {
        color: theme.colors.textMuted,
        fontSize: 8,
        fontWeight: '800',
        letterSpacing: 1.5,
    },
});
