import { Crown } from "lucide-react";
import { UpgradeRequestButton } from "./UpgradeRequestButton";

interface Props {
  studentId: string;
  classId: string;
  className: string;
}

export const UpgradeBanner = ({ studentId, classId, className }: Props) => {
  return (
    <div className="rounded-lg border bg-gradient-to-r from-warning/10 via-warning/5 to-transparent p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
          <Crown className="h-5 w-5 text-warning" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm">You're on the Free tier for {className}</p>
          <p className="text-xs text-muted-foreground">
            Unlock Pro tests, premium chapters, and all PYQ papers.
          </p>
        </div>
      </div>
      <UpgradeRequestButton studentId={studentId} classId={classId} className={className} />
    </div>
  );
};
