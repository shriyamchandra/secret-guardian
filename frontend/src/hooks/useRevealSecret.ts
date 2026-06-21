"use client";

import { useState } from "react";

import { ScanResult } from "@/types/scan";

/** Clipboard "copied" indicator shared by copy buttons and exports. */
export function useCopyFeedback() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const markCopied = (key: string, ms: number) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), ms);
  };

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      markCopied(key, 1200);
    } catch {
      // ignore silently
    }
  };

  return { copiedKey, markCopied, copyText };
}

/** Reveal-secret flow: confirmation, token-gated POST /reveal, per-key
 * revealed value cache (toggling off forgets the value). */
export function useRevealSecret(scanResult: ScanResult | null) {
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});

  const toggleRevealSecret = async (key: string, secretFingerprint?: string) => {
    if (revealedSecrets[key]) {
      setRevealedSecrets((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    if (!secretFingerprint || !scanResult?.scan_token) {
      alert("Secret value is unavailable or expired.");
      return;
    }

    const approved = window.confirm(
      "Reveal this secret? Only do this on a secure device and avoid screen sharing."
    );
    if (!approved) {
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reveal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scan_token: scanResult.scan_token,
          secret_fingerprint: secretFingerprint,
          reveal_signature: scanResult.reveal_signature,
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          alert("Secret reveal is disabled in this environment.");
        } else {
          alert("Failed to retrieve secret value. It may have expired (5-minute TTL).");
        }
        return;
      }

      const data = await response.json();
      if (data.raw_value) {
        setRevealedSecrets((prev) => ({
          ...prev,
          [key]: data.raw_value,
        }));
      } else {
        alert("No value returned from reveal service.");
      }
    } catch (err) {
      console.error("Reveal error:", err);
      alert("An error occurred while revealing the secret.");
    }
  };

  return { revealedSecrets, toggleRevealSecret };
}
