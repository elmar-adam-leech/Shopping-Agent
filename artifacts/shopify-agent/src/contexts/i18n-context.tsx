import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { getTranslations } from "@/lib/i18n";

type TranslationStrings = ReturnType<typeof getTranslations>;

interface I18nContextValue {
  locale: string;
  setLocale: (locale: string) => void;
  t: TranslationStrings;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  t: getTranslations("en"),
});

export function I18nProvider({ defaultLocale = "en", children }: { defaultLocale?: string; children: ReactNode }) {
  const [locale, setLocaleState] = useState(defaultLocale);
  const userSetLocale = useRef(false);

  useEffect(() => {
    if (!userSetLocale.current && defaultLocale) {
      setLocaleState(defaultLocale);
    }
  }, [defaultLocale]);

  const setLocale = useCallback((newLocale: string) => {
    userSetLocale.current = true;
    setLocaleState(newLocale);
  }, []);

  const t = getTranslations(locale);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
