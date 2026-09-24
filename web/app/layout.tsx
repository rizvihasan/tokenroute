import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { auth, signOut } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "TokenRoute",
  description: "The LLM gateway that sends easy prompts to cheap models, answers repeats from a semantic cache, and shows you the cost of every single call.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090b10",
};

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth().catch(() => null);
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
        >
          Skip to content
        </a>
        <SiteHeader userEmail={session?.user?.email ?? null} signOutAction={signOutAction} />
        <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">{children}</main>
        <footer className="mt-auto border-t border-edge/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-faint sm:px-6">
            <span>TokenRoute - open source under Apache 2.0</span>
            <div className="flex items-center gap-4">
              <a href="https://github.com/rizvihasan/tokenroute" target="_blank" rel="noreferrer" className="transition-colors hover:text-slate-300">
                GitHub
              </a>
              <a href="https://tokenroute-gateway.onrender.com/health" target="_blank" rel="noreferrer" className="transition-colors hover:text-slate-300">
                Gateway status
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
