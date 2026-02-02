import { VoteDecision } from "@/types";

interface VoteBadgeProps {
  vote: VoteDecision;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  locale?: "et" | "en";
}

const labels = {
  FOR: { et: "POOLT", en: "FOR" },
  AGAINST: { et: "VASTU", en: "AGAINST" },
  ABSTAIN: { et: "ERAPOOLETU", en: "ABSTAIN" },
  ABSENT: { et: "PUUDUB", en: "ABSENT" },
};

const styles = {
  FOR: "bg-vote-for-light text-vote-for",
  AGAINST: "bg-vote-against-light text-vote-against",
  ABSTAIN: "bg-vote-abstain-light text-vote-abstain",
  ABSENT: "bg-vote-absent-light text-vote-absent",
};

const sizes = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
};

export function VoteBadge({
  vote,
  size = "md",
  showLabel = true,
  locale = "en",
}: VoteBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded
        ${styles[vote]}
        ${sizes[size]}
      `}
    >
      {showLabel ? labels[vote][locale] : vote.charAt(0)}
    </span>
  );
}
