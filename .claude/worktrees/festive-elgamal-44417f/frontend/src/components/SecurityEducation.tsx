"use client";

import { useState } from "react";
import {
  HelpCircle,
  Shield,
  AlertTriangle,
  Lock,
  Eye,
  X,
} from "lucide-react";

/**
 * Security Education Content
 * 
 * Short, human-readable explanations for security concepts.
 * No heavy jargon - designed for developers who may not be security experts.
 */

export const educationTopics = {
  entropy: {
    title: "What is Entropy?",
    icon: Shield,
    content: `Entropy measures how "random" a string looks. 

**High entropy (4.0+)** = Looks random, likely a generated secret
**Low entropy (<3.0)** = Looks like normal words or patterns

Real API keys and tokens are designed to be hard to guess, so they typically have high entropy. This helps us find secrets that don't match known patterns.

Example:
• "password123" → Low entropy (2.9) - common pattern
• "aK9$mP2@xL4&vQ8" → High entropy (4.6) - likely a secret`,
  },
  publicRepos: {
    title: "Why Public Repos Are Risky",
    icon: AlertTriangle,
    content: `Public GitHub repositories are indexed by search engines and monitored by automated bots within minutes of creation.

**What hackers do:**
• Use GitHub's search API to find leaked secrets
• Run automated tools that scan new commits
• Exploit keys within hours (sometimes minutes)

**Real consequences:**
• AWS keys can rack up thousands in charges
• API keys can be used for spam/abuse
• Database credentials can lead to data breaches

Even if you delete a secret, it stays in git history forever unless you rewrite it.`,
  },
  masking: {
    title: "Why We Mask Secrets",
    icon: Lock,
    content: `Secrets are masked (hidden) by default for several important reasons:

**Screen sharing protection**
You might share your screen in meetings or record tutorials without realizing secrets are visible.

**Shoulder surfing**
People nearby could see your screen in coffee shops, offices, or public transport.

**Browser cache/history**
Unmasked values might be cached or appear in browser history.

**Best practice**
Only reveal secrets when absolutely necessary, on a secure device, in a private setting.`,
  },
  severity: {
    title: "Understanding Severity Levels",
    icon: AlertTriangle,
    content: `We assign severity based on the potential impact if the secret is exploited:

🔴 **CRITICAL** - Immediate action required
• Private keys (RSA, SSH, PGP)
• AWS Secret Access Keys
• Database admin credentials

🟠 **HIGH** - Urgent attention needed
• GitHub tokens
• Service API keys
• Database connection strings

🟡 **MEDIUM** - Should be fixed soon
• Test API keys
• Publishable keys with limited scope

🟢 **LOW** - Review when convenient
• Low confidence matches
• Generic patterns`,
  },
  rotation: {
    title: "Why Rotate Secrets?",
    icon: Shield,
    content: `Once a secret is exposed, you should assume it's compromised - even if you're "pretty sure" no one saw it.

**Why rotation is critical:**
• Attackers often stockpile stolen secrets for later use
• Automated tools may have already captured it
• You can't know who has accessed it

**Rotation steps:**
1. Generate a new secret
2. Update your application to use the new secret
3. Revoke/delete the old secret
4. Verify everything still works

Never just delete - always rotate first, then revoke.`,
  },
  envVars: {
    title: "Using Environment Variables",
    icon: Lock,
    content: `Environment variables are the standard way to handle secrets in code:

**Instead of this (BAD):**
\`\`\`
const apiKey = "sk-abc123...";
\`\`\`

**Do this (GOOD):**
\`\`\`
const apiKey = process.env.API_KEY;
\`\`\`

**Setup:**
1. Create a \`.env\` file (never commit this)
2. Add to \`.gitignore\`: \`.env\`
3. Set values: \`API_KEY=sk-abc123...\`
4. Access in code via \`process.env.API_KEY\`

For production, use your platform's secret management (Vercel, AWS, etc).`,
  },
};

type TopicKey = keyof typeof educationTopics;

/**
 * Inline Education Tooltip
 * Shows a small help icon that reveals information on hover/click
 */
export function EducationTooltip({ topic }: { topic: TopicKey }) {
  const [show, setShow] = useState(false);
  const info = educationTopics[topic];

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="p-0.5 text-zinc-500 transition-colors hover:text-zinc-200"
        aria-label={`Learn about ${info.title}`}
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-md border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-100">
          <div className="font-bold mb-2 flex items-center gap-2">
            <info.icon className="h-4 w-4 text-orange-300" />
            {info.title}
          </div>
          <div className="text-xs leading-relaxed whitespace-pre-line text-zinc-300">
            {info.content.split('\n').slice(0, 4).join('\n')}...
          </div>
          <div className="mt-2 text-xs text-orange-300">Click for full explanation</div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-8 border-transparent border-t-zinc-900" />
        </div>
      )}
    </div>
  );
}

/**
 * Full Education Modal
 * A larger modal for detailed security education
 */
export function EducationModal({
  topic,
  isOpen,
  onClose,
}: {
  topic: TopicKey;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const info = educationTopics[topic];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-md border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-orange-800 bg-orange-950/40">
              <info.icon className="h-5 w-5 text-orange-300" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">{info.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 transition-colors hover:bg-zinc-800"
          >
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="prose prose-sm max-w-none">
            <div className="leading-relaxed whitespace-pre-line text-zinc-300">
              {info.content}
            </div>
          </div>
        </div>
        <div className="border-t border-zinc-800 bg-zinc-950 p-4">
          <button
            onClick={onClose}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-xs tracking-wide text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Security Tips Banner
 * A dismissible banner with rotating security tips
 */
export function SecurityTipsBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  const tips = [
    "💡 Tip: Always use environment variables for secrets, never hardcode them.",
    "🔒 Tip: Add .env to your .gitignore before your first commit.",
    "🔄 Tip: Rotate exposed secrets immediately - assume they're compromised.",
    "⚠️ Tip: Even deleted files remain in git history. Use git-filter-branch to remove.",
    "🛡️ Tip: Use a secret manager in production (AWS Secrets Manager, Vault, etc).",
  ];

  if (dismissed) return null;

  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 flex-shrink-0 text-emerald-300" />
          <p className="text-sm font-medium">{tips[tipIndex]}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTipIndex((i) => (i + 1) % tips.length)}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-mono transition-colors hover:border-orange-500 hover:bg-zinc-700"
          >
            Next tip
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 transition-colors hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Reveal Secret Warning Dialog
 * Warning modal shown before revealing a masked secret
 */
export function RevealSecretWarning({
  isOpen,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
      <div className="max-w-md mx-4 rounded-md border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-md border border-orange-800 bg-orange-950/50">
            <Eye className="h-6 w-6 text-orange-300" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-100">Reveal Secret?</h3>
            <p className="text-sm text-zinc-400">This action may expose sensitive data</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-2 text-sm text-zinc-300">
            <AlertTriangle className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
            <span>Make sure you&apos;re not screen sharing</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-zinc-300">
            <AlertTriangle className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
            <span>Ensure no one can see your screen</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-zinc-300">
            <AlertTriangle className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
            <span>The secret will be visible until you hide it again</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-zinc-700 px-4 py-2 text-zinc-200 transition-colors hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-orange-700 bg-orange-800/80 px-4 py-2 font-mono text-xs tracking-wide text-zinc-100 transition-colors hover:bg-orange-700"
          >
            <Eye className="h-4 w-4" />
            Reveal Secret
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Don't Paste Private Keys Warning
 * Warning shown in manual input areas
 */
export function PrivateKeyWarning() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" />
      <div>
        <strong>Warning:</strong> Never paste private keys or sensitive credentials here.
        This tool is for scanning repositories, not for analyzing individual secrets.
      </div>
    </div>
  );
}
