import { AlertCircle, CheckCircle2, X } from "lucide-react";

export type ActionStatus = {
  type: "success" | "error";
  message: string;
};

type ActionStatusBannerProps = {
  status: ActionStatus | null;
  onDismiss: () => void;
};

export function ActionStatusBanner({ status, onDismiss }: ActionStatusBannerProps) {
  if (!status) return null;

  const isError = status.type === "error";

  return (
    <div
      className={`mt-3 flex items-center justify-between gap-3 rounded-md border px-4 py-3 ${isError
          ? "border-red-800 bg-red-950/40 text-red-200"
          : "border-emerald-800 bg-emerald-950/40 text-emerald-200"
        }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {isError ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        <span>{status.message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded p-1 transition-colors hover:bg-zinc-800/80"
        aria-label="Dismiss message"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
