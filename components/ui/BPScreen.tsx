/**
 * BPScreen — centered content container for wide (web/desktop) viewports.
 * Content is capped at SCREEN_MAX_WIDTH and horizontally centered; on
 * narrow/native screens it behaves as plain full width. The full-screen
 * background stays with the screen's own outer container.
 *
 * For ScrollView screens prefer spreading `screenContentStyle` into the
 * existing contentContainerStyle instead of wrapping components.
 */
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

export const SCREEN_MAX_WIDTH = 960;

/** Style additions for a ScrollView contentContainerStyle — same centering without a wrapper. */
export const screenContentStyle: ViewStyle = {
    width: '100%',
    maxWidth: SCREEN_MAX_WIDTH,
    alignSelf: 'center',
};

interface BPScreenProps {
    children: React.ReactNode;
    style?: ViewStyle;
    contentStyle?: ViewStyle;
}

export default function BPScreen({ children, style, contentStyle }: BPScreenProps) {
    return (
        <View style={[styles.outer, style]}>
            <View style={[styles.inner, contentStyle]}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    outer: {
        flex: 1,
        alignItems: 'center',
    },
    inner: {
        flex: 1,
        width: '100%',
        maxWidth: SCREEN_MAX_WIDTH,
    },
});
