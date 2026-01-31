import createMiddleware from 'next-intl/middleware';
import { locales } from '@/i18n/request';

export default createMiddleware({
  locales,
  defaultLocale: 'et',
  localePrefix: 'always'
});

export const config = {
  matcher: ['/', '/(et|en)/:path*']
};
