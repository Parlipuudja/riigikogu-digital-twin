"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";

export function Nav() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();

  const links = [
    { href: `/${locale}`, label: t("home") },
    { href: `/${locale}/predict`, label: t("predict") },
    { href: `/${locale}/history`, label: t("history") },
    { href: `/${locale}/evaluate`, label: t("evaluate") },
    { href: `/${locale}/about`, label: t("about") },
  ];

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href={`/${locale}`}
              className="text-lg font-semibold hover:opacity-80"
            >
              RK Digital Twin
            </Link>
            <div className="hidden md:flex items-center gap-6">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-sm transition-colors hover:text-foreground/80",
                    pathname === link.href
                      ? "text-foreground font-medium"
                      : "text-foreground/60"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </div>
    </nav>
  );
}
