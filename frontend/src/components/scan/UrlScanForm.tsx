"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Github, Loader2, Search } from "lucide-react";

interface UrlScanFormProps {
  repoUrl: string;
  setRepoUrl: (value: string) => void;
  isFocused: boolean;
  setIsFocused: (value: boolean) => void;
  placeholderText: string;
  loading: boolean;
  onScan: () => void;
}

/** Repository URL input + scan button + sample link. */
export function UrlScanForm({
  repoUrl,
  setRepoUrl,
  isFocused,
  setIsFocused,
  placeholderText,
  loading,
  onScan,
}: UrlScanFormProps) {
  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <Github className="h-5 w-5 text-zinc-500" />
          </div>
          <Input
            type="url"
            placeholder={isFocused ? "https://github.com/owner/repo" : (placeholderText || "https://github.com/owner/repo")}
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="h-12 rounded-md border-zinc-800 pl-12 text-base font-mono focus:border-orange-500 focus:ring-orange-500 sm:h-14"
            disabled={loading}
            onKeyDown={(e) => e.key === "Enter" && !loading && onScan()}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </div>
        <Button
          type="button"
          onClick={onScan}
          disabled={loading}
          className="h-12 rounded-md border border-zinc-700 bg-zinc-900 px-8 font-mono text-xs tracking-wide hover:border-orange-500 hover:bg-zinc-800 sm:h-14"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Scanning...</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span>Scan Repository</span>
            </span>
          )}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
        <span>Try a sample:</span>
        <button
          className="focus-ring font-mono font-medium text-orange-300 underline decoration-zinc-600 underline-offset-2 transition-colors hover:text-orange-200 hover:decoration-orange-400"
          onClick={() =>
            setRepoUrl(
              "https://github.com/shriyamchandra/Book-Store-Management-Capstone-Project"
            )
          }
        >
          Book-Store-Management
        </button>
      </div>
    </>
  );
}
