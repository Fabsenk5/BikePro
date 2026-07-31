/**
 * Dialog helpers — cross-platform confirm/alert
 * react-native-web does not implement Alert (no-op), so on web we fall back
 * to window.confirm / window.alert.
 */
import { showToast } from '@/lib/toast';
import { Alert, Platform } from 'react-native';

export function confirmDialog(title: string, message: string, cancelLabel = 'Abbrechen'): Promise<boolean> {
    if (Platform.OS === 'web') {
        return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    }
    return new Promise((resolve) => {
        Alert.alert(title, message, [
            { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
            { text: 'OK', onPress: () => resolve(true) },
        ]);
    });
}

export function showAlert(title: string, message: string): void {
    if (Platform.OS === 'web') {
        showToast(message, 'info', title);
        return;
    }
    Alert.alert(title, message);
}
