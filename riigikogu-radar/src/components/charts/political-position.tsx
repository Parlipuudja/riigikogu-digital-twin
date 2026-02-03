import type { PoliticalProfile, MPPoliticalProfile } from "@/types";

// Accept both old PoliticalProfile and new MPPoliticalProfile
type ProfileInput = PoliticalProfile | MPPoliticalProfile;

interface PoliticalPositionChartProps {
  profile: ProfileInput;
  locale: "et" | "en";
  variant?: "compass" | "bars";
}

const labels = {
  economic: { et: "Majanduspoliitika", en: "Economic policy" },
  social: { et: "Sotsiaalpoliitika", en: "Social policy" },
  left: { et: "Vasak", en: "Left" },
  right: { et: "Parem", en: "Right" },
  liberal: { et: "Liberaalne", en: "Liberal" },
  conservative: { et: "Konservatiivne", en: "Conservative" },
};

// Check if profile is new MPPoliticalProfile (has economicScale)
function isMPPoliticalProfile(p: ProfileInput): p is MPPoliticalProfile {
  return "economicScale" in p;
}

function getNormalizedValues(profile: ProfileInput): { economic: number; social: number } {
  if (isMPPoliticalProfile(profile)) {
    return {
      economic: profile.economicScale / 100,
      social: profile.socialScale / 100,
    };
  }
  return {
    economic: profile.economicAxis,
    social: profile.socialAxis,
  };
}

// 2D Political Compass visualization
function PoliticalCompass({ profile, locale }: { profile: ProfileInput; locale: "et" | "en" }) {
  const { economic, social } = getNormalizedValues(profile);

  // Convert -1 to 1 range to percentage (0-100)
  const x = ((economic + 1) / 2) * 100;
  const y = ((1 - social) / 2) * 100; // Invert Y so conservative is at top

  return (
    <div className="relative">
      {/* Compass grid */}
      <div className="relative w-full aspect-square max-w-[280px] mx-auto">
        {/* Background quadrants - Conservative at top, Liberal at bottom */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          <div className="bg-red-50 rounded-tl-lg" title={`${labels.left[locale]} + ${labels.conservative[locale]}`} />
          <div className="bg-blue-50 rounded-tr-lg" title={`${labels.right[locale]} + ${labels.conservative[locale]}`} />
          <div className="bg-green-50 rounded-bl-lg" title={`${labels.left[locale]} + ${labels.liberal[locale]}`} />
          <div className="bg-amber-50 rounded-br-lg" title={`${labels.right[locale]} + ${labels.liberal[locale]}`} />
        </div>

        {/* Grid lines */}
        <div className="absolute inset-0">
          {/* Center lines */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-ink-200" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-ink-200" />
          {/* Quadrant lines */}
          <div className="absolute left-1/4 top-0 bottom-0 w-px bg-ink-100" />
          <div className="absolute left-3/4 top-0 bottom-0 w-px bg-ink-100" />
          <div className="absolute top-1/4 left-0 right-0 h-px bg-ink-100" />
          <div className="absolute top-3/4 left-0 right-0 h-px bg-ink-100" />
        </div>

        {/* Position marker */}
        <div
          className="absolute w-6 h-6 -ml-3 -mt-3 z-10"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <div className="w-full h-full bg-rk-600 rounded-full border-3 border-white shadow-lg flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
        </div>

        {/* Axis labels */}
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full text-xs text-ink-500 font-medium">
          {labels.left[locale]}
        </div>
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full text-xs text-ink-500 font-medium">
          {labels.right[locale]}
        </div>
        <div className="absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full text-xs text-ink-500 font-medium">
          {labels.conservative[locale]}
        </div>
        <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 translate-y-full text-xs text-ink-500 font-medium">
          {labels.liberal[locale]}
        </div>
      </div>

      {/* Numeric values */}
      <div className="mt-6 flex justify-center gap-8 text-sm">
        <div className="text-center">
          <div className="text-xs text-ink-500 mb-1">{labels.economic[locale]}</div>
          <div className="font-mono font-medium text-ink-900">
            {economic > 0 ? "+" : ""}{(economic * 100).toFixed(0)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-ink-500 mb-1">{labels.social[locale]}</div>
          <div className="font-mono font-medium text-ink-900">
            {social > 0 ? "+" : ""}{(social * 100).toFixed(0)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Original bar-style visualization
function PoliticalBars({ profile, locale }: { profile: ProfileInput; locale: "et" | "en" }) {
  const { economic, social } = getNormalizedValues(profile);

  const axes = [
    {
      key: "economic",
      value: economic,
      leftLabel: labels.left[locale],
      rightLabel: labels.right[locale],
    },
    {
      key: "social",
      value: social,
      leftLabel: labels.liberal[locale],
      rightLabel: labels.conservative[locale],
    },
  ];

  return (
    <div className="space-y-5">
      {axes.map((axis) => (
        <div key={axis.key}>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-ink-700">
              {labels[axis.key as keyof typeof labels][locale]}
            </span>
            <span className="font-mono text-xs text-ink-500">
              {axis.value > 0 ? "+" : ""}{(axis.value * 100).toFixed(0)}
            </span>
          </div>

          <div className="relative">
            {/* Track */}
            <div className="h-3 bg-gradient-to-r from-blue-100 via-ink-100 to-red-100 rounded-full">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-ink-300" />
            </div>

            {/* Marker */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-rk-600 rounded-full border-2 border-white shadow-md"
              style={{
                left: `calc(${((axis.value + 1) / 2) * 100}% - 10px)`,
              }}
            />

            {/* Labels */}
            <div className="flex justify-between mt-2 text-xs text-ink-400">
              <span>{axis.leftLabel}</span>
              <span>{axis.rightLabel}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PoliticalPositionChart({ profile, locale, variant = "compass" }: PoliticalPositionChartProps) {
  if (variant === "bars") {
    return <PoliticalBars profile={profile} locale={locale} />;
  }
  return <PoliticalCompass profile={profile} locale={locale} />;
}
