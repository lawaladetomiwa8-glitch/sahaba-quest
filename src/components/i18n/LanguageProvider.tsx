"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { NextIntlClientProvider } from "next-intl";

import en from "@/i18n/messages/en.json";
import ar from "@/i18n/messages/ar.json";
import yo from "@/i18n/messages/yo.json";
import ha from "@/i18n/messages/ha.json";
import fr from "@/i18n/messages/fr.json";

export const SUPPORTED_LOCALES = ["en", "ar", "yo", "ha", "fr"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

const messages = {
  en,
  ar,
  yo,
  ha,
  fr,
};

type LanguageContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

function isSupportedLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

function applyDocumentLanguage(locale: Locale) {
  if (typeof document === "undefined") return;

  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}

export default function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const savedLocale = localStorage.getItem("sahaba-quest-language");

      if (savedLocale && isSupportedLocale(savedLocale)) {
        setLocaleState(savedLocale);
        applyDocumentLanguage(savedLocale);
      }
    } catch {
      // Continue using English if browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    applyDocumentLanguage(locale);
  }, [locale]);

  const setLocale = (nextLocale: Locale) => {
    if (!isSupportedLocale(nextLocale)) return;

    setLocaleState(nextLocale);
    applyDocumentLanguage(nextLocale);

    try {
      localStorage.setItem("sahaba-quest-language", nextLocale);
    } catch {
      // Language still changes for the current session.
    }
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages[locale]}
      >
        {children}
      </NextIntlClientProvider>
    </LanguageContext.Provider>
  );
}
