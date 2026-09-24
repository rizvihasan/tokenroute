import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <div className="py-24 flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold">Sign in to TokenRoute</h1>
      <p className="text-muted text-sm max-w-sm text-center">
        One Google account gets you a tenant, API keys, budgets, and the console.
        No passwords, no card.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/dashboard" });
        }}
      >
        <button
          type="submit"
          className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Continue with Google
        </button>
      </form>
    </div>
  );
}
