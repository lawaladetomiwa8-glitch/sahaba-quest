"use client";

import { useLanguage, type Locale } from "./LanguageProvider";

const languageOptions: {
  code: Locale;
  label: string;
}[] = [
  { code: "en", label: "🇬🇧 English" },
  { code: "ar", label: "🇸🇦 العربية" },
  { code: "yo", label: "Yorùbá" },
  { code: "ha", label: "Hausa" },
  { code: "fr", label: "🇫🇷 Français" },
];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <select
      value={locale}
      onChange={(event) => setLocale(event.target.value as Locale)}
      aria-label="Select language"
      title="Change language"
      style={{
        height: "40px",
        maxWidth: "145px",
        padding: "0 10px",
        border: "1px solid #dfe9e7",
        borderRadius: "10px",
        background: "#ffffff",
        color: "#123b38",
        fontSize: "12px",
        fontWeight: 700,
        cursor: "pointer",
        outlineOffset: "2px",
      }}
    >
      {languageOptions.map((language) => (
        <option key={language.code} value={language.code}>
          {language.label}
        </option>
      ))}
    </select>
  );
}
