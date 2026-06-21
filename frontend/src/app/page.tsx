"use client";

import { Header } from "@/components/landing/Header";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { DemoSection } from "@/components/landing/DemoSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { TrustSection } from "@/components/landing/TrustSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Fluid animated background glows that span across both the Header and HeroSection */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-[850px] overflow-hidden z-0">
        {/* Amber/yellow fluid blob */}
        <div className="absolute top-[-5%] left-[5%] w-[320px] h-[320px] bg-amber-500/30 dark:bg-amber-400/10 blur-[80px] animate-fluid-blob-1" />
        {/* Emerald/green fluid blob */}
        <div className="absolute top-[10%] right-[5%] w-[400px] h-[400px] bg-emerald-500/25 dark:bg-emerald-500/10 blur-[90px] animate-fluid-blob-2" />
        {/* Rose/red fluid blob at bottom center */}
        <div className="absolute bottom-[0%] left-[30%] w-[300px] h-[300px] bg-red-500/20 dark:bg-red-500/10 blur-[70px] animate-fluid-blob-3" />
      </div>

      <div className="relative z-10 flex flex-col flex-grow">
        <Header />
        <main className="flex-grow">
          <HeroSection />
          <HowItWorksSection />
          <DemoSection />
          <FeaturesSection />
          <TrustSection />
          <CTASection />
        </main>
        <Footer />
      </div>
    </div>
  );
}
