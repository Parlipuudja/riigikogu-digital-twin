import { PartyCode } from "@/types";

interface PartyBadgeProps {
  party: string;
  partyCode?: PartyCode;
  size?: "sm" | "md" | "lg";
}

const partyColors: Record<PartyCode, { bg: string; text: string }> = {
  reform: { bg: "bg-party-reform", text: "text-party-reform-text" },
  ekre: { bg: "bg-party-ekre", text: "text-white" },
  centre: { bg: "bg-party-centre", text: "text-white" },
  isamaa: { bg: "bg-party-isamaa", text: "text-white" },
  sde: { bg: "bg-party-sde", text: "text-white" },
  eesti200: { bg: "bg-party-eesti200", text: "text-white" },
  other: { bg: "bg-party-other", text: "text-white" },
};

const sizes = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
};

export function PartyBadge({ party, partyCode = "other", size = "md" }: PartyBadgeProps) {
  const colors = partyColors[partyCode] || partyColors.other;

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded
        ${colors.bg} ${colors.text}
        ${sizes[size]}
      `}
    >
      {party}
    </span>
  );
}

// Utility to map party names to codes
export function getPartyCode(partyName: string): PartyCode {
  const normalized = partyName.toLowerCase();

  if (normalized.includes("reform")) return "reform";
  if (normalized.includes("ekre") || normalized.includes("konservatiivne")) return "ekre";
  if (normalized.includes("kesk") || normalized.includes("centre")) return "centre";
  if (normalized.includes("isamaa")) return "isamaa";
  if (normalized.includes("sotsiaaldemokraat") || normalized.includes("sde")) return "sde";
  if (normalized.includes("eesti 200") || normalized.includes("eesti200")) return "eesti200";

  return "other";
}
