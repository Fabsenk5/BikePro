/**
 * BPModal — Modal component (bottom sheet or centered dialog)
 * UI Supervisor: Dark overlay, slide-up sheet / centered card, optional footer
 */
import { theme } from '@/constants/Colors';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    useWindowDimensions,
    View,
} from 'react-native';

interface BPModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxHeight?: number;
    variant?: 'sheet' | 'center';
    footer?: React.ReactNode;
}

export default function BPModal({
    visible,
    onClose,
    title,
    children,
    maxHeight,
    variant = 'sheet',
    footer,
}: BPModalProps) {
    const { t } = useTranslation();
    const { height: screenHeight } = useWindowDimensions();
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    const isCenter = variant === 'center';
    const resolvedMaxHeight =
        maxHeight ?? screenHeight * (isCenter ? 0.8 : 0.7);

    return (
        <Modal
            visible={visible}
            transparent
            animationType={isCenter ? 'fade' : 'slide'}
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={[styles.overlay, isCenter && styles.overlayCenter]}>
                    <TouchableWithoutFeedback>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                            style={isCenter ? styles.kavCenter : styles.kavSheet}
                        >
                            <View
                                style={[
                                    isCenter ? styles.centerCard : styles.sheet,
                                    { maxHeight: resolvedMaxHeight },
                                ]}
                                accessibilityViewIsModal
                            >
                                {/* Handle bar (sheet only) */}
                                {!isCenter && (
                                    <View style={styles.handleWrap}>
                                        <View style={styles.handle} />
                                    </View>
                                )}

                                {/* Header */}
                                {title && (
                                    <View style={styles.header}>
                                        <Text style={styles.title}>{title}</Text>
                                        <TouchableOpacity
                                            onPress={onClose}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('a11y.close')}
                                        >
                                            <Text style={styles.closeBtn}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Content */}
                                <ScrollView
                                    style={styles.content}
                                    contentContainerStyle={styles.contentInner}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {children}
                                </ScrollView>

                                {/* Footer (action row) */}
                                {footer && <View style={styles.footer}>{footer}</View>}
                            </View>
                        </KeyboardAvoidingView>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    overlayCenter: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.lg,
    },
    kavSheet: {
        width: '100%',
    },
    kavCenter: {
        width: '100%',
        alignItems: 'center',
    },
    sheet: {
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: theme.radius.xl,
        borderTopRightRadius: theme.radius.xl,
        borderTopWidth: 1,
        borderColor: theme.colors.border,
    },
    centerCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        width: '100%',
        maxWidth: 480,
    },
    handleWrap: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 4,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: theme.colors.textMuted,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    title: {
        color: theme.colors.text,
        fontSize: 18,
        fontWeight: '700',
    },
    closeBtn: {
        color: theme.colors.textMuted,
        fontSize: 18,
        padding: 4,
    },
    content: {
        flex: 1,
    },
    contentInner: {
        padding: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
    },
    footer: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
        padding: theme.spacing.lg,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
});
