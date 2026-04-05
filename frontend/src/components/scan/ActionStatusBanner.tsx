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
      className={`mt-3 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
        isError
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-green-200 bg-green-50 text-green-800"
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
        className="rounded p-1 hover:bg-black/5 transition-colors"
        aria-label="Dismiss message"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
