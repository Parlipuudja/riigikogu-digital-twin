"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ThumbsUp, ThumbsDown, Minus, UserX } from "lucide-react";
import type { PredictionResponse, VoteDecision } from "@/types";

interface PredictionResultProps {
  result: PredictionResponse;
}

const decisionIcons: Record<VoteDecision, React.ReactNode> = {
  FOR: <ThumbsUp className="h-6 w-6 text-green-600" />,
  AGAINST: <ThumbsDown className="h-6 w-6 text-red-600" />,
  ABSTAIN: <Minus className="h-6 w-6 text-yellow-600" />,
  ABSENT: <UserX className="h-6 w-6 text-gray-600" />,
};

const decisionColors: Record<VoteDecision, string> = {
  FOR: "bg-green-100 text-green-800 border-green-200",
  AGAINST: "bg-red-100 text-red-800 border-red-200",
  ABSTAIN: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ABSENT: "bg-gray-100 text-gray-800 border-gray-200",
};

export function PredictionResult({ result }: PredictionResultProps) {
  const t = useTranslations("predict");
  const locale = useLocale();

  const reasoning = locale === "et" && result.reasoningEt
    ? result.reasoningEt
    : result.reasoning;

  return (
    <div className="space-y-6">
      {/* Main Prediction */}
      <Card>
        <CardHeader>
          <CardTitle>{t("result.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {decisionIcons[result.prediction]}
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("result.prediction")}
                </p>
                <p className={`text-2xl font-bold px-3 py-1 rounded-md ${decisionColors[result.prediction]}`}>
                  {t(`decisions.${result.prediction}`)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">
                {t("result.confidence")}
              </p>
              <p className="text-2xl font-bold">{result.confidence.toFixed(0)}%</p>
            </div>
          </div>

          <Separator className="my-4" />

          <div>
            <p className="text-sm font-medium mb-2">{t("result.reasoning")}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {reasoning}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Similar Votes */}
      <Card>
        <CardHeader>
          <CardTitle>{t("result.similarVotes")}</CardTitle>
          <CardDescription>
            {result.similarVotes.length === 0
              ? t("result.noSimilarVotes")
              : `${result.similarVotes.length} similar votes found`}
          </CardDescription>
        </CardHeader>
        {result.similarVotes.length > 0 && (
          <CardContent>
            <div className="space-y-3">
              {result.similarVotes.map((vote, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{vote.billTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(vote.date).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={decisionColors[vote.decision]}
                    >
                      {t(`decisions.${vote.decision}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {(vote.similarity * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Relevant Speeches */}
      <Card>
        <CardHeader>
          <CardTitle>{t("result.relevantSpeeches")}</CardTitle>
          <CardDescription>
            {result.relevantSpeeches.length === 0
              ? t("result.noRelevantSpeeches")
              : `${result.relevantSpeeches.length} relevant speeches found`}
          </CardDescription>
        </CardHeader>
        {result.relevantSpeeches.length > 0 && (
          <CardContent>
            <div className="space-y-4">
              {result.relevantSpeeches.map((speech, index) => (
                <div key={index} className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{speech.topic}</p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(speech.date).toLocaleDateString(locale)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    &ldquo;{speech.excerpt}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
