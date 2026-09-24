import { signIn } from "@/auth";
import { LogoMark } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col items-center justify-center py-16">
      <div className="w-full max-w-sm animate-fade-up rounded-2xl border border-edge bg-panel p-8 shadow-pop">
        <div className="flex flex-col items-center text-center">
          <div className="rounded-2xl border border-edge bg-panel-2 p-3 shadow-glow">
            <LogoMark className="h-9 w-9" />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-100">
            Sign in to TokenRoute
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            One Google account gets you a tenant, API keys, and budget guardrails.
            No passwords, no credit card, no sales call.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z" />
              <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09Z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z" />
            </svg>
            Continue with Google
          </button>
        </form>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
          <Badge variant="muted">free tier</Badge>
          <Badge variant="muted">$5/month cap included</Badge>
          <Badge variant="muted">bring your own keys</Badge>
        </div>
      </div>
    </div>
  );
}
