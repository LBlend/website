import { defineMiddleware } from "astro:middleware";

import { defaultLocale, detectLocaleFromHeader, isValidLocale } from "./i18n";

export const onRequest = defineMiddleware(async (context, next) => {
  // Check for lang cookie
  const cookieHeader = context.request.headers.get("cookie");
  let locale = defaultLocale;

  if (cookieHeader) {
    const cookies = Object.fromEntries(cookieHeader.split("; ").map((c) => c.split("=")));
    if (cookies.lang && isValidLocale(cookies.lang)) {
      locale = cookies.lang;
    }
  }

  // If no cookie, check Accept-Language header
  if (locale === defaultLocale && !cookieHeader?.includes("lang=")) {
    const acceptLanguage = context.request.headers.get("accept-language");
    locale = detectLocaleFromHeader(acceptLanguage);
  }

  // Store locale in locals for access in components
  context.locals.locale = locale;

  return next();
});
