import BPCard from '@/components/ui/BPCard';
import BPButton from '@/components/ui/BPButton';
import { theme } from '@/constants/Colors';
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('not_found.title') }} />
      <View style={styles.container}>
        <BPCard style={styles.card}>
          <Text style={styles.title}>{t('not_found.title')}</Text>
          <Text style={styles.message}>{t('not_found.message')}</Text>
          <BPButton
            title={t('not_found.home')}
            onPress={() => router.replace('/')}
            fullWidth
          />
        </BPCard>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  message: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
