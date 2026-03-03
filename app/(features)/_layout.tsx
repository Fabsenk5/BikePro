import { theme } from '@/constants/Colors';
import { Stack } from 'expo-router';

export default function FeaturesLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: theme.colors.surface },
                headerTintColor: theme.colors.text,
                headerTitleStyle: { fontWeight: '700' },
                contentStyle: { backgroundColor: theme.colors.background },
            }}
        />
    );
}
