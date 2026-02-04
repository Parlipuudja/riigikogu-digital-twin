"use client";

import { useMemo } from "react";
import type { Prediction, PartyCode } from "@/types";
import { getPartyCode } from "./party-badge";

interface SeatPlanProps {
  predictions: Prediction[];
  locale?: string;
}

// Party order in hemicycle (left to right, traditional political spectrum)
const PARTY_ORDER: PartyCode[] = [
  "sde",      // Left
  "centre",   // Centre-left
  "eesti200", // Centre
  "reform",   // Centre-right
  "isamaa",   // Right
  "ekre",     // Far right
  "other",    // Non-affiliated (separate section)
];

// Party colors for background sections
const PARTY_SECTION_COLORS: Record<PartyCode, string> = {
  sde: "rgba(231, 76, 60, 0.1)",      // Red tint
  centre: "rgba(46, 204, 113, 0.1)",  // Green tint
  eesti200: "rgba(52, 152, 219, 0.1)", // Blue tint
  reform: "rgba(241, 196, 15, 0.1)",  // Yellow tint
  isamaa: "rgba(52, 73, 94, 0.1)",    // Dark tint
  ekre: "rgba(52, 73, 94, 0.15)",     // Darker tint
  other: "rgba(149, 165, 166, 0.1)",  // Gray tint
};

// Vote colors
const VOTE_COLORS = {
  FOR: "#22c55e",      // Green
  AGAINST: "#ef4444",  // Red
  ABSTAIN: "#eab308",  // Yellow
  ABSENT: "#94a3b8",   // Gray
};

// Estonian party names
const PARTY_NAMES: Record<PartyCode, { et: string; en: string }> = {
  sde: { et: "SDE", en: "SDE" },
  centre: { et: "Kesk", en: "Centre" },
  eesti200: { et: "E200", en: "E200" },
  reform: { et: "Reform", en: "Reform" },
  isamaa: { et: "Isamaa", en: "Isamaa" },
  ekre: { et: "EKRE", en: "EKRE" },
  other: { et: "Fraktsioonitud", en: "Non-affiliated" },
};

interface SeatProps {
  prediction: Prediction;
  x: number;
  y: number;
  size: number;
}

function Seat({ prediction, x, y, size }: SeatProps) {
  const color = VOTE_COLORS[prediction.vote] || VOTE_COLORS.ABSENT;
  const isHighConfidence = prediction.confidence >= 80;
  const isLowConfidence = prediction.confidence < 50;

  return (
    <g className="seat" style={{ cursor: "pointer" }}>
      <title>
        {prediction.mpName} ({prediction.party})
        {"\n"}Vote: {prediction.vote}
        {"\n"}Confidence: {prediction.confidence}%
        {prediction.reasoning && `\n${prediction.reasoning}`}
      </title>
      <circle
        cx={x}
        cy={y}
        r={size}
        fill={color}
        stroke={isLowConfidence ? "#64748b" : color}
        strokeWidth={isLowConfidence ? 2 : 1}
        strokeDasharray={isLowConfidence ? "2,2" : "none"}
        opacity={isHighConfidence ? 1 : 0.7}
      />
      {/* Inner dot for high confidence */}
      {isHighConfidence && (
        <circle
          cx={x}
          cy={y}
          r={size * 0.4}
          fill="white"
          opacity={0.4}
        />
      )}
    </g>
  );
}

export function SeatPlan({ predictions, locale = "et" }: SeatPlanProps) {
  // Group predictions by party
  const groupedByParty = useMemo(() => {
    const groups = new Map<PartyCode, Prediction[]>();

    for (const partyCode of PARTY_ORDER) {
      groups.set(partyCode, []);
    }

    for (const pred of predictions) {
      const partyCode = getPartyCode(pred.party);
      const list = groups.get(partyCode) || groups.get("other")!;
      list.push(pred);
    }

    // Sort each party group: FOR first, then AGAINST, then others
    Array.from(groups.entries()).forEach(([, list]) => {
      list.sort((a, b) => {
        const order: Record<string, number> = { FOR: 0, AGAINST: 1, ABSTAIN: 2, ABSENT: 3 };
        return (order[a.vote] || 3) - (order[b.vote] || 3);
      });
    });

    return groups;
  }, [predictions]);

  // Calculate vote counts for legend
  const voteCounts = useMemo(() => {
    return {
      for: predictions.filter(p => p.vote === "FOR").length,
      against: predictions.filter(p => p.vote === "AGAINST").length,
      abstain: predictions.filter(p => p.vote === "ABSTAIN").length,
      absent: predictions.filter(p => p.vote === "ABSENT").length,
    };
  }, [predictions]);

  // SVG dimensions
  const width = 600;
  const height = 350;
  const centerX = width / 2;
  const centerY = height - 50;

  // Hemicycle parameters
  const innerRadius = 80;
  const outerRadius = 220;
  const startAngle = Math.PI; // 180 degrees (left)
  const endAngle = 0; // 0 degrees (right)

  // Calculate seat positions
  const seatElements = useMemo(() => {
    const elements: JSX.Element[] = [];
    const seatSize = 8;

    // Calculate total MPs and angle per party
    let totalMPs = 0;
    const partyCounts: [PartyCode, number][] = [];

    for (const partyCode of PARTY_ORDER) {
      const count = groupedByParty.get(partyCode)?.length || 0;
      if (count > 0) {
        partyCounts.push([partyCode, count]);
        totalMPs += count;
      }
    }

    const angleRange = startAngle - endAngle;
    let currentAngle = startAngle;

    for (const [partyCode, count] of partyCounts) {
      const partyAngleRange = (count / totalMPs) * angleRange;
      const preds = groupedByParty.get(partyCode) || [];

      // Arrange MPs in rows within party section
      const rows = Math.ceil(Math.sqrt(count / 2));
      const seatsPerRow = Math.ceil(count / rows);

      let seatIndex = 0;
      for (let row = 0; row < rows && seatIndex < count; row++) {
        const radius = innerRadius + ((outerRadius - innerRadius) / rows) * (row + 0.5);
        const seatsInThisRow = Math.min(seatsPerRow, count - seatIndex);

        for (let s = 0; s < seatsInThisRow && seatIndex < count; s++) {
          const angleOffset = partyAngleRange * ((s + 0.5) / seatsInThisRow);
          const angle = currentAngle - angleOffset;

          const x = centerX + radius * Math.cos(angle);
          const y = centerY - radius * Math.sin(angle);

          elements.push(
            <Seat
              key={`${partyCode}-${seatIndex}`}
              prediction={preds[seatIndex]}
              x={x}
              y={y}
              size={seatSize}
            />
          );

          seatIndex++;
        }
      }

      currentAngle -= partyAngleRange;
    }

    return elements;
  }, [groupedByParty, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle]);

  // Party labels
  const partyLabels = useMemo(() => {
    const labels: JSX.Element[] = [];
    let totalMPs = 0;
    const partyCounts: [PartyCode, number][] = [];

    for (const partyCode of PARTY_ORDER) {
      const count = groupedByParty.get(partyCode)?.length || 0;
      if (count > 0) {
        partyCounts.push([partyCode, count]);
        totalMPs += count;
      }
    }

    const angleRange = startAngle - endAngle;
    let currentAngle = startAngle;

    for (const [partyCode, count] of partyCounts) {
      const partyAngleRange = (count / totalMPs) * angleRange;
      const midAngle = currentAngle - partyAngleRange / 2;
      const labelRadius = outerRadius + 25;

      const x = centerX + labelRadius * Math.cos(midAngle);
      const y = centerY - labelRadius * Math.sin(midAngle);

      labels.push(
        <text
          key={`label-${partyCode}`}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-ink-600 text-xs font-medium"
        >
          {PARTY_NAMES[partyCode]?.[locale as "et" | "en"] || partyCode}
        </text>
      );

      currentAngle -= partyAngleRange;
    }

    return labels;
  }, [groupedByParty, centerX, centerY, outerRadius, startAngle, endAngle, locale]);

  return (
    <div className="seat-plan">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-2xl mx-auto">
        {/* Background arc guides */}
        <path
          d={`M ${centerX - outerRadius} ${centerY} A ${outerRadius} ${outerRadius} 0 0 1 ${centerX + outerRadius} ${centerY}`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="1"
        />
        <path
          d={`M ${centerX - innerRadius} ${centerY} A ${innerRadius} ${innerRadius} 0 0 1 ${centerX + innerRadius} ${centerY}`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="1"
        />

        {/* Seats */}
        {seatElements}

        {/* Party labels */}
        {partyLabels}

        {/* Center podium */}
        <rect
          x={centerX - 30}
          y={centerY - 15}
          width={60}
          height={30}
          rx={4}
          fill="#1e293b"
        />
        <text
          x={centerX}
          y={centerY + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-white text-xs font-bold"
        >
          101
        </text>
      </svg>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: VOTE_COLORS.FOR }} />
          <span className="text-ink-600">
            {locale === "et" ? "Poolt" : "For"} ({voteCounts.for})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: VOTE_COLORS.AGAINST }} />
          <span className="text-ink-600">
            {locale === "et" ? "Vastu" : "Against"} ({voteCounts.against})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: VOTE_COLORS.ABSTAIN }} />
          <span className="text-ink-600">
            {locale === "et" ? "Erapooletu" : "Abstain"} ({voteCounts.abstain})
          </span>
        </div>
        {voteCounts.absent > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: VOTE_COLORS.ABSENT }} />
            <span className="text-ink-600">
              {locale === "et" ? "Puudub" : "Absent"} ({voteCounts.absent})
            </span>
          </div>
        )}
      </div>

      {/* Confidence note */}
      <p className="text-center text-xs text-ink-400 mt-2">
        {locale === "et"
          ? "Täis ring = kõrge kindlus (≥80%), katkendlik = madal kindlus (<50%)"
          : "Solid = high confidence (≥80%), dashed = low confidence (<50%)"
        }
      </p>
    </div>
  );
}
