"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PredictionForm } from "@/components/prediction-form";
import { PredictionResult } from "@/components/prediction-result";
import type { PredictionResponse } from "@/types";

export default function PredictPage() {
  const t = useTranslations("predict");
  const [result, setResult] = useState<PredictionResponse | null>(null);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="grid gap-8">
          <PredictionForm onPrediction={setResult} />

          {result && <PredictionResult result={result} />}
        </div>
      </div>
    </div>
  );
}
