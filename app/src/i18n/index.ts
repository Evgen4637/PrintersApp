import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ru from './locales/ru.json';
import en from './locales/en.json';

const LANGUAGE_KEY = '@app_language';

const resources = {
  ru: { translation: ru },
  en: { translation: en },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'ru',
    fallbackLng: 'ru',
    interpolation: {
      escapeValue: false,
    },
  });

AsyncStorage.getItem(LANGUAGE_KEY)
  .then((savedLang) => {
    if (savedLang && (savedLang === 'ru' || savedLang === 'en')) {
      i18n.changeLanguage(savedLang);
    }
  })
  .catch((err) => {
    console.error('Failed to load language from AsyncStorage:', err);
  });

export const changeAppLanguage = async (lang: 'ru' | 'en') => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    await i18n.changeLanguage(lang);
  } catch (err) {
    console.error('Failed to save language to AsyncStorage:', err);
  }
};

export default i18n;
