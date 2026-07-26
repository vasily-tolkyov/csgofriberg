import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

export const supportedLanguages = ['zh'] as const;
export type AppLanguage = (typeof supportedLanguages)[number];

function normalizeLanguage(value: string | null | undefined): AppLanguage | null {
  const language = value?.toLowerCase().split('-')[0];
  return supportedLanguages.find((candidate) => candidate === language) ?? null;
}

function detectLanguage(): AppLanguage {
  return 'zh';
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  initAsync: false,
  fallbackLng: 'zh',
  supportedLngs: [...supportedLanguages],
  interpolation: { escapeValue: false },
  returnNull: false,
});

function applyLanguage(language: string): void {
  const normalized = normalizeLanguage(language) ?? 'zh';
  document.documentElement.lang = normalized === 'zh' ? 'zh-CN' : normalized;
}

applyLanguage(i18n.language);
i18n.on('languageChanged', applyLanguage);

export function currentLocale(): string {
  return 'zh-CN';
}

export default i18n;
