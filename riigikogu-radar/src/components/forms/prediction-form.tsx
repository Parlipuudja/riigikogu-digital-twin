"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export function PredictionForm() {
  const t = useTranslations("home.predict");
  const locale = useLocale();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);

    // Navigate to simulate page with the query
    const params = new URLSearchParams({ q: query });
    router.push(`/${locale}/simulate?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-content">
        <label htmlFor="prediction-query" className="sr-only">
          {t("title")}
        </label>
        <textarea
          id="prediction-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("placeholder")}
          rows={3}
          className="input resize-none"
          disabled={isLoading}
        />
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="btn-primary"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner />
                {t("analyzing")}
              </span>
            ) : (
              t("button")
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

