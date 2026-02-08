"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { PARTY_NAMES } from "@/types/domain";
import { useLocale } from "next-intl";

interface MPFiltersProps {
  currentParty?: string;
  currentSort?: string;
}

export function MPFilters({ currentParty, currentSort }: MPFiltersProps) {
  const t = useTranslations("mps");
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams();
    if (currentParty && key !== "party") params.set("party", currentParty);
    if (currentSort && key !== "sort") params.set("sort", currentSort);
    if (value) params.set(key, value);
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <select
        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        value={currentParty || ""}
        onChange={(e) => updateParams("party", e.target.value)}
      >
        <option value="">{t("allParties")}</option>
        {Object.entries(PARTY_NAMES).map(([code, names]) => (
          <option key={code} value={code}>
            {names[locale as "et" | "en"]}
          </option>
        ))}
      </select>

      <select
        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        value={currentSort || "name"}
        onChange={(e) => updateParams("sort", e.target.value)}
      >
        <option value="name">{t("sortName")}</option>
        <option value="loyalty">{t("sortLoyalty")}</option>
        <option value="attendance">{t("sortAttendance")}</option>
      </select>
    </div>
  );
}
