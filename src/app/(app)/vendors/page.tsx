import { requireMembership } from "@/lib/wedding";
import { loadVendors } from "@/lib/vendors";
import { VendorsClient } from "./VendorsClient";

export default async function VendorsPage() {
  const { wedding_id } = await requireMembership();
  const data = await loadVendors(wedding_id);
  if (!data) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Vendors</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Suppliers</h1>
        <p className="text-sm text-muted">Who you’re talking to, their status, and their cost in <span className="font-medium text-ink">{data.planName}</span>. Options are mixed in Scenarios; contracts live in Documents.</p>
      </header>
      <VendorsClient weddingId={wedding_id} vendors={data.vendors} />
    </main>
  );
}
