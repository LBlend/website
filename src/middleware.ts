import { defineMiddleware } from "astro:middleware";

import { defaultLocale, detectLocaleFromHeader, isValidLocale } from "./i18n";

export const onRequest = defineMiddleware(async (context, next) => {
  let locale = defaultLocale;

  // Skip header-based locale detection during prerendering (headers aren't available)
  if (!context.isPrerendered) {
    const langCookie = context.cookies.get("lang")?.value;
    locale =
      langCookie && isValidLocale(langCookie)
        ? langCookie
        : detectLocaleFromHeader(context.request.headers.get("accept-language"));
  }

  // Store locale in locals for access in components
  context.locals.locale = locale;

  return next();
});
