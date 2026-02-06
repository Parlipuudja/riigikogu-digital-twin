import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { MP } from "@/types/domain";
import { PARTY_COLORS, PARTY_NAMES } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface MPCardProps {
  mp: MP;
  locale: string;
}

export function MPCard({ mp, locale }: MPCardProps) {
  const partyName =
    PARTY_NAMES[mp.partyCode]?.[locale as "et" | "en"] || mp.partyCode;
  const partyColor = PARTY_COLORS[mp.partyCode] || "#999";

  return (
    <Link href={`/mps/${mp.slug}`}>
      <Card className="transition-shadow hover:shadow-md h-full">
        <CardContent className="flex items-start gap-4 p-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
            {mp.photoUrl ? (
              <Image
                src={mp.photoUrl}
                alt={`${mp.firstName} ${mp.lastName}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground">
                {mp.firstName[0]}
                {mp.lastName[0]}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">
              {mp.firstName} {mp.lastName}
            </h3>
            <Badge
              className="mt-1 text-white"
              style={{ backgroundColor: partyColor }}
            >
              {partyName}
            </Badge>
            {mp.stats && (
              <div className="mt-2 grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                <span>
                  {(mp.stats.attendanceRate * 100).toFixed(0)}% attendance
                </span>
                <span>
                  {(mp.stats.partyAlignmentRate * 100).toFixed(0)}% loyalty
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
