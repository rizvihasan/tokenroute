// Server-side bridge to the gateway's admin API. Browsers never see
// ADMIN_KEY; these run in server components / route handlers only.

const GW = process.env.GATEWAY_INTERNAL_URL ?? "http://localhost:8000";
const ADMIN = process.env.ADMIN_KEY ?? "";

async function admin(path: string, init?: RequestInit) {
  const resp = await fetch(`${GW}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-admin-key": ADMIN, ...init?.headers },
    cache: "no-store",
  });
  if (!resp.ok) throw new Error(`gateway admin ${path}: ${resp.status}`);
  return resp.json();
}

export interface TenantKey {
  id: string;
  prefix: string;
  name: string;
  created_at: string;
  monthly_cap_usd: number | null;
  scopes?: string[];
}

export interface BillingStatus {
  plan: string;
  status: string;
  provider: string;
  current_period_end: string | null;
}

export async function ensureTenant(email: string, name?: string | null) {
  return (await admin("/admin/tenants", {
    method: "POST",
    body: JSON.stringify({ email, name }),
  })) as { id: string; email: string; name: string | null };
}

export async function listKeys(tenantId: string): Promise<TenantKey[]> {
  return (await admin(`/admin/keys?tenant_id=${encodeURIComponent(tenantId)}`)) as TenantKey[];
}

// The raw key comes back here and is shown to the user exactly once.
export async function createKey(tenantId: string, name: string, monthlyCapUsd: number | null,
                                scopes?: string[]) {
  return (await admin("/admin/keys", {
    method: "POST",
    body: JSON.stringify({ tenant_id: tenantId, name, monthly_cap_usd: monthlyCapUsd, scopes }),
  })) as { id: string; key: string; prefix: string; name: string };
}

export async function getBilling(tenantId: string): Promise<BillingStatus> {
  return (await admin(`/billing/status?tenant_id=${encodeURIComponent(tenantId)}`)) as BillingStatus;
}

export async function createCheckout(tenantId: string, email: string) {
  const resp = await fetch(`${GW}/billing/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": ADMIN },
    body: JSON.stringify({ tenant_id: tenantId, email, plan: "pro" }),
    cache: "no-store",
  });
  if (resp.status === 501) return { not_configured: true as const };
  if (!resp.ok) throw new Error(`billing checkout: ${resp.status}`);
  return (await resp.json()) as { provider: string; checkout_url: string };
}

export async function revokeKey(keyId: string) {
  return admin("/admin/keys/revoke", { method: "POST", body: JSON.stringify({ key_id: keyId }) });
}

export async function setProviderKey(tenantId: string, provider: string, apiKey: string) {
  return admin("/admin/provider-keys", {
    method: "POST",
    body: JSON.stringify({ tenant_id: tenantId, provider, api_key: apiKey }),
  });
}
