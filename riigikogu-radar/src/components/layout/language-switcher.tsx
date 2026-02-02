"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  // Get the path without the locale prefix
  const pathnameWithoutLocale = pathname.replace(`/${locale}`, "") || "/";

  return (
    <div className="flex items-center text-sm">
      <Link
        href={`/et${pathnameWithoutLocale}`}
        className={`
          px-2 py-1 rounded-l border border-r-0 border-rk-500 transition-colors
          ${locale === "et"
            ? "bg-rk-600 text-white"
            : "text-rk-300 hover:text-white hover:bg-rk-600/50"
          }
        `}
      >
        ET
      </Link>
      <Link
        href={`/en${pathnameWithoutLocale}`}
        className={`
          px-2 py-1 rounded-r border border-rk-500 transition-colors
          ${locale === "en"
            ? "bg-rk-600 text-white"
            : "text-rk-300 hover:text-white hover:bg-rk-600/50"
          }
        `}
      >
        EN
      </Link>
    </div>
  );
}
