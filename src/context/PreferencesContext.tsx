import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import api from '../api/axios';
import { translate, type TranslationKey } from '../i18n/translations';
import type { FeaturePreferences, LanguageCode, User } from '../types';
import { useAuth } from './AuthContext';

export const DEFAULT_FEATURES: FeaturePreferences = {
  voiceQuickAdd: true,
  budgetAlerts: true,
  savingsGoals: true,
  accountingModule: true,
  pdfReports: true,
  overdraftWarning: true,
  keyboardShortcuts: true,
};

const LOCAL_LANG_KEY = 'mw_language_pref';

interface PreferencesContextValue {
  language: LanguageCode;
  features: FeaturePreferences;
  t: (key: TranslationKey) => string;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  updateFeatureToggle: (key: keyof FeaturePreferences, value: boolean) => Promise<void>;
  updateAllFeatures: (next: FeaturePreferences) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

function getInitialLocalLanguage(): LanguageCode {
  try {
    const stored = window.localStorage.getItem(LOCAL_LANG_KEY);
    if (stored === 'en' || stored === 'roman_ur' || stored === 'ur' || stored === 'es') {
      return stored;
    }
  } catch {
    // Ignore storage unavailability
  }
  return 'en';
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user, setUser, isAuthenticated } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>(getInitialLocalLanguage);
  const [features, setFeaturesState] = useState<FeaturePreferences>({
    ...DEFAULT_FEATURES,
  });

  useEffect(() => {
    if (user) {
      if (user.language) {
        setLanguageState(user.language);
        try {
          window.localStorage.setItem(LOCAL_LANG_KEY, user.language);
        } catch {
          // Ignore storage error
        }
      }
      if (user.featurePreferences) {
        setFeaturesState({ ...DEFAULT_FEATURES, ...user.featurePreferences });
      }
    } else {
      setFeaturesState({ ...DEFAULT_FEATURES });
    }
  }, [user]);

  useEffect(() => {
    document.documentElement.lang =
      isAuthenticated && language === 'roman_ur'
        ? 'en'
        : isAuthenticated
          ? language
          : 'en';
    document.documentElement.dir =
      isAuthenticated && language === 'ur' ? 'rtl' : 'ltr';
  }, [isAuthenticated, language]);

  const setLanguage = useCallback(
    async (lang: LanguageCode) => {
      setLanguageState(lang);
      try {
        window.localStorage.setItem(LOCAL_LANG_KEY, lang);
      } catch {
        // Ignore storage error
      }
      if (isAuthenticated) {
        try {
          const res = await api.put<{ user: User }>('/auth/profile', { language: lang });
          setUser(res.data.user);
        } catch {
          // Keep optimistic local language even if network fails
        }
      }
    },
    [isAuthenticated, setUser]
  );

  const updateAllFeatures = useCallback(
    async (next: FeaturePreferences) => {
      setFeaturesState(next);
      if (isAuthenticated) {
        try {
          const res = await api.put<{ user: User }>('/auth/profile', {
            featurePreferences: next,
          });
          setUser(res.data.user);
        } catch {
          // Ignore transient error
        }
      }
    },
    [isAuthenticated, setUser]
  );

  const updateFeatureToggle = useCallback(
    async (key: keyof FeaturePreferences, value: boolean) => {
      const next = { ...features, [key]: value };
      await updateAllFeatures(next);
    },
    [features, updateAllFeatures]
  );

  const t = useCallback(
    (key: TranslationKey) => translate(language, key),
    [language]
  );

  return (
    <PreferencesContext.Provider
      value={{
        language,
        features,
        t,
        setLanguage,
        updateFeatureToggle,
        updateAllFeatures,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used inside a PreferencesProvider');
  }
  return ctx;
}
