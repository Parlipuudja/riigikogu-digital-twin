interface ConfidenceBarProps {
  value: number; // 0-100
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ConfidenceBar({
  value,
  showValue = true,
  size = "md",
}: ConfidenceBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  const getColor = () => {
    if (clampedValue >= 80) return "bg-conf-high";
    if (clampedValue >= 50) return "bg-conf-medium";
    return "bg-conf-low";
  };

  const getTextColor = () => {
    if (clampedValue >= 80) return "text-conf-high";
    if (clampedValue >= 50) return "text-conf-medium";
    return "text-conf-low";
  };

  const heights = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-ink-200 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${getColor()}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showValue && (
        <span className={`text-sm font-mono font-medium tabular-nums ${getTextColor()}`}>
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  );
}

interface ConfidenceGaugeProps {
  value: number;
  label?: string;
}

export function ConfidenceGauge({ value, label }: ConfidenceGaugeProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  const getColor = () => {
    if (clampedValue >= 80) return "text-conf-high";
    if (clampedValue >= 50) return "text-conf-medium";
    return "text-conf-low";
  };

  return (
    <div className="flex flex-col items-center">
      <div className={`text-3xl font-mono font-bold tabular-nums ${getColor()}`}>
        {Math.round(clampedValue)}%
      </div>
      {label && <div className="text-xs text-ink-500 mt-1">{label}</div>}
    </div>
  );
}
