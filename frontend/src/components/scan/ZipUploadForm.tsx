"use client";

import { Button } from "@/components/ui/button";
import { FolderArchive, Loader2, Search, Upload, X } from "lucide-react";

interface ZipUploadFormProps {
  uploadedFile: File | null;
  onClearFile: () => void;
  dragActive: boolean;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
  onScan: () => void;
}

/** ZIP drag-and-drop zone + file picker + scan button. */
export function ZipUploadForm({
  uploadedFile,
  onClearFile,
  dragActive,
  handleDrag,
  handleDrop,
  handleFileSelect,
  loading,
  onScan,
}: ZipUploadFormProps) {
  return (
    <>
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative rounded-xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
          dragActive
            ? "border-orange-500 bg-orange-950/30 ring-4 ring-orange-500/10 scale-[0.99]"
            : uploadedFile
            ? "border-emerald-600 bg-emerald-950/20"
            : "border-zinc-800 bg-zinc-900/40 hover:border-orange-500/40 hover:bg-zinc-900/60"
        }`}
      >
        {uploadedFile ? (
          <div className="flex flex-col items-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-md border border-emerald-800 bg-emerald-950/50">
              <FolderArchive className="h-7 w-7 text-emerald-300" />
            </div>
            <p className="mb-1 text-sm font-mono text-zinc-100">
              {uploadedFile.name}
            </p>
            <p className="mb-3 text-xs font-mono text-zinc-500">
              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              onClick={onClearFile}
              className="focus-ring inline-flex items-center gap-1 text-sm text-red-300 transition-colors hover:text-red-200"
            >
              <X className="h-4 w-4" /> Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
              <Upload className="h-7 w-7 text-zinc-500" />
            </div>
            <p className="mb-1 text-sm font-medium text-zinc-100">
              Drag and drop your ZIP file here
            </p>
            <p className="mb-3 text-xs text-zinc-500">or click to browse</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-mono text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800">
              <FolderArchive className="h-4 w-4" /> Browse Files
              <input
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>
      <div className="mt-4">
        <Button
          type="button"
          onClick={onScan}
          disabled={loading || !uploadedFile}
          className="h-12 w-full rounded-md border border-zinc-700 bg-zinc-900 px-8 font-mono text-xs tracking-wide hover:border-orange-500 hover:bg-zinc-800 sm:h-14 sm:w-auto"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Scanning...</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span>Scan ZIP File</span>
            </span>
          )}
        </Button>
      </div>
    </>
  );
}
