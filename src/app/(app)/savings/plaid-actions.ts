"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/wedding";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { sumMonthly, type Frequency } from "@/lib/finance";
import * as plaid from "@/lib/plaid";

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

async function gate() {
  const { wedding_id, role } = await requireModule("savings");
  return { weddingId: wedding_id, editable: role !== "viewer" };
}

// The Plaid access token is read only here (service-role) and decrypted in memory.
async function loadToken(weddingId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("plaid_items").select("access_token_enc").eq("wedding_id", weddingId).maybeSingle();
  return data ? decryptSecret(data.access_token_enc) : null;
}

export async function createLinkToken(): Promise<{ ok: boolean; linkToken?: string; error?: string }> {
  const { weddingId, editable } = await gate();
  if (!editable) return { ok: false, error: "View-only access." };
  if (!plaid.plaidConfigured()) return { ok: false, error: "Bank linking isn’t set up yet (missing Plaid keys)." };
  try { const r = await plaid.createLinkToken(weddingId); return { ok: true, linkToken: r.link_token }; }
  catch (e) { return { ok: false, error: msg(e) }; }
}

export async function exchangePublicToken(publicToken: string): Promise<Result & { institution?: string }> {
  const { weddingId, editable } = await gate();
  if (!editable) return fail("View-only access.");
  try {
    const ex = await plaid.exchangePublicToken(publicToken);
    let institution = "your bank";
    try {
      const it = await plaid.getItem(ex.access_token);
      if (it.item.institution_id) institution = (await plaid.getInstitution(it.item.institution_id)).institution.name;
    } catch { /* institution name is best-effort */ }
    const admin = createAdminClient();
    await admin.from("plaid_items").upsert(
      { wedding_id: weddingId, item_id: ex.item_id, access_token_enc: encryptSecret(ex.access_token), institution_name: institution },
      { onConflict: "wedding_id" }
    );
    await syncBalanceInternal(weddingId); // pull the balance immediately
    revalidatePath("/savings"); revalidatePath("/");
    return { ok: true, institution };
  } catch (e) { return fail(msg(e)); }
}

async function syncBalanceInternal(weddingId: string): Promise<number | null> {
  const token = await loadToken(weddingId);
  if (!token) return null;
  const { accounts } = await plaid.getBalances(token);
  const total = accounts.filter((a) => a.type === "depository").reduce((s, a) => s + (a.balances.current ?? 0), 0);
  const rounded = Math.round(total * 100) / 100;
  const supabase = await createClient();
  await supabase.from("budget_config").update({ saved: rounded }).eq("wedding_id", weddingId);
  await createAdminClient().from("plaid_items").update({ last_balance: rounded, last_synced_at: new Date().toISOString() }).eq("wedding_id", weddingId);
  return rounded;
}

export async function syncBalance(): Promise<Result & { balance?: number }> {
  const { weddingId, editable } = await gate();
  if (!editable) return fail("View-only access.");
  try {
    const bal = await syncBalanceInternal(weddingId);
    if (bal === null) return fail("No bank linked.");
    revalidatePath("/savings"); revalidatePath("/");
    return { ok: true, balance: bal };
  } catch (e) { return fail(msg(e)); }
}

export type Suggestion = { kind: "income" | "expense"; label: string; amount: number; frequency: Frequency; category: string | null };

const PLAID_FREQ: Record<string, Frequency> = { WEEKLY: "weekly", BIWEEKLY: "biweekly", SEMI_MONTHLY: "biweekly", MONTHLY: "monthly", ANNUALLY: "annual" };
const PLAID_CAT: Record<string, string> = {
  RENT_AND_UTILITIES: "Housing", HOME_IMPROVEMENT: "Housing", LOAN_PAYMENTS: "Debt", TRANSPORTATION: "Transportation",
  FOOD_AND_DRINK: "Food", MEDICAL: "Health", PERSONAL_CARE: "Personal", ENTERTAINMENT: "Subscriptions",
};

export async function getRecurringSuggestions(): Promise<{ ok: boolean; pending?: boolean; suggestions?: Suggestion[]; error?: string }> {
  const { weddingId, editable } = await gate();
  if (!editable) return { ok: false, error: "View-only access." };
  try {
    const token = await loadToken(weddingId);
    if (!token) return { ok: false, error: "No bank linked." };
    const r = await plaid.getRecurring(token);
    const map = (s: plaid.PlaidStream, kind: "income" | "expense"): Suggestion => ({
      kind,
      label: (s.merchant_name || s.description || (kind === "income" ? "Income" : "Expense")).slice(0, 60),
      amount: Math.abs(s.average_amount.amount ?? s.last_amount.amount ?? 0),
      frequency: PLAID_FREQ[s.frequency] ?? "monthly",
      category: kind === "expense" ? PLAID_CAT[s.personal_finance_category?.primary ?? ""] ?? "Other" : null,
    });
    const suggestions = [
      ...r.inflow_streams.filter((s) => s.is_active).map((s) => map(s, "income")),
      ...r.outflow_streams.filter((s) => s.is_active).map((s) => map(s, "expense")),
    ].filter((s) => s.amount > 0);
    return { ok: true, suggestions };
  } catch (e) {
    if ((e as { code?: string }).code === "PRODUCT_NOT_READY") return { ok: true, pending: true, suggestions: [] };
    return { ok: false, error: msg(e) };
  }
}

export async function acceptSuggestion(s: Suggestion): Promise<Result> {
  const { weddingId, editable } = await gate();
  if (!editable) return fail("View-only access.");
  if (!["income", "expense"].includes(s.kind) || !(s.amount >= 0)) return fail("Invalid suggestion.");
  const freq: Frequency = (["monthly", "weekly", "biweekly", "annual"] as Frequency[]).includes(s.frequency) ? s.frequency : "monthly";
  const supabase = await createClient();
  const { data: max } = await supabase.from("finance_lines").select("sort").eq("wedding_id", weddingId).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("finance_lines").insert({
    wedding_id: weddingId, kind: s.kind, label: s.label.slice(0, 200), amount: Math.round(s.amount * 100) / 100,
    frequency: freq, category: s.kind === "expense" ? (s.category ?? "Other") : null, sort: (max?.sort ?? -1) + 1,
  });
  if (error) return fail(error.message);
  await recache(supabase, weddingId);
  revalidatePath("/savings"); revalidatePath("/"); revalidatePath("/budget");
  return { ok: true };
}

export async function unlinkBank(): Promise<Result> {
  const { weddingId, editable } = await gate();
  if (!editable) return fail("View-only access.");
  try {
    const token = await loadToken(weddingId);
    if (token) { try { await plaid.removeItem(token); } catch { /* best-effort de-auth at Plaid */ } }
    await createAdminClient().from("plaid_items").delete().eq("wedding_id", weddingId);
    revalidatePath("/savings");
    return { ok: true };
  } catch (e) { return fail(msg(e)); }
}

// Mirror finance-actions.recacheFinances (keep budget_config's cached monthly totals in sync).
async function recache(supabase: Awaited<ReturnType<typeof createClient>>, weddingId: string) {
  const { data } = await supabase.from("finance_lines").select("kind, amount, frequency").eq("wedding_id", weddingId);
  const rows = (data ?? []).map((l) => ({ kind: l.kind as string, amount: Number(l.amount), frequency: l.frequency as Frequency }));
  const income = sumMonthly(rows.filter((l) => l.kind === "income"));
  const expenses = sumMonthly(rows.filter((l) => l.kind === "expense"));
  await supabase.from("budget_config").update({
    monthly_income: Math.round(income * 100) / 100,
    monthly_expenses: Math.round(expenses * 100) / 100,
    monthly: Math.max(0, Math.round((income - expenses) * 100) / 100),
  }).eq("wedding_id", weddingId);
}
