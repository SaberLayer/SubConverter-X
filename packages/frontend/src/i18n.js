import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';
// Detect browser language
const getBrowserLanguage = () => {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('zh')) {
        return 'zh';
    }
    return 'en';
};
// Get saved language from localStorage or use browser language
const savedLanguage = localStorage.getItem('language') || getBrowserLanguage();
i18n
    .use(initReactI18next)
    .init({
    resources: {
        en: {
            translation: en,
        },
        zh: {
            translation: zh,
        },
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
        escapeValue: false, // React already escapes values
    },
});
// Save language preference when it changes
i18n.on('languageChanged', (lng) => {
    localStorage.setItem('language', lng);
    document.documentElement.lang = lng;
});
export default i18n;
