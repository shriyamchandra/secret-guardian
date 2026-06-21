"use client";

import { useState } from "react";

/** ZIP drag-and-drop / file-picker state for upload scans. */
export function useZipUpload(setError: (message: string) => void) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]?.name.toLowerCase().endsWith(".zip")) {
      setUploadedFile(e.dataTransfer.files[0]);
      setError("");
    } else {
      setError("Please upload a ZIP file");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]?.name.toLowerCase().endsWith(".zip")) {
      setUploadedFile(e.target.files[0]);
      setError("");
    } else {
      setError("Please upload a ZIP file");
    }
  };

  return {
    uploadedFile,
    setUploadedFile,
    dragActive,
    handleDrag,
    handleDrop,
    handleFileSelect,
  };
}
