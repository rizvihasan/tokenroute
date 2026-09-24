import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "TokenRoute",
  description: "LLM inference gateway with semantic caching, RAG, and live ops metrics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-edge bg-panel/60 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-mono font-semibold tracking-tight">
              token<span className="text-accent">route</span>
            </Link>
            <nav className="flex gap-5 text-sm text-muted">
              <Link href="/" className="hover:text-slate-200 transition-colors">Chat</Link>
              <Link href="/console" className="hover:text-slate-200 transition-colors">Ops console</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4">{children}</main>
      </body>
    </html>
  );
}
