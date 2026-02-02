import { getRequestConfig } from "next-intl/server";

export const locales = ["et", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "et";

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./${locale}.json`)).default,
}));
