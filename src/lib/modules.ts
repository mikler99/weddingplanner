// The canonical list of app modules — the single source both the sidebar nav and
// the hub pillars derive from, and the basis for per-member module access.

export type ModuleKey = "hub" | "scenarios" | "budget" | "vendors" | "calendar" | "savings" | "guests" | "documents";
export type ModuleGroup = "Overview" | "Planning" | "People & docs";

export type AppModule = { key: ModuleKey; href: string; label: string; icon: string; group: ModuleGroup; desc: string };

export const MODULES: AppModule[] = [
  { key: "hub", href: "/", label: "Hub", icon: "🏠", group: "Overview", desc: "Everything at a glance" },
  { key: "scenarios", href: "/scenarios", label: "Scenarios", icon: "🎛️", group: "Planning", desc: "Compare plans, pick the one" },
  { key: "budget", href: "/budget", label: "Budget", icon: "💰", group: "Planning", desc: "Live totals from guests + vendors" },
  { key: "vendors", href: "/vendors", label: "Vendors", icon: "🤝", group: "Planning", desc: "Suppliers, status & contracts" },
  { key: "calendar", href: "/calendar", label: "Calendar", icon: "🗓️", group: "Planning", desc: "Payment plan & to-dos on a timeline" },
  { key: "savings", href: "/savings", label: "Budget & savings", icon: "📈", group: "Planning", desc: "Personal budget → savings & cash-flow" },
  { key: "guests", href: "/guests", label: "Guests", icon: "✉️", group: "People & docs", desc: "Guest list, headcount, RSVP" },
  { key: "documents", href: "/documents", label: "Documents", icon: "📄", group: "People & docs", desc: "Upload quotes, extract with AI" },
];

export const GROUP_ORDER: ModuleGroup[] = ["Overview", "Planning", "People & docs"];

// The modules a member may see. null/undefined = all (default). Hub is always visible.
export function visibleModules(allowed?: string[] | null): AppModule[] {
  if (!allowed) return MODULES;
  const set = new Set(allowed);
  return MODULES.filter((m) => m.key === "hub" || set.has(m.key));
}

// The keys that can be toggled off (everything except hub, which is always on).
export const ASSIGNABLE_MODULES = MODULES.filter((m) => m.key !== "hub");

export function canAccess(key: ModuleKey, allowed?: string[] | null): boolean {
  return key === "hub" || !allowed || allowed.includes(key);
}
