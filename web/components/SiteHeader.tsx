"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { LogoMark } from "./Logo";

const NAV = [
  { href: "/", label: "Playground" },
  { href: "/console", label: "Analytics" },
  { href: "/dashboard", label: "API Keys" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader({
  userEmail,
  signOutAction,
}: {
  userEmail: string | null;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const linkClass = (href: string) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm transition-colors",
      pathname === href
        ? "bg-panel-2 text-slate-100"
        : "text-muted hover:text-slate-200 hover:bg-panel-2/60",
    );

  return (
    <header className="sticky top-0 z-40 border-b border-edge/80 bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setOpen(false)}>
          <LogoMark className="h-7 w-7" />
          <span className="font-mono text-[15px] font-semibold tracking-tight text-slate-100">
            token<span className="text-accent">route</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href="https://github.com/rizvihasan/tokenroute"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-slate-200"
            aria-label="GitHub repository"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.75 2.69 1.25 3.35.95.1-.74.4-1.25.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.35.77 1.05.77 2.12v3.14c0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
          </a>
          {userEmail ? (
            <form action={signOutAction}>
              <button
                type="submit"
                title={userEmail}
                className="max-w-[180px] truncate rounded-lg border border-edge bg-panel-2 px-3 py-1.5 text-sm text-muted transition-colors hover:border-edge-strong hover:text-slate-200"
              >
                {userEmail}
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-ink shadow-glow transition-colors hover:bg-accent-strong"
            >
              Sign in
            </Link>
          )}
        </div>

        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-slate-200 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-controls="mobile-nav"
          aria-expanded={open}
        >
          {open ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M18 6 6 18M6 6l12 12" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          )}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" className="border-t border-edge/80 bg-ink px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(linkClass(item.href), "px-3 py-2.5")}
              >
                {item.label}
              </Link>
            ))}
            <a
              href="https://github.com/rizvihasan/tokenroute"
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-3 py-2.5 text-sm text-muted hover:bg-panel-2/60 hover:text-slate-200"
            >
              GitHub
            </a>
            <div className="mt-2 border-t border-edge/60 pt-3">
              {userEmail ? (
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-edge bg-panel-2 px-3 py-2 text-left text-sm text-muted"
                  >
                    Sign out <span className="text-faint">({userEmail})</span>
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg bg-accent px-3 py-2 text-center text-sm font-semibold text-ink"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
