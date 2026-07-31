import { BPButton, BPCard, BPInput, BPModal } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { confirmDialog, showAlert } from '@/lib/dialog';
import { getSupabase } from '@/lib/supabase';
import { Stack, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

interface UserProfile {
    id: string;
    email: string;
    is_active: boolean;
    created_at: string;
}

export default function AdminScreen() {
    const { t } = useTranslation();
    const { isAdmin, isConfigured, isLoading } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Password reset modal
    const [pwdModalVisible, setPwdModalVisible] = useState(false);
    const [pwdTargetUser, setPwdTargetUser] = useState<UserProfile | null>(null);
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        // Wait until auth state is resolved, otherwise admins get redirected on refresh
        if (isLoading) return;
        if (!isAdmin) {
            router.replace('/(tabs)/profile');
            return;
        }
        fetchUsers();
    }, [isAdmin, isLoading]);

    const fetchUsers = async () => {
        if (!isConfigured) return;
        const supabase = getSupabase();
        if (!supabase) return;

        setLoading(true);
        const { data, error } = await supabase.rpc('admin_get_users');
        if (error) {
            console.error('Error fetching users:', error);
            showAlert(t('admin.error_title'), t('admin.load_error', { message: error.message }));
        } else if (data) {
            setUsers(data);
        }
        setLoading(false);
        setRefreshing(false);
    };

    const confirmUser = async (id: string) => {
        const supabase = getSupabase();
        if (!supabase) return;

        setRefreshing(true);
        const { error } = await supabase.rpc('admin_update_user_status', { target_id: id, new_status: true });
        if (error) {
            showAlert(t('admin.error_title'), t('admin.confirm_error', { message: error.message }));
            setRefreshing(false);
        } else {
            fetchUsers();
        }
    };

    const deleteUser = async (user: UserProfile) => {
        const confirmed = await confirmDialog(
            t('admin.delete_title'),
            t('admin.delete_confirm', { email: user.email })
        );
        if (!confirmed) return;

        const supabase = getSupabase();
        if (!supabase) return;
        setRefreshing(true);
        const { error } = await supabase.rpc('admin_delete_user', { target_id: user.id });
        if (error) {
            showAlert(t('admin.error_title'), t('admin.delete_error', { message: error.message }));
            setRefreshing(false);
        } else {
            fetchUsers();
        }
    };

    const openPwdModal = (user: UserProfile) => {
        setPwdTargetUser(user);
        setNewPassword('');
        setPwdModalVisible(true);
    };

    const handlePasswordChange = async () => {
        if (!newPassword || newPassword.length < 6) {
            showAlert(t('admin.error_title'), t('admin.pwd_too_short'));
            return;
        }
        if (!pwdTargetUser) return;

        const supabase = getSupabase();
        if (!supabase) return;

        const { error } = await supabase.rpc('admin_update_user_password', {
            target_id: pwdTargetUser.id,
            new_password: newPassword
        });

        if (error) {
            showAlert(t('admin.error_title'), t('admin.pwd_error', { message: error.message }));
        } else {
            showAlert(t('admin.success_title'), t('admin.pwd_success', { email: pwdTargetUser.email }));
            setPwdModalVisible(false);
            setPwdTargetUser(null);
        }
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.centerTarget}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
            </View>
        );
    }

    const pendingUsers = users.filter((u) => !u.is_active);
    const activeUsers = users.filter((u) => u.is_active);

    const renderUser = (u: UserProfile, isPending: boolean) => (
        <BPCard key={u.id} style={styles.userCard}>
            <View style={styles.userInfo}>
                <Text style={styles.userEmail}>{u.email}</Text>
                <Text style={styles.userDate}>{t('admin.registered_at', { date: new Date(u.created_at).toLocaleDateString('de-DE') })}</Text>
            </View>
            <View style={styles.userActions}>
                {isPending && (
                    <BPButton title={t('admin.btn_unlock')} style={styles.actionBtn} onPress={() => confirmUser(u.id)} />
                )}
                <BPButton title="Key" style={styles.actionBtn} variant="secondary" onPress={() => openPwdModal(u)} />
                <BPButton title="Del" style={[styles.actionBtn, { borderColor: theme.colors.accentOrange }]} variant="outline" onPress={() => deleteUser(u)} />
            </View>
        </BPCard>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: t('admin.title'), headerShown: true, headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.text }} />

            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.sectionTitle}>{t('admin.pending_title', { count: pendingUsers.length })}</Text>
                {pendingUsers.length === 0 && <Text style={styles.emptyText}>{t('admin.no_pending')}</Text>}
                {pendingUsers.map(u => renderUser(u, true))}

                <View style={styles.divider} />

                <Text style={styles.sectionTitle}>{t('admin.active_title', { count: activeUsers.length })}</Text>
                {activeUsers.length === 0 && <Text style={styles.emptyText}>{t('admin.no_active')}</Text>}
                {activeUsers.map(u => renderUser(u, false))}
            </ScrollView>

            <BPModal
                visible={pwdModalVisible}
                onClose={() => setPwdModalVisible(false)}
                title={t('admin.pwd_modal_title')}
            >
                <Text style={styles.modalSub}>{t('admin.pwd_for_user', { email: pwdTargetUser?.email })}</Text>

                <BPInput
                    label={t('admin.pwd_label')}
                    placeholder={t('admin.pwd_placeholder')}
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                />

                <View style={styles.modalActions}>
                    <BPButton title={t('common.cancel')} variant="secondary" onPress={() => setPwdModalVisible(false)} style={{ flex: 1, marginRight: 8 }} />
                    <BPButton title={t('common.save')} onPress={handlePasswordChange} style={{ flex: 1, marginLeft: 8 }} />
                </View>
            </BPModal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { padding: theme.spacing.md, paddingBottom: 60 },
    centerTarget: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
    sectionTitle: { fontSize: 20, color: theme.colors.text, fontWeight: 'bold', marginBottom: theme.spacing.md, marginTop: theme.spacing.sm },
    emptyText: { color: theme.colors.textSecondary, fontStyle: 'italic', marginBottom: theme.spacing.lg },
    divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.xl },
    userCard: { padding: theme.spacing.sm, marginBottom: theme.spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    userInfo: { flex: 1, marginRight: theme.spacing.sm },
    userEmail: { fontSize: 16, color: theme.colors.text, fontWeight: 'bold' },
    userDate: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
    userActions: { flexDirection: 'row', gap: 4 },
    actionBtn: { paddingHorizontal: 10, paddingVertical: 6, minHeight: 0 },
    modalSub: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: theme.spacing.lg },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.lg }
});
