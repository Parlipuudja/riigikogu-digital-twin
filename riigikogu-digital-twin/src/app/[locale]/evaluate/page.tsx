"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import type { VoteDecision } from "@/types";

interface EvaluationData {
  totalVotes: number;
  distribution: Record<VoteDecision, { count: number; percentage: number }>;
  baselineAccuracy: number;
  majorityClass: string;
  recentVotes: Array<{
    id: string;
    title: string;
    decision: string;
    date: string;
  }>;
}

const decisionColors: Record<VoteDecision, string> = {
  FOR: "bg-green-100 text-green-800 border-green-200",
  AGAINST: "bg-red-100 text-red-800 border-red-200",
  ABSTAIN: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ABSENT: "bg-gray-100 text-gray-800 border-gray-200",
};

export default function EvaluatePage() {
  const t = useTranslations("evaluate");
  const tDecisions = useTranslations("predict.decisions");
  const locale = useLocale();

  const [data, setData] = useState<EvaluationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvaluation = async () => {
      try {
        const response = await fetch("/api/evaluate");
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching evaluation:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvaluation();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Failed to load evaluation data</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        {/* Metrics Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("metrics.totalVotes")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{data.totalVotes}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Baseline Accuracy</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {data.baselineAccuracy.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                (always predicting {data.majorityClass})
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Most Common Vote</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge
                variant="outline"
                className={decisionColors[data.majorityClass as VoteDecision]}
              >
                {tDecisions(data.majorityClass as VoteDecision)}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Distribution */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t("metrics.byDecision")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(Object.keys(data.distribution) as VoteDecision[]).map(
                (decision) => (
                  <div
                    key={decision}
                    className="text-center p-4 rounded-lg bg-muted"
                  >
                    <Badge
                      variant="outline"
                      className={decisionColors[decision]}
                    >
                      {tDecisions(decision)}
                    </Badge>
                    <p className="text-2xl font-bold mt-2">
                      {data.distribution[decision].count}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {data.distribution[decision].percentage.toFixed(1)}%
                    </p>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Votes Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t("table.title")}</CardTitle>
            <CardDescription>
              Most recent voting records in the database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.date")}</TableHead>
                    <TableHead>{t("table.bill")}</TableHead>
                    <TableHead>{t("table.actual")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentVotes.map((vote) => (
                    <TableRow key={vote.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(vote.date).toLocaleDateString(locale)}
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {vote.title}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            decisionColors[vote.decision as VoteDecision]
                          }
                        >
                          {tDecisions(vote.decision as VoteDecision)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
