/**
 * BPInput — Text/Number Input component
 * UI Supervisor: Dark surface, neon focus ring, label support
 */
import { theme } from '@/constants/Colors';
import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    View,
    ViewStyle,
} from 'react-native';

interface BPInputProps extends TextInputProps {
    label?: string;
    suffix?: string;
    accentColor?: string;
    containerStyle?: ViewStyle;
    error?: string;
}

export default function BPInput({
    label,
    suffix,
    accentColor = theme.colors.accent,
    containerStyle,
    error,
    ...inputProps
}: BPInputProps) {
    const [focused, setFocused] = useState(false);

    return (
        <View style={[styles.container, containerStyle]}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View
                style={[
                    styles.inputWrap,
                    focused && { borderColor: accentColor },
                    error ? styles.errorBorder : undefined,
                ]}
            >
                <TextInput
                    style={styles.input}
                    placeholderTextColor={theme.colors.textMuted}
                    selectionColor={accentColor}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    {...inputProps}
                />
                {suffix && <Text style={styles.suffix}>{suffix}</Text>}
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing.md,
    },
    label: {
        color: theme.colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 6,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius.md,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.spacing.md,
    },
    input: {
        flex: 1,
        color: theme.colors.text,
        fontSize: 16,
        paddingVertical: 14,
        fontWeight: '500',
    },
    suffix: {
        color: theme.colors.textMuted,
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    errorBorder: {
        borderColor: theme.colors.accentRed,
    },
    errorText: {
        color: theme.colors.accentRed,
        fontSize: 12,
        marginTop: 4,
    },
});
