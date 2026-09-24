import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ensureTenant, listKeys, createKey, revokeKey, setProviderKey, getBilling, createCheckout } from "@/lib/provision";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { CopyButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { newkey?: string; newprefix?: string; error?: string; billing?: string };
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const tenant = await ensureTenant(session.user.email, session.user.name);
  const keys = await listKeys(tenant.id);
  const billing = await getBilling(tenant.id);

  async function createKeyAction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.email) redirect("/login");
    const tenant = await ensureTenant(session.user.email);
    const name = String(formData.get("name") || "default").slice(0, 128);
    const capRaw = String(formData.get("cap") || "").trim();
    const cap = capRaw ? Number(capRaw) : null;
    const scopes = formData.getAll("scopes").map(String).filter((v) => ["chat", "metrics"].includes(v));
    const created = await createKey(tenant.id, name, cap && cap > 0 ? cap : null,
                                    scopes.length ? scopes : undefined);
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

  async function upgradeAction() {
    "use server";
    const session = await auth();
    if (!session?.user?.email) redirect("/login");
    const tenant = await ensureTenant(session.user.email);
    const result = await createCheckout(tenant.id, session.user.email);
    if ("not_configured" in result) redirect("/dashboard?billing=unconfigured");
    else if (result.checkout_url) redirect(result.checkout_url);
    else redirect("/dashboard?billing=error");
  }

  return (
    <div className="flex flex-col gap-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">API keys</h1>
          <p className="mt-1 truncate text-sm text-muted">{session.user.email}</p>
        </div>
        <Badge variant="accent">{billing.plan} plan</Badge>
      </div>

      {searchParams.newkey && (
        <div className="animate-fade-up rounded-xl border border-accent/40 bg-accent/5 p-4 sm:p-5 shadow-glow">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-accent">Key created. Copy it now - it is shown only once.</p>
            <CopyButton text={searchParams.newkey} label="Copy key" />
          </div>
          <code className="mt-3 block break-all rounded-lg border border-accent/20 bg-ink px-3 py-2.5 font-mono text-sm text-accent">
            {searchParams.newkey}
          </code>
          <p className="mt-2.5 text-xs text-muted">
            Use it as a Bearer token: <code className="font-mono text-slate-300">Authorization: Bearer {searchParams.newprefix}...</code>
          </p>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader title="Your keys" description={`${keys.length} active key${keys.length === 1 ? "" : "s"} on your tenant`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-xs font-medium uppercase tracking-wider text-faint">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Key</th>
                <th className="px-5 py-3">Monthly cap</th>
                <th className="px-5 py-3">Scopes</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-edge/40 transition-colors last:border-0 hover:bg-panel-2/50">
                  <td className="px-5 py-3 font-medium text-slate-200">{k.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-muted">{k.prefix}...</td>
                  <td className="px-5 py-3 text-muted">{k.monthly_cap_usd != null ? `$${k.monthly_cap_usd}` : "none"}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      {(k.scopes ?? ["chat"]).map((s) => (
                        <Badge key={s} variant="muted">{s}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted">{new Date(k.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    <form action={revokeKeyAction}>
                      <input type="hidden" name="key_id" value={k.id} />
                      <Button variant="destructive" size="sm" type="submit">Revoke</Button>
                    </form>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-muted">No keys yet - create one below.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="New key" description="New keys are shown once, at creation." />
        <CardContent>
          <form action={createKeyAction} className="flex flex-wrap items-end gap-4">
            <Field label="Name" className="w-full sm:w-44">
              <Input name="name" defaultValue="default" />
            </Field>
            <Field label="Monthly spend cap (USD, optional)" className="w-full sm:w-48">
              <Input name="cap" placeholder="5.00" inputMode="decimal" />
            </Field>
            <fieldset className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Permissions</span>
              <div className="flex items-center gap-4 rounded-lg border border-edge bg-ink px-3 py-2">
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" name="scopes" value="chat" defaultChecked /> chat - call models
                </label>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" name="scopes" value="metrics" /> metrics - read usage
                </label>
              </div>
            </fieldset>
            <Button type="submit">Create key</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Billing"
          description="Free includes $5/month of platform usage. Pro raises the cap to $50/month. Key-level spend caps apply on both."
        />
        <CardContent>
          <p className="text-sm text-muted">
            Current plan: <span className="font-medium text-slate-200">{billing.plan}</span>
            {billing.status !== "active" ? ` (${billing.status})` : ""}
          </p>
          {searchParams.billing === "unconfigured" && (
            <p className="mt-2 text-sm text-amber-300">Payments are not configured yet - checkout activates when the provider account is connected.</p>
          )}
          {billing.plan === "free" && (
            <form action={upgradeAction} className="mt-3">
              <Button variant="secondary" type="submit" size="sm">Upgrade to Pro</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Bring your own keys (BYOK)"
          description="Add your own Groq, OpenAI, or Gemini key and usage bills directly to your provider account. Keys are encrypted at rest; your spend cap still applies."
        />
        <CardContent>
          <form action={byokAction} className="flex flex-wrap items-end gap-4">
            <Field label="Provider" className="w-full sm:w-52">
              <Select name="provider">
                <option value="groq">Groq</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="jina">Jina (embeddings)</option>
                <option value="openrouter">OpenRouter</option>
              </Select>
            </Field>
            <Field label="API key" className="min-w-0 flex-1 sm:min-w-64">
              <Input name="api_key" type="password" autoComplete="off" />
            </Field>
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
