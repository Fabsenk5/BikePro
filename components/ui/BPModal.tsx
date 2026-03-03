/**
 * BPModal — Bottom sheet modal component
 * UI Supervisor: Dark overlay, slide-up animation
 */
import { theme } from '@/constants/Colors';
import React from 'react';
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';

interface BPModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxHeight?: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function BPModal({
    visible,
    onClose,
    title,
    children,
    maxHeight = SCREEN_HEIGHT * 0.7,
}: BPModalProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={[styles.sheet, { maxHeight }]}>
                            {/* Handle bar */}
                            <View style={styles.handleWrap}>
                                <View style={styles.handle} />
                            </View>

                            {/* Header */}
                            {title && (
                                <View style={styles.header}>
                                    <Text style={styles.title}>{title}</Text>
                                    <TouchableOpacity onPress={onClose}>
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
                        </View>
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
    sheet: {
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: theme.radius.xl,
        borderTopRightRadius: theme.radius.xl,
        borderTopWidth: 1,
        borderColor: theme.colors.border,
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
});
