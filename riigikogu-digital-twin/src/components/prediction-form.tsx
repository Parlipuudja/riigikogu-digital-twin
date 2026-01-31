"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { PredictionResponse } from "@/types";

const categories = [
  "haridus", // education
  "kultuur", // culture
  "majandus", // economy
  "sotsiaal", // social
  "riigikaitse", // defense
  "välispoliitika", // foreign policy
  "keskkond", // environment
  "tervis", // health
  "muu", // other
];

interface PredictionFormProps {
  onPrediction: (result: PredictionResponse) => void;
}

export function PredictionForm({ onPrediction }: PredictionFormProps) {
  const t = useTranslations("predict");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    billTitle: "",
    billDescription: "",
    billFullText: "",
    category: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Prediction failed");
      }

      const result: PredictionResponse = await response.json();
      onPrediction(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("form.billTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="billTitle">{t("form.billTitle")}</Label>
            <Input
              id="billTitle"
              placeholder={t("form.billTitlePlaceholder")}
              value={formData.billTitle}
              onChange={(e) =>
                setFormData({ ...formData, billTitle: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="billDescription">{t("form.billDescription")}</Label>
            <Textarea
              id="billDescription"
              placeholder={t("form.billDescriptionPlaceholder")}
              value={formData.billDescription}
              onChange={(e) =>
                setFormData({ ...formData, billDescription: e.target.value })
              }
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">{t("form.category")}</Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData({ ...formData, category: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("form.categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billFullText">{t("form.billFullText")}</Label>
            <Textarea
              id="billFullText"
              placeholder={t("form.billFullTextPlaceholder")}
              value={formData.billFullText}
              onChange={(e) =>
                setFormData({ ...formData, billFullText: e.target.value })
              }
              rows={6}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("form.submit")}...
              </>
            ) : (
              t("form.submit")
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
