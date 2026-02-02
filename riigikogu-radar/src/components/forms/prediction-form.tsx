"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

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
                Analyzing...
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

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
