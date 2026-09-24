import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { ensureTenant, listKeys, createKey, revokeKey, setProviderKey } from "@/lib/provision";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { newkey?: string; newprefix?: string; error?: string };
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const tenant = await ensureTenant(session.user.email, session.user.name);
  const keys = await listKeys(tenant.id);

  async function createKeyAction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.email) redirect("/login");
    const tenant = await ensureTenant(session.user.email);
    const name = String(formData.get("name") || "default").slice(0, 128);
    const capRaw = String(formData.get("cap") || "").trim();
    const cap = capRaw ? Number(capRaw) : null;
    const created = await createKey(tenant.id, name, cap && cap > 0 ? cap : null);
    redirect(`/dashboard?newkey=${encodeURIComponent(created.key)}&newprefix=${encodeURIComponent(created.prefix)}`);
  }

  async function revokeKeyAction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.email) redirect("/login");
    await revokeKey(String(formData.get("key_id")));
    redirect("/dashboard");
  }

  async function byokAction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.email) redirect("/login");
    const tenant = await ensureTenant(session.user.email);
    const provider = String(formData.get("provider"));
    const apiKey = String(formData.get("api_key") || "").trim();
    if (apiKey.length >= 8) await setProviderKey(tenant.id, provider, apiKey);
    redirect("/dashboard");
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="py-8 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">API keys</h1>
          <p className="text-muted text-sm">{session.user.email}</p>
        </div>
        <form action={signOutAction}>
          <button className="text-sm text-muted hover:text-slate-200">Sign out</button>
        </form>
      </div>

      {searchParams.newkey && (
        <div className="rounded-lg border border-accent/50 bg-panel p-4">
          <p className="text-sm font-medium mb-1">Key created - copy it now. It is shown once.</p>
          <code className="block font-mono text-sm break-all text-accent">{searchParams.newkey}</code>
          <p className="text-xs text-muted mt-2">
            Use it as a Bearer token: <code>Authorization: Bearer {searchParams.newprefix}...</code>
          </p>
        </div>
      )}

      <section className="rounded-lg border border-edge bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-edge">
              <th className="p-3">Name</th><th className="p-3">Key</th>
              <th className="p-3">Monthly cap</th><th className="p-3">Created</th><th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-edge/50">
                <td className="p-3">{k.name}</td>
                <td className="p-3 font-mono text-muted">{k.prefix}...</td>
                <td className="p-3">{k.monthly_cap_usd != null ? `$${k.monthly_cap_usd}` : "none"}</td>
                <td className="p-3 text-muted">{new Date(k.created_at).toLocaleDateString()}</td>
                <td className="p-3 text-right">
                  <form action={revokeKeyAction}>
                    <input type="hidden" name="key_id" value={k.id} />
                    <button className="text-xs text-red-400 hover:text-red-300">Revoke</button>
                  </form>
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr><td colSpan={5} className="p-3 text-muted">No keys yet - create one below.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-edge bg-panel p-4">
        <h2 className="font-medium mb-3">New key</h2>
        <form action={createKeyAction} className="flex gap-3 items-end flex-wrap">
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted">Name</span>
            <input name="name" defaultValue="default" className="rounded bg-canvas border border-edge px-3 py-1.5 text-sm" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted">Monthly budget cap (USD, optional)</span>
            <input name="cap" placeholder="5.00" className="rounded bg-canvas border border-edge px-3 py-1.5 text-sm w-36" />
          </label>
          <button className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white">Create key</button>
        </form>
      </section>

      <section className="rounded-lg border border-edge bg-panel p-4">
        <h2 className="font-medium mb-1">Bring your own provider keys (BYOK)</h2>
        <p className="text-xs text-muted mb-3">
          Your key calls your provider account directly, so usage bills to your provider, not the platform. Encrypted at rest; your key's budget cap still applies as your own safety limit.
        </p>
        <form action={byokAction} className="flex gap-3 items-end flex-wrap">
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted">Provider</span>
            <select name="provider" className="rounded bg-canvas border border-edge px-3 py-1.5 text-sm">
              <option value="groq">Groq</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
              <option value="jina">Jina (embeddings)</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </label>
          <label className="text-sm flex flex-col gap-1 flex-1 min-w-64">
            <span className="text-muted">API key</span>
            <input name="api_key" type="password" className="rounded bg-canvas border border-edge px-3 py-1.5 text-sm" />
          </label>
          <button className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white">Save</button>
        </form>
      </section>
    </div>
  );
}
