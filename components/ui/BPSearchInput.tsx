/**
 * BPSearchInput — Search field with icon and clear button
 * UI Supervisor: Elevated surface, accent focus ring, clear affordance
 */
import { theme } from '@/constants/Colors';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';

interface BPSearchInputProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    onClear?: () => void;
    accentColor?: string;
    containerStyle?: ViewStyle;
}

export default function BPSearchInput({
    value,
    onChangeText,
    placeholder,
    onClear,
    accentColor = theme.colors.accent,
    containerStyle,
}: BPSearchInputProps) {
    const { t } = useTranslation();
    const [focused, setFocused] = useState(false);

    const handleClear = () => {
        onChangeText('');
        onClear?.();
    };

    return (
        <View
            style={[
                styles.inputWrap,
                focused && { borderColor: accentColor },
                containerStyle,
            ]}
        >
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.textMuted}
                selectionColor={accentColor}
                returnKeyType="search"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                accessibilityRole="search"
                accessibilityLabel={placeholder}
            />
            {value.length > 0 && (
                <TouchableOpacity
                    onPress={handleClear}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('a11y.clear')}
                >
                    <Text style={styles.clearIcon}>✕</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius.md,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.spacing.md,
    },
    searchIcon: {
        color: theme.colors.textMuted,
        fontSize: 16,
        marginRight: 8,
    },
    input: {
        flex: 1,
        color: theme.colors.text,
        fontSize: 15,
        paddingVertical: 12,
        fontWeight: '500',
    },
    clearIcon: {
        color: theme.colors.textMuted,
        fontSize: 14,
        padding: 4,
    },
});
