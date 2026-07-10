import { notFound } from "next/navigation";
import { requireModule } from "@/lib/wedding";
import { loadCategory } from "@/lib/categories";
import { CategoryClient } from "./CategoryClient";

export default async function CategoryPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ scenario?: string }>;
}) {
  const { slug } = await params;
  const { scenario } = await searchParams;
  const { wedding_id } = await requireModule("budget");
  const view = await loadCategory(wedding_id, slug, scenario);
  if (!view) notFound();
  return <CategoryClient view={view} />;
}
