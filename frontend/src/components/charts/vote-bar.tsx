"use client";

interface VoteBarProps {
  forCount: number;
  againstCount: number;
  abstainCount: number;
  absentCount: number;
}

export function VoteBar({
  forCount,
  againstCount,
  abstainCount,
  absentCount,
}: VoteBarProps) {
  const total = forCount + againstCount + abstainCount + absentCount;
  if (total === 0) return null;

  const segments = [
    { count: forCount, color: "#22c55e", label: "For" },
    { count: againstCount, color: "#ef4444", label: "Against" },
    { count: abstainCount, color: "#f59e0b", label: "Abstain" },
    { count: absentCount, color: "#94a3b8", label: "Absent" },
  ];

  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full">
      {segments.map(
        (seg) =>
          seg.count > 0 && (
            <div
              key={seg.label}
              className="transition-all"
              style={{
                width: `${(seg.count / total) * 100}%`,
                backgroundColor: seg.color,
              }}
              title={`${seg.label}: ${seg.count}`}
            />
          )
      )}
    </div>
  );
}
