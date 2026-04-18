"use client";

import { useState } from "react";
import { FileText, ChevronDown } from "lucide-react";
import { Finding } from "@/types/scan";
import { ScanFindingItem } from "./ScanFindingItem";

interface FileFindingsAccordionProps {
  filePath: string;
  fileFindings: Finding[];
  revealedSecrets: Set<string>;
  copiedKey: string | null;
  toggleRevealSecret: (key: string) => void;
  copyText: (text: string, key: string) => void;
  defaultOpen?: boolean;
}

export const FileFindingsAccordion = ({
  filePath,
  fileFindings,
  revealedSecrets,
  copiedKey,
  toggleRevealSecret,
  copyText,
  defaultOpen = false,
}: FileFindingsAccordionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const getFindingKey = (finding: Finding) =>
    [
      finding.file_path ?? "",
      String(finding.line_number ?? 0),
      finding.secret_type ?? "",
      finding.scanner_source ?? "",
      finding.raw_value ?? finding.leaked_line ?? "",
    ].join("|");

  return (
    <details
      className="group interactive-card deferred-render overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/50"
      open={isOpen}
      onToggle={(event) => setIsOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="focus-ring list-none cursor-pointer select-none">
        <div className="flex items-center justify-between gap-3 p-5 transition-colors hover:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900">
              <FileText className="h-5 w-5 text-zinc-300" />
            </div>
            <div>
              <div className="font-mono text-sm font-semibold text-zinc-100">
                {filePath}
              </div>
              <div className="text-xs text-zinc-500">
                {fileFindings.length} finding{fileFindings.length > 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Severity badges */}
            {fileFindings.some((f) => f.severity === "CRITICAL") && (
              <span className="rounded-md border border-red-700 bg-red-950/60 px-2 py-1 text-xs font-bold text-red-200">
                CRITICAL
              </span>
            )}
            {fileFindings.some((f) => f.severity === "HIGH") && (
              <span className="rounded-md border border-red-800 bg-red-950/40 px-2 py-1 text-xs font-bold text-red-300">
                HIGH
              </span>
            )}
            <ChevronDown className="h-5 w-5 text-zinc-500 transition-transform duration-200 group-open:rotate-180" />
          </div>
        </div>
      </summary>

      {isOpen && (
        <div className="divide-y divide-zinc-800 border-t border-zinc-800 bg-zinc-900/20">
          {fileFindings.map((f, idx) => {
            const findingKey = getFindingKey(f);
            const isRevealed = revealedSecrets.has(findingKey);

            return (
              <ScanFindingItem
                key={`${findingKey}-${idx}`}
                finding={f}
                findingKey={findingKey}
                isRevealed={isRevealed}
                copiedKey={copiedKey}
                toggleRevealSecret={toggleRevealSecret}
                copyText={copyText}
              />
            );
          })}
        </div>
      )}
    </details>
  );
};
