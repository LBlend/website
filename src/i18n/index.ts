import type { Locale, Translations } from "./types";
import { defaultLocale, locales } from "./types";

import en from "./locales/en.json";
import ko from "./locales/ko.json";
import no from "./locales/no.json";

export { defaultLocale, localeNames, locales } from "./types";
export type { Locale, Translations } from "./types";

const translations: Record<Locale, Translations> = {
  en: en as Translations,
  no: no as Translations,
  ko: ko as Translations,
};

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export function getTranslations(locale: Locale): Translations {
  return translations[locale] || translations[defaultLocale];
}

type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T]: K extends string ? (T[K] extends object ? `${K}.${NestedKeyOf<T[K]>}` : K) : never;
    }[keyof T]
  : never;

export type TranslationKey = NestedKeyOf<Translations>;

export function useTranslations(locale: Locale) {
  const trans = getTranslations(locale);

  return function t(key: TranslationKey, params?: Record<string, string | number>): string {
    const keys = key.split(".");
    let value: unknown = trans;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    if (typeof value !== "string") {
      console.warn(`Translation key is not a string: ${key}`);
      return key;
    }

    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
        return params[paramKey]?.toString() ?? `{${paramKey}}`;
      });
    }

    return value;
  };
}

export function detectLocaleFromHeader(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;

  const languages = acceptLanguage
    .split(",")
    .map((lang) => {
      const [code, priority] = lang.trim().split(";q=");
      return {
        code: code.split("-")[0].toLowerCase(),
        priority: priority ? parseFloat(priority) : 1,
      };
    })
    .sort((a, b) => b.priority - a.priority);

  for (const lang of languages) {
    if (isValidLocale(lang.code)) {
      return lang.code;
    }
  }

  return defaultLocale;
}
