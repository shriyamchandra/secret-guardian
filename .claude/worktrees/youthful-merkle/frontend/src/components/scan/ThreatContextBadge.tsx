import { ThreatContext } from "@/types/scan";
import { getExploitabilityColor, getExploitabilityLabel } from "@/lib/scan-utils";

export const ThreatContextBadge = ({ context }: { context?: ThreatContext }) => {
  if (!context) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${getExploitabilityColor(context.exploitability)}`}>
      <span>{getExploitabilityLabel(context.exploitability)}</span>
    </div>
  );
};
