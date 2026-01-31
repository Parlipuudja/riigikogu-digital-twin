"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import type { VoteDecision } from "@/types";

interface Vote {
  id: string;
  votingId: string;
  title: string;
  decision: VoteDecision;
  party: string;
  date: string;
}

const decisionColors: Record<VoteDecision, string> = {
  FOR: "bg-green-100 text-green-800 border-green-200",
  AGAINST: "bg-red-100 text-red-800 border-red-200",
  ABSTAIN: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ABSENT: "bg-gray-100 text-gray-800 border-gray-200",
};

export function VoteHistoryTable() {
  const t = useTranslations("history");
  const tDecisions = useTranslations("predict.decisions");

  const [votes, setVotes] = useState<Vote[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    const fetchVotes = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: (page * limit).toString(),
        });

        if (search) params.set("search", search);
        if (decision !== "all") params.set("decision", decision);

        const response = await fetch(`/api/votes?${params}`);
        const data = await response.json();

        setVotes(data.votes);
        setTotal(data.total);
      } catch (error) {
        console.error("Error fetching votes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVotes();
  }, [search, decision, page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("filters.search")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-10"
            />
          </div>
          <Select
            value={decision}
            onValueChange={(value) => {
              setDecision(value);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("filters.decision")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.all")}</SelectItem>
              <SelectItem value="FOR">{tDecisions("FOR")}</SelectItem>
              <SelectItem value="AGAINST">{tDecisions("AGAINST")}</SelectItem>
              <SelectItem value="ABSTAIN">{tDecisions("ABSTAIN")}</SelectItem>
              <SelectItem value="ABSENT">{tDecisions("ABSENT")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : votes.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.date")}</TableHead>
                    <TableHead className="w-[50%]">{t("table.bill")}</TableHead>
                    <TableHead>{t("table.decision")}</TableHead>
                    <TableHead>{t("table.party")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {votes.map((vote) => (
                    <TableRow key={vote.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(vote.date).toLocaleDateString("et-EE")}
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {vote.title}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={decisionColors[vote.decision]}
                        >
                          {tDecisions(vote.decision)}
                        </Badge>
                      </TableCell>
                      <TableCell>{vote.party}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                {total} total votes
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {page + 1} / {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
