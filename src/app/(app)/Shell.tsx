"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/login/actions";
import { visibleModules, GROUP_ORDER, type AppModule } from "@/lib/modules";

function monogram(name: string) {
  const parts = name.split(/&|\band\b|\+/).map((s) => s.trim()).filter(Boolean);
  const initials = parts.length >= 2 ? parts.map((p) => p[0]).slice(0, 2) : name.trim().slice(0, 2).split("");
  return initials.map((c) => c?.toUpperCase()).join("·") || "W";
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    setTheme(attr ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch {}
  };
  return (
    <button onClick={toggle} aria-label="Toggle light or dark theme" className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-muted transition hover:text-ink">
      {theme === "dark" ? "☾" : "☀"}
    </button>
  );
}

export function Shell({
  weddingName,
  eventDate,
  role,
  allowedModules,
  children,
}: {
  weddingName: string;
  eventDate: string | null;
  role?: "owner" | "editor" | "viewer";
  allowedModules?: string[] | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]); // close the drawer on navigation

  const isViewer = role === "viewer";
  // Owners always see everything; others are filtered by their allowed modules.
  const mods = visibleModules(role === "owner" ? null : allowedModules);

  const sidebar = (
    <SidebarBody weddingName={weddingName} eventDate={eventDate} mods={mods} isViewer={isViewer} pathname={pathname} onNavigate={() => setOpen(false)} />
  );

  return (
    <div className="lg:flex lg:min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-none border-r border-line bg-surface lg:block">{sidebar}</aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-ground/85 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-lg leading-none text-muted">☰</button>
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-[11px] font-bold text-white">{monogram(weddingName)}</span>
          <span className="truncate font-display text-sm font-semibold">{weddingName}</span>
        </Link>
        {isViewer && <span className="ml-auto rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted">View only</span>}
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="Close menu" />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[82%] border-r border-line bg-surface shadow-xl">{sidebar}</aside>
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function SidebarBody({ weddingName, eventDate, mods, isViewer, pathname, onNavigate }: {
  weddingName: string; eventDate: string | null; mods: AppModule[]; isViewer: boolean; pathname: string; onNavigate: () => void;
}) {
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const groups = GROUP_ORDER.filter((g) => mods.some((m) => m.group === g));

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-accent text-[13px] font-bold tracking-tight text-white">{monogram(weddingName)}</span>
        <span className="min-w-0 font-display text-[15px] font-semibold leading-tight">
          <span className="block truncate">{weddingName}</span>
          {eventDate && <span className="block font-sans text-[11px] font-normal text-muted">{eventDate}</span>}
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((g) => (
          <div key={g} className="mb-3">
            <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-faint">{g}</p>
            {mods.filter((m) => m.group === g).map((m) => (
              <Link
                key={m.key}
                href={m.href}
                onClick={onNavigate}
                aria-current={isActive(m.href) ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
                  isActive(m.href) ? "bg-accent-weak text-accent" : "text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <span className="w-5 flex-none text-center text-[13px]">{m.icon}</span>
                <span className="truncate">{m.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2 border-t border-line p-3">
        {isViewer ? (
          <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">View only</span>
        ) : (
          <Link href="/settings" onClick={onNavigate} aria-label="Wedding details & settings" title="Settings" className={`grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface transition hover:text-ink ${pathname.startsWith("/settings") ? "text-ink" : "text-muted"}`}>⚙</Link>
        )}
        <ThemeToggle />
        <form action={signOut} className="ml-auto">
          <button className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-muted transition hover:text-ink">Sign out</button>
        </form>
      </div>
    </div>
  );
}
