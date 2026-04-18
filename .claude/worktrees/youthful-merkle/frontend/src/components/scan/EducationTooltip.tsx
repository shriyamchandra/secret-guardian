"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

const educationContent = {
  entropy: {
    title: "What is Entropy?",
    content:
      "Entropy measures randomness in a string. High entropy (4.0+) suggests a randomly generated secret, while low entropy indicates common words or patterns. Real secrets typically have high entropy.",
  },
  publicRepos: {
    title: "Why Public Repos are Risky",
    content:
      "Public repositories are indexed by search engines and bots. Exposed secrets can be found within minutes and exploited for unauthorized access, data theft, or financial fraud.",
  },
  masking: {
    title: "Why We Mask Secrets",
    content:
      "Secrets are masked by default to prevent accidental screen sharing exposure, shoulder surfing, and browser history/cache leakage. Only reveal when absolutely necessary.",
  },
  threatContext: {
    title: "Context-Aware Threat Analysis",
    content:
      "Not all secrets are equally dangerous. We analyze context like localhost references, test files, and placeholder values to distinguish between 'exploitable now' vs 'bad practice' vs 'likely false positive'.",
  },
};

export const EducationTooltip = ({ topic }: { topic: keyof typeof educationContent }) => {
  const [show, setShow] = useState(false);
  const info = educationContent[topic];

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="text-zinc-500 transition-colors hover:text-zinc-200"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-md border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-100">
          <div className="mb-1 font-semibold">{info.title}</div>
          <div className="text-xs leading-relaxed text-zinc-300">{info.content}</div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-8 border-transparent border-t-zinc-900" />
        </div>
      )}
    </div>
  );
};
