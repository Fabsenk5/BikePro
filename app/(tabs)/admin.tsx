import { BPButton, BPCard, BPInput } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { Stack, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

interface UserProfile {
    id: string;
    email: string;
    is_active: boolean;
    created_at: string;
}

export default function AdminScreen() {
    const { isAdmin, isConfigured } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Password reset modal
    const [pwdModalVisible, setPwdModalVisible] = useState(false);
    const [pwdTargetUser, setPwdTargetUser] = useState<UserProfile | null>(null);
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        if (!isAdmin) {
            router.replace('/(tabs)/profile');
            return;
        }
        fetchUsers();
    }, [isAdmin]);

    const fetchUsers = async () => {
        if (!isConfigured) return;
        const supabase = getSupabase();
        if (!supabase) return;

        setLoading(true);
        const { data, error } = await supabase.rpc('admin_get_users');
        if (error) {
            console.error('Error fetching users:', error);
            Alert.alert('Fehler', 'Konnte Benutzer nicht laden: ' + error.message);
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
            Alert.alert('Fehler', 'Konnte Benutzer nicht bestätigen: ' + error.message);
            setRefreshing(false);
        } else {
            fetchUsers();
        }
    };

    const deleteUser = (user: UserProfile) => {
        Alert.alert(
            'Benutzer löschen',
            `Willst du den Benutzer ${user.email} wirklich unwiderruflich löschen?`,
            [
                { text: 'Abbrechen', style: 'cancel' },
                {
                    text: 'Löschen',
                    style: 'destructive',
                    onPress: async () => {
                        const supabase = getSupabase();
                        if (!supabase) return;
                        setRefreshing(true);
                        const { error } = await supabase.rpc('admin_delete_user', { target_id: user.id });
                        if (error) {
                            Alert.alert('Fehler', 'Konnte Benutzer nicht löschen: ' + error.message);
                            setRefreshing(false);
                        } else {
                            fetchUsers();
                        }
                    }
                }
            ]
        );
    };

    const openPwdModal = (user: UserProfile) => {
        setPwdTargetUser(user);
        setNewPassword('');
        setPwdModalVisible(true);
    };

    const handlePasswordChange = async () => {
        if (!newPassword || newPassword.length < 6) {
            Alert.alert('Fehler', 'Das Passwort muss mindestens 6 Zeichen lang sein.');
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
            Alert.alert('Fehler', 'Passwort konnte nicht geändert werden: ' + error.message);
        } else {
            Alert.alert('Erfolg', `Das Passwort für ${pwdTargetUser.email} wurde erfolgreich geändert.`);
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
                <Text style={styles.userDate}>Registriert am {new Date(u.created_at).toLocaleDateString('de-DE')}</Text>
            </View>
            <View style={styles.userActions}>
                {isPending && (
                    <BPButton title="Freischalten" style={styles.actionBtn} onPress={() => confirmUser(u.id)} />
                )}
                <BPButton title="Key" style={styles.actionBtn} variant="secondary" onPress={() => openPwdModal(u)} />
                <BPButton title="Del" style={[styles.actionBtn, { borderColor: theme.colors.accentOrange }]} variant="outline" onPress={() => deleteUser(u)} />
            </View>
        </BPCard>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Admin Dashboard', headerShown: true, headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.text }} />

            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.sectionTitle}>Offene Anfragen ({pendingUsers.length})</Text>
                {pendingUsers.length === 0 && <Text style={styles.emptyText}>Keine offenen Anfragen.</Text>}
                {pendingUsers.map(u => renderUser(u, true))}

                <View style={styles.divider} />

                <Text style={styles.sectionTitle}>Bestätigte User ({activeUsers.length})</Text>
                {activeUsers.length === 0 && <Text style={styles.emptyText}>Keine aktiven User.</Text>}
                {activeUsers.map(u => renderUser(u, false))}
            </ScrollView>

            <Modal visible={pwdModalVisible} animationType="slide" transparent>
                <View style={styles.modalBg}>
                    <BPCard style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Passwort ändern</Text>
                        <Text style={styles.modalSub}>Für Benutzer: {pwdTargetUser?.email}</Text>

                        <BPInput
                            label="Neues Passwort"
                            placeholder="Z.b. Shred123"
                            secureTextEntry
                            value={newPassword}
                            onChangeText={setNewPassword}
                        />

                        <View style={styles.modalActions}>
                            <BPButton title="Abbrechen" variant="secondary" onPress={() => setPwdModalVisible(false)} style={{ flex: 1, marginRight: 8 }} />
                            <BPButton title="Speichern" onPress={handlePasswordChange} style={{ flex: 1, marginLeft: 8 }} />
                        </View>
                    </BPCard>
                </View>
            </Modal>
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
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg },
    modalCard: { width: '100%', padding: theme.spacing.xl },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginBottom: 4 },
    modalSub: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: theme.spacing.lg },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.lg }
});
