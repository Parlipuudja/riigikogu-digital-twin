"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { PARTY_COLORS } from "@/types/domain";

interface PartyAccuracyChartProps {
  data: Record<string, { accuracy: number; count: number }>;
}

export function PartyAccuracyChart({ data }: PartyAccuracyChartProps) {
  const chartData = Object.entries(data)
    .map(([party, { accuracy, count }]) => ({
      party,
      accuracy: Number((accuracy * 100).toFixed(1)),
      count,
    }))
    .sort((a, b) => b.accuracy - a.accuracy);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="party" stroke="var(--muted-foreground)" fontSize={12} />
        <YAxis
          domain={[0, 100]}
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
          }}
          formatter={(value, _name, props) => [
            `${value}% (${(props as { payload: { count: number } }).payload.count} votes)`,
            "Accuracy",
          ]}
        />
        <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
          {chartData.map((entry) => (
            <Cell
              key={entry.party}
              fill={PARTY_COLORS[entry.party] || "#6366f1"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
