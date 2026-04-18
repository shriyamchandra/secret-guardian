import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { NavigationTransitionLayer } from "@/components/NavigationTransitionLayer";
import { ThemeModeToggle } from "@/components/ThemeModeToggle";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Secret Guardian",
  description:
    "Scan your repos, catch secrets instantly, and fix them with AI before hackers do.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const key = "sg-theme-preference";
    const stored = localStorage.getItem(key);
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  } catch {}
})();`,
          }}
        />
      </head>
      <body className={`${plexSans.variable} ${plexMono.variable} font-sans antialiased bg-zinc-950 text-zinc-100`}>
        <NavigationTransitionLayer />
        <ThemeModeToggle />
        {children}
      </body>
    </html>
  );
}
