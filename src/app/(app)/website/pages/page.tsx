import Link from "next/link";
import { requireModule } from "@/lib/wedding";
import { loadPagesNav } from "./actions";
import { PagesNavClient } from "./PagesNavClient";

export const dynamic = "force-dynamic";

export default async function PagesNavPage() {
  await requireModule("website");
  const data = await loadPagesNav();
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-1 text-sm"><Link href="/website" className="text-accent hover:underline">← Website</Link></div>
      <h1 className="font-display text-2xl font-semibold">Pages &amp; navigation</h1>
      <p className="mt-1 text-sm text-muted">Order your pages, set their URLs and home page, and build the nav menu. Design each page&rsquo;s content in the <Link href="/invite" className="text-accent hover:underline">designer</Link>.</p>
      <div className="mt-5"><PagesNavClient initial={data} /></div>
    </div>
  );
}
