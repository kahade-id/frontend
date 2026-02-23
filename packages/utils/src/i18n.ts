import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Default Indonesian translations (minimal fallback)
const defaultId = {
  loading: 'Memuat...',
  error: 'Terjadi kesalahan',
  retry: 'Coba lagi',
  cancel: 'Batal',
  confirm: 'Konfirmasi',
  save: 'Simpan',
  close: 'Tutup',
};

const defaultEn = {
  loading: 'Loading...',
  error: 'An error occurred',
  retry: 'Retry',
  cancel: 'Cancel',
  confirm: 'Confirm',
  save: 'Save',
  close: 'Close',
};

/**
 * Initialize i18n with default resources.
 * Apps should call addI18nResources() to add their own translations.
 */
if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        id: { translation: defaultId },
        en: { translation: defaultEn },
      },
      fallbackLng: 'id',
      lng: 'id',
      debug: false,
      interpolation: {
        escapeValue: false,
      },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
        lookupLocalStorage: 'kahade_language',
      },
    });
}

/**
 * Add app-specific translations at runtime.
 * Call this from each app's main.tsx with imported locale files.
 * 
 * @example
 * import id from './locales/id.json';
 * import en from './locales/en.json';
 * addI18nResources({ id, en });
 */
export function addI18nResources(resources: { id?: Record<string, unknown>; en?: Record<string, unknown> }): void {
  if (resources.id) {
    i18n.addResourceBundle('id', 'translation', resources.id, true, true);
  }
  if (resources.en) {
    i18n.addResourceBundle('en', 'translation', resources.en, true, true);
  }
}

export default i18n;
