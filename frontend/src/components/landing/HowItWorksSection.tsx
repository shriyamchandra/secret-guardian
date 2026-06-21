"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  Database,
  Cpu,
  GitBranch,
} from "lucide-react";
// ─── Detection Pipeline Section ──────────────────────────────────────────────

const DETECTION_STEPS = [
  {
    number: "01",
    icon: GitBranch,
    title: "Clone or Upload",
    color: "border-zinc-700 text-zinc-300",
    accentBg: "bg-zinc-800",
    description: "Paste a public repo URL (GitHub, GitLab, Bitbucket) or upload a ZIP. No credentials needed.",
    detail: (
      <div className="mt-3 rounded-md border border-zinc-700/50 bg-zinc-900/40 backdrop-blur-md px-3 py-2 font-mono text-xs text-zinc-400">
        <span className="text-zinc-600">$ </span>git clone https://github.com/acme/backend
        <br />
        <span className="text-emerald-400">✓ 312 files · 2.1 MB</span>
      </div>
    ),
  },
  {
    number: "02",
    icon: Cpu,
    title: "3 Scanners in Parallel",
    color: "border-orange-800 text-orange-300",
    accentBg: "bg-orange-950/30",
    description: "Regex patterns, Gitleaks, and TruffleHog run concurrently. Results are deduplicated.",
    detail: (
      <div className="mt-3 rounded-md border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md p-3 space-y-1.5 font-mono text-xs shadow-lg">
        {[
          { name: "Regex Engine", count: "Curated signatures", color: "text-orange-300" },
          { name: "Gitleaks", count: "100+ rules", color: "text-yellow-300" },
          { name: "TruffleHog", count: "Entropy scan", color: "text-amber-300" },
        ].map((s) => (
          <div key={s.name} className="flex items-center justify-between rounded border border-zinc-800/45 bg-zinc-950/30 px-3 py-1.5">
            <span className="font-mono text-xs text-zinc-400">{s.name}</span>
            <span className={`font-mono text-[11px] ${s.color}`}>{s.count}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    number: "03",
    icon: Database,
    title: "Heuristic Filtering",
    color: "border-zinc-600 text-zinc-300",
    accentBg: "bg-zinc-800",
    description: "Smart noise filtering drops test fixtures, placeholder strings, hex hashes, and known example credentials — so you see only real findings.",
    detail: (
      <div className="mt-3 rounded-md border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md p-3 space-y-1.5 font-mono text-xs shadow-lg">
        <div className="flex items-center gap-2 text-red-400/80"><span>✕</span><span className="line-through text-zinc-500">AKIAIOSFODNN7EXAMPLE (known example)</span></div>
        <div className="flex items-center gap-2 text-red-400/80"><span>✕</span><span className="line-through text-zinc-500">your-api-key-here (placeholder)</span></div>
        <div className="flex items-center gap-2 text-emerald-400"><span>✓</span><span className="text-zinc-200">AKIAQWERTY9ABCDEF1GH (real key)</span></div>
      </div>
    ),
  },
  {
    number: "04",
    icon: Bot,
    title: "AI Remediation",
    color: "border-emerald-800 text-emerald-300",
    accentBg: "bg-emerald-950/30",
    description: "Gemini AI (with local Qwen fallback) writes framework-specific fix code for each unique finding.",
    detail: (
      <div className="mt-3 rounded-md border border-emerald-900/45 bg-emerald-950/20 backdrop-blur-md px-3 py-2 font-mono text-[11px]">
        <div className="text-red-400 mb-1">- const key = &quot;AKIA...&quot;;</div>
        <div className="text-emerald-400">+ const key = process.env.AWS_ACCESS_KEY_ID;</div>
        <div className="mt-1.5 text-zinc-600"># Add to .gitignore: .env</div>
      </div>
    ),
  },
];

// ─── Pipeline animation constants ────────────────────────────────────────────
const SCAN_MS  = 2200;  // how long the scan arc spins around each icon
const FLOW_MS  = 900;   // how long the water-flow travels to next icon
const N_STAGES = 4;
const PIPE_LOOP = N_STAGES * SCAN_MS + (N_STAGES - 1) * FLOW_MS;


// Orbit ring geometry
const RING_R    = 24;               // px — ring radius around icon
const RING_CIRC = 2 * Math.PI * RING_R;
const ARC_FRAC  = 0.55;            // fraction of circumference shown as arc

export function HowItWorksSection() {
  const [activeStep,   setActiveStep]   = useState(0);
  const [phase,        setPhase]        = useState<'scan' | 'flow'>('scan');
  const [stepProgress, setStepProgress] = useState(0); // 0-1 within current phase
  const [isDarkMode,   setIsDarkMode]   = useState(true);

  useEffect(() => {
    // Check initial theme
    const html = document.documentElement;
    const checkTheme = () => {
      const theme = html.getAttribute('data-theme');
      if (theme === 'light') setIsDarkMode(false);
      else if (theme === 'dark') setIsDarkMode(true);
      else setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    };
    checkTheme();

    // Observer for changes to data-theme toggle
    const observer = new MutationObserver(checkTheme);
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    
    // Listener for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkTheme);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkTheme);
    };
  }, []);

  const step0Hex = isDarkMode ? '#e2e8f0' : '#18181b'; // bright white in dark mode, dark in light mode
  const STAGE_HEX = [step0Hex, '#ff6b00', '#38bdf8', '#00ffb2'];

  const frameRef     = useRef<number | null>(null);
  const startRef     = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iconRefs     = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);

  const [iconCenters, setIconCenters] = useState<{ x: number; y: number }[]>([]);
  const [svgW, setSvgW] = useState(0);
  const [svgH, setSvgH] = useState(0);

  // Measure actual icon centers relative to the container
  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const cr = containerRef.current.getBoundingClientRect();
    setSvgW(cr.width);
    setSvgH(cr.height);
    const centers = iconRefs.current.map(el => {
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 };
    });
    setIconCenters(centers);
  }, []);

  useEffect(() => {
    measure();
    const t1 = setTimeout(measure, 100);
    const t2 = setTimeout(measure, 500);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  // Re-measure when active step changes to ensure alignment with active layout changes
  useEffect(() => {
    measure();
    const t = setTimeout(measure, 150);
    return () => clearTimeout(t);
  }, [activeStep, measure]);

  // rAF animation loop
  useEffect(() => {
    function tick(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = (ts - startRef.current) % PIPE_LOOP;

      let aStep = 0;
      let aPhase: 'scan' | 'flow' = 'scan';
      let aProg  = 0;
      let t      = 0;

      for (let i = 0; i < N_STAGES; i++) {
        if (elapsed < t + SCAN_MS) {
          aStep  = i; aPhase = 'scan'; aProg = (elapsed - t) / SCAN_MS;
          break;
        }
        t += SCAN_MS;
        if (i < N_STAGES - 1) {
          if (elapsed < t + FLOW_MS) {
            aStep  = i; aPhase = 'flow'; aProg = (elapsed - t) / FLOW_MS;
            break;
          }
          t += FLOW_MS;
        } else {
          aStep = i; aPhase = 'scan'; aProg = 1;
        }
      }

      setActiveStep(aStep);
      setPhase(aPhase);
      setStepProgress(aProg);
      frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, []);

  // ── Derived SVG values ──────────────────────────────────────────────────────
  // Arc sweeps 2.5 full rotations during SCAN_MS; starts from top (–90°)
  const scanAngleDeg = phase === 'scan' ? stepProgress * (2.5 * 360) - 90 : -90;

  // Flow origin / destination
  const flowFrom  = (phase === 'flow' && activeStep < N_STAGES - 1) ? iconCenters[activeStep]     : null;
  const flowTo    = (phase === 'flow' && activeStep < N_STAGES - 1) ? iconCenters[activeStep + 1] : null;
  const flowX     = flowFrom && flowTo ? flowFrom.x + (flowTo.x - flowFrom.x) * stepProgress : 0;
  const flowY     = flowFrom && flowTo ? flowFrom.y + (flowTo.y - flowFrom.y) * stepProgress : 0;
  const accentHex = STAGE_HEX[activeStep];

  const ic = iconCenters[activeStep] ?? { x: 0, y: 0 };

  // Local coordinates for leading comet and tail sparkles inside rotated group
  const ARC_ANGLE = ARC_FRAC * 360; // 198 degrees
  const leadingRad = (ARC_ANGLE * Math.PI) / 180;
  const tail1Rad   = ((ARC_ANGLE - 15) * Math.PI) / 180;
  const tail2Rad   = ((ARC_ANGLE - 30) * Math.PI) / 180;
  const tail3Rad   = ((ARC_ANGLE - 45) * Math.PI) / 180;

  const cometCX = RING_R * Math.cos(leadingRad);
  const cometCY = RING_R * Math.sin(leadingRad);
  const tail1CX = RING_R * Math.cos(tail1Rad);
  const tail1CY = RING_R * Math.sin(tail1Rad);
  const tail2CX = RING_R * Math.cos(tail2Rad);
  const tail2CY = RING_R * Math.sin(tail2Rad);
  const tail3CX = RING_R * Math.cos(tail3Rad);
  const tail3CY = RING_R * Math.sin(tail3Rad);

  return (
    <section id="how-it-works" className="relative overflow-hidden border-b border-zinc-800 bg-zinc-950 py-20">
      {/* Fluid animated background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {/* Emerald fluid blob */}
        <div className="absolute top-[10%] right-[10%] w-[380px] h-[380px] bg-emerald-500/20 dark:bg-emerald-500/10 blur-[90px] animate-fluid-blob-1" />
        {/* Amber fluid blob */}
        <div className="absolute bottom-[10%] left-[5%] w-[320px] h-[320px] bg-orange-500/15 dark:bg-orange-400/10 blur-[80px] animate-fluid-blob-2" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-sans font-bold text-zinc-100">Detection in 4 Stages</h2>
          <p className="mt-3 text-zinc-400 max-w-lg mx-auto">
            Multiple engines, smart deduplication, and AI remediation — all in one scan.
          </p>
        </div>

        <div ref={containerRef} className="relative">
          {/* Static dim spine */}
          <div className="absolute left-6 top-8 bottom-8 w-px bg-zinc-800/60 hidden sm:block" />

          {/* ── SVG animation overlay ── */}
          {iconCenters.length === 4 && svgW > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none hidden sm:block"
              width={svgW}
              height={svgH}
              style={{ overflow: 'visible' }}
            >
              {/* ── Neon Scan arc ──────────────────────────────────────── */}
              {phase === 'scan' && (
                <g>
                  {/* Stacked strokes and helpers translated and scaled together around the node center.
                      This ensures the scanning orbit aligns exactly with the border of the circle,
                      even as the active step transitions and scales up by 1.1. */}
                  <g transform={`translate(${ic.x},${ic.y}) scale(1.1)`}>
                    {/* Soft aura behind the active icon node */}
                    <circle
                      cx="0"
                      cy="0"
                      r={RING_R + 12}
                      fill={accentHex}
                      opacity="0.08"
                    />

                    {/* Dim full track ring */}
                    <circle
                      cx="0"
                      cy="0"
                      r={RING_R}
                      fill="none"
                      stroke={accentHex}
                      strokeWidth="1.5"
                      opacity="0.15"
                    />

                    {/* Inner rotating group for the arc and comet tail */}
                    <g transform={`rotate(${scanAngleDeg})`}>
                      {/* Broad outer glow arc */}
                      <circle
                        cx="0"
                        cy="0"
                        r={RING_R}
                        fill="none"
                        stroke={accentHex}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${RING_CIRC * ARC_FRAC} ${RING_CIRC}`}
                        opacity="0.1"
                      />

                      {/* Medium inner glow arc */}
                      <circle
                        cx="0"
                        cy="0"
                        r={RING_R}
                        fill="none"
                        stroke={accentHex}
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={`${RING_CIRC * ARC_FRAC} ${RING_CIRC}`}
                        opacity="0.25"
                      />

                      {/* Sharp core arc */}
                      <circle
                        cx="0"
                        cy="0"
                        r={RING_R}
                        fill="none"
                        stroke={accentHex}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={`${RING_CIRC * ARC_FRAC} ${RING_CIRC}`}
                        opacity="0.95"
                      />

                      {/* White hot inner core for premium finish */}
                      <circle
                        cx="0"
                        cy="0"
                        r={RING_R}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeDasharray={`${RING_CIRC * ARC_FRAC * 0.8} ${RING_CIRC}`}
                        opacity="0.9"
                      />

                      {/* Leading comet — outer glow */}
                      <circle
                        cx={cometCX}
                        cy={cometCY}
                        r="9"
                        fill={accentHex}
                        opacity="0.25"
                      />

                      {/* Leading comet — mid glow */}
                      <circle
                        cx={cometCX}
                        cy={cometCY}
                        r="6"
                        fill={accentHex}
                        opacity="0.5"
                      />

                      {/* Leading comet — white hot core */}
                      <circle
                        cx={cometCX}
                        cy={cometCY}
                        r="3"
                        fill="#ffffff"
                        opacity="1"
                      />

                      {/* Fading tail sparkle 1 */}
                      <circle
                        cx={tail1CX}
                        cy={tail1CY}
                        r="2"
                        fill="#ffffff"
                        opacity="0.8"
                      />

                      {/* Fading tail sparkle 2 */}
                      <circle
                        cx={tail2CX}
                        cy={tail2CY}
                        r="1.8"
                        fill={accentHex}
                        opacity="0.6"
                      />

                      {/* Fading tail sparkle 3 */}
                      <circle
                        cx={tail3CX}
                        cy={tail3CY}
                        r="1.5"
                        fill={accentHex}
                        opacity="0.4"
                      />
                    </g>
                  </g>
                </g>
              )}

              {/* ── Neon Water-flow between icons ─────────────────────── */}
              {phase === 'flow' && flowFrom && flowTo && (
                <g>
                  {/* Broad glow backdrop line */}
                  <line
                    x1={flowFrom.x}
                    y1={flowFrom.y}
                    x2={flowX}
                    y2={flowY}
                    stroke={accentHex}
                    strokeWidth="10"
                    strokeLinecap="round"
                    opacity="0.1"
                  />

                  {/* Medium glow backdrop line */}
                  <line
                    x1={flowFrom.x}
                    y1={flowFrom.y}
                    x2={flowX}
                    y2={flowY}
                    stroke={accentHex}
                    strokeWidth="6"
                    strokeLinecap="round"
                    opacity="0.25"
                  />

                  {/* Main lit trail */}
                  <line
                    x1={flowFrom.x}
                    y1={flowFrom.y}
                    x2={flowX}
                    y2={flowY}
                    stroke={accentHex}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    opacity="0.9"
                  />

                  {/* Core bright line */}
                  <line
                    x1={flowFrom.x}
                    y1={flowFrom.y}
                    x2={flowX}
                    y2={flowY}
                    stroke="#ffffff"
                    strokeWidth="1"
                    strokeLinecap="round"
                    opacity="0.8"
                  />

                  {/* Soft background aura at leading edge */}
                  <circle
                    cx={flowX}
                    cy={flowY}
                    r="24"
                    fill={accentHex}
                    opacity="0.08"
                  />

                  {/* Outer glow circle at leading edge */}
                  <circle
                    cx={flowX}
                    cy={flowY}
                    r="14"
                    fill={accentHex}
                    opacity="0.25"
                  />

                  {/* Mid glow circle at leading edge */}
                  <circle
                    cx={flowX}
                    cy={flowY}
                    r="7"
                    fill={accentHex}
                    opacity="0.5"
                  />

                  {/* Sharp white core at leading edge */}
                  <circle
                    cx={flowX}
                    cy={flowY}
                    r="3.5"
                    fill="#ffffff"
                    opacity="1"
                  />

                  {/* Trailing droplet 1 */}
                  {stepProgress > 0.12 && (
                    <circle
                      cx={flowFrom.x + (flowTo.x - flowFrom.x) * (stepProgress - 0.12)}
                      cy={flowFrom.y + (flowTo.y - flowFrom.y) * (stepProgress - 0.12)}
                      r="3"
                      fill="#ffffff"
                      opacity="0.8"
                    />
                  )}

                  {/* Trailing droplet 2 */}
                  {stepProgress > 0.24 && (
                    <circle
                      cx={flowFrom.x + (flowTo.x - flowFrom.x) * (stepProgress - 0.24)}
                      cy={flowFrom.y + (flowTo.y - flowFrom.y) * (stepProgress - 0.24)}
                      r="2.5"
                      fill={accentHex}
                      opacity="0.6"
                    />
                  )}

                  {/* Trailing droplet 3 */}
                  {stepProgress > 0.36 && (
                    <circle
                      cx={flowFrom.x + (flowTo.x - flowFrom.x) * (stepProgress - 0.36)}
                      cy={flowFrom.y + (flowTo.y - flowFrom.y) * (stepProgress - 0.36)}
                      r="1.8"
                      fill={accentHex}
                      opacity="0.4"
                    />
                  )}
                </g>
              )}
            </svg>
          )}

          {/* ── Step rows ── */}
          <div className="space-y-0">
            {DETECTION_STEPS.map((step, i) => {
              const Icon    = step.icon;
              const isLast  = i === DETECTION_STEPS.length - 1;
              const isActive = activeStep === i;

              return (
                <div key={step.number} className="relative flex gap-6 sm:gap-10">
                  {/* Node */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      ref={el => { iconRefs.current[i] = el; }}
                      className={[
                        'flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-lg transition-all duration-500',
                        step.color.split(' ')[0],
                        step.accentBg,
                        isActive ? 'scale-110' : 'shadow-black/40',
                      ].join(' ')}
                      style={isActive ? { boxShadow: `0 0 16px 4px ${STAGE_HEX[i]}55` } : {}}
                    >
                      <Icon className={`h-5 w-5 transition-colors duration-300 ${step.color.split(' ')[1]}`} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className={`flex-1 pb-12 ${isLast ? 'pb-0' : ''}`}>
                    <div className="flex flex-col lg:flex-row lg:items-start lg:gap-12">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-3 mb-2">
                          <span className="font-mono text-[11px] text-zinc-600 tracking-widest">{step.number}</span>
                          <h3 className={[
                            'text-xl font-bold transition-colors duration-300',
                            isActive ? 'text-zinc-50' : 'text-zinc-100',
                          ].join(' ')}>
                            {step.title}
                          </h3>
                        </div>
                        <p className="text-zinc-400 leading-relaxed">{step.description}</p>
                      </div>
                      <div className="w-full lg:w-[48%] flex-shrink-0 mt-4 lg:mt-0">
                        {step.detail}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
