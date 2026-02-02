"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "./language-switcher";

export function Header() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();

  const navItems = [
    { href: `/${locale}`, label: t("home"), exact: true },
    { href: `/${locale}/mps`, label: t("mps") },
    { href: `/${locale}/drafts`, label: t("drafts") },
    { href: `/${locale}/simulate`, label: t("simulate") },
    { href: `/${locale}/insights`, label: t("insights") },
    { href: `/${locale}/accuracy`, label: t("accuracy") },
    { href: `/${locale}/about`, label: t("about") },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="header-bar">
      {/* Top bar with logo */}
      <div className="border-b border-rk-600">
        <div className="page-container">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href={`/${locale}`} className="flex items-center gap-3 text-white hover:text-white">
              <RadarIcon className="h-8 w-8" />
              <div>
                <div className="font-semibold text-lg leading-tight">Riigikogu Radar</div>
                <div className="text-xs text-rk-300 leading-tight">Parliamentary Intelligence</div>
              </div>
            </Link>

            {/* Right side */}
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="bg-rk-800">
        <div className="page-container">
          <nav className="flex items-center gap-1 h-12 -mx-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  px-3 py-2 text-sm font-medium rounded transition-colors
                  ${isActive(item.href, item.exact)
                    ? "bg-rk-700 text-white"
                    : "text-rk-200 hover:text-white hover:bg-rk-700/50"
                  }
                `}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

function RadarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Radar circles */}
      <circle cx="12" cy="12" r="10" opacity="0.3" />
      <circle cx="12" cy="12" r="6" opacity="0.5" />
      <circle cx="12" cy="12" r="2" />
      {/* Radar sweep line */}
      <line x1="12" y1="12" x2="12" y2="2" />
      {/* Blip */}
      <circle cx="16" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}
