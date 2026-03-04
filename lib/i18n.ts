import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from '../locales/de.json';
import en from '../locales/en.json';

const LANGUAGE_KEY = '@bikepro_language';

const languageDetector = {
    type: 'languageDetector' as const,
    async: true,
    detect: async (callback: (lng: string) => void) => {
        try {
            // Priority 1: User's manual selection from AsyncStorage
            const storedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
            if (storedLang) {
                return callback(storedLang);
            }
            // Priority 2: Device Language
            const locales = getLocales();
            if (locales && locales.length > 0) {
                const deviceLang = locales[0].languageCode;
                if (deviceLang === 'de' || deviceLang === 'en') {
                    return callback(deviceLang);
                }
            }
        } catch (e) {
            console.warn('Error reading language', e);
        }
        // Fallback: Default to German
        callback('de');
    },
    init: () => { },
    cacheUserLanguage: async (lng: string) => {
        try {
            await AsyncStorage.setItem(LANGUAGE_KEY, lng);
        } catch (e) {
            console.warn('Error saving language', e);
        }
    },
};

i18n
    .use(languageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            de: { translation: de },
        },
        fallbackLng: 'de',
        compatibilityJSON: 'v4',
        interpolation: {
            escapeValue: false, // React handles XSS
        },
    });

export default i18n;
