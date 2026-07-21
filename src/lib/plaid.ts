// Thin server-side Plaid REST client (no SDK). Credentials come from env and
// are sent server-to-server; the access token stays on the server.
const ENV = (process.env.PLAID_ENV || "production").toLowerCase();
const HOST =
  ENV === "sandbox" ? "https://sandbox.plaid.com" :
  ENV === "development" ? "https://development.plaid.com" :
  "https://production.plaid.com";

export function plaidConfigured(): boolean {
  return !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET && process.env.PLAID_ENCRYPTION_KEY);
}

async function plaid<T = Record<string, unknown>>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(HOST + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: process.env.PLAID_CLIENT_ID, secret: process.env.PLAID_SECRET, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json as { error_code?: string; error_message?: string };
    const e = new Error(err.error_message || err.error_code || `Plaid error ${res.status}`) as Error & { code?: string };
    e.code = err.error_code;
    throw e;
  }
  return json as T;
}

export function createLinkToken(clientUserId: string) {
  return plaid<{ link_token: string }>("/link/token/create", {
    user: { client_user_id: clientUserId },
    client_name: "Wedding Hub",
    products: ["transactions"],
    country_codes: ["US", "CA"],
    language: "en",
  });
}

export function exchangePublicToken(public_token: string) {
  return plaid<{ access_token: string; item_id: string }>("/item/public_token/exchange", { public_token });
}

type Account = { account_id: string; type: string; balances: { available: number | null; current: number | null } };
export function getBalances(access_token: string) {
  return plaid<{ accounts: Account[] }>("/accounts/balance/get", { access_token });
}

export function getItem(access_token: string) {
  return plaid<{ item: { institution_id: string | null } }>("/item/get", { access_token });
}
export function getInstitution(institution_id: string) {
  return plaid<{ institution: { name: string } }>("/institutions/get_by_id", { institution_id, country_codes: ["US", "CA"] });
}

export type PlaidStream = {
  description: string | null;
  merchant_name: string | null;
  average_amount: { amount: number | null };
  last_amount: { amount: number | null };
  frequency: string; // WEEKLY | BIWEEKLY | SEMI_MONTHLY | MONTHLY | ANNUALLY | UNKNOWN
  is_active: boolean;
  personal_finance_category?: { primary: string | null } | null;
};
export function getRecurring(access_token: string) {
  return plaid<{ inflow_streams: PlaidStream[]; outflow_streams: PlaidStream[] }>("/transactions/recurring/get", { access_token });
}

export function removeItem(access_token: string) {
  return plaid("/item/remove", { access_token });
}
