"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink-100 border-t border-ink-200">
      <div className="page-container py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Copyright */}
          <div className="text-sm text-ink-500">
            &copy; {year} {t("copyright")}
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href={`/${locale}/about`}
              className="text-ink-600 hover:text-ink-900 transition-colors"
            >
              {t("about")}
            </Link>
            <Link
              href={`/${locale}/about#methodology`}
              className="text-ink-600 hover:text-ink-900 transition-colors"
            >
              {t("methodology")}
            </Link>
            <Link
              href={`/${locale}/about#api`}
              className="text-ink-600 hover:text-ink-900 transition-colors"
            >
              {t("api")}
            </Link>
            <Link
              href={`/${locale}/about#contact`}
              className="text-ink-600 hover:text-ink-900 transition-colors"
            >
              {t("contact")}
            </Link>
          </nav>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 pt-6 border-t border-ink-200">
          <p className="text-xs text-ink-400 max-w-3xl">
            {locale === "et" ? (
              <>
                Riigikogu Radar on sõltumatu analüüsitööriist, mis ei ole seotud Riigikogu ega Eesti Vabariigi valitsusega.
                Prognoosid põhinevad avalikult kättesaadavatel andmetel ja masinõppel.
                Tulemused on informatiivsed ega kujuta endast ametlikku seisukohta.
              </>
            ) : (
              <>
                Riigikogu Radar is an independent analysis tool not affiliated with the Riigikogu or the Government of Estonia.
                Predictions are based on publicly available data and machine learning.
                Results are informational and do not represent official positions.
              </>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
