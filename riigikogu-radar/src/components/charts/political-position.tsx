import type { PoliticalProfile, MPPoliticalProfile } from "@/types";

// Accept both old PoliticalProfile and new MPPoliticalProfile
type ProfileInput = PoliticalProfile | MPPoliticalProfile;

interface PoliticalPositionChartProps {
  profile: ProfileInput;
  locale: "et" | "en";
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

export function PoliticalPositionChart({ profile, locale }: PoliticalPositionChartProps) {
  // Normalize values to -1 to 1 range
  let economicValue: number;
  let socialValue: number;

  if (isMPPoliticalProfile(profile)) {
    // MPPoliticalProfile uses -100 to 100 scale
    economicValue = profile.economicScale / 100;
    socialValue = profile.socialScale / 100;
  } else {
    // PoliticalProfile uses -1 to 1 scale
    economicValue = profile.economicAxis;
    socialValue = profile.socialAxis;
  }

  const axes = [
    {
      key: "economic",
      value: economicValue,
      leftLabel: labels.left[locale],
      rightLabel: labels.right[locale],
    },
    {
      key: "social",
      value: socialValue,
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
          </div>

          <div className="relative">
            {/* Track */}
            <div className="h-2 bg-ink-100 rounded-full">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-ink-300" />
            </div>

            {/* Marker */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-rk-600 rounded-full border-2 border-white shadow-sm"
              style={{
                left: `calc(${((axis.value + 1) / 2) * 100}% - 8px)`,
              }}
            />

            {/* Labels */}
            <div className="flex justify-between mt-1 text-xs text-ink-400">
              <span>{axis.leftLabel}</span>
              <span>{axis.rightLabel}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
