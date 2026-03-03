/**
 * BPButton — Standard Button component
 * UI Supervisor: Dark theme, neon accent, press animation
 */
import { theme } from '@/constants/Colors';
import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    ViewStyle,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface BPButtonProps {
    title: string;
    onPress: () => void;
    variant?: Variant;
    size?: Size;
    color?: string;
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    icon?: React.ReactNode;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

export default function BPButton({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    color = theme.colors.accent,
    disabled = false,
    loading = false,
    fullWidth = false,
    icon,
    style,
    textStyle,
}: BPButtonProps) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
    };
    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    };

    const sizeStyles = sizes[size];
    const variantStyles = getVariantStyles(variant, color);

    return (
        <AnimatedTouchable
            style={[
                styles.base,
                sizeStyles.button,
                variantStyles.button,
                fullWidth && styles.fullWidth,
                disabled && styles.disabled,
                animatedStyle,
                style,
            ]}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.85}
            disabled={disabled || loading}
        >
            {loading ? (
                <ActivityIndicator size="small" color={variantStyles.textColor} />
            ) : (
                <>
                    {icon}
                    <Text
                        style={[
                            styles.text,
                            sizeStyles.text,
                            { color: variantStyles.textColor },
                            textStyle,
                        ]}
                    >
                        {title}
                    </Text>
                </>
            )}
        </AnimatedTouchable>
    );
}

function getVariantStyles(variant: Variant, color: string) {
    switch (variant) {
        case 'primary':
            return {
                button: { backgroundColor: color, borderWidth: 0 } as ViewStyle,
                textColor: '#000',
            };
        case 'secondary':
            return {
                button: {
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    borderColor: color,
                } as ViewStyle,
                textColor: color,
            };
        case 'ghost':
            return {
                button: { backgroundColor: 'transparent', borderWidth: 0 } as ViewStyle,
                textColor: color,
            };
    }
}

const sizes: Record<Size, { button: ViewStyle; text: TextStyle }> = {
    sm: {
        button: { paddingVertical: 8, paddingHorizontal: 16 },
        text: { fontSize: 13 },
    },
    md: {
        button: { paddingVertical: 12, paddingHorizontal: 24 },
        text: { fontSize: 15 },
    },
    lg: {
        button: { paddingVertical: 16, paddingHorizontal: 32 },
        text: { fontSize: 17 },
    },
};

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.md,
        gap: 8,
    },
    fullWidth: {
        width: '100%',
    },
    disabled: {
        opacity: 0.4,
    },
    text: {
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
