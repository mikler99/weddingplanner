"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/login/actions";

const NAV = [
  { href: "/", label: "Hub" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/budget", label: "Budget" },
  { href: "/guests", label: "Guests" },
  { href: "/documents", label: "Documents" },
];

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
    <button
      onClick={toggle}
      aria-label="Toggle light or dark theme"
      className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-muted transition hover:text-ink"
    >
      {theme === "dark" ? "☾" : "☀"}
    </button>
  );
}

export function Shell({
  weddingName,
  eventDate,
  children,
}: {
  weddingName: string;
  eventDate: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-ground/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-[13px] font-bold tracking-tight text-white">
              {monogram(weddingName)}
            </span>
            <span className="hidden font-display text-[15px] font-semibold leading-tight sm:block">
              {weddingName}
              {eventDate && <span className="block font-sans text-[11px] font-normal text-muted">{eventDate}</span>}
            </span>
          </Link>

          <nav className="ml-2 flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isActive(n.href) ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/settings"
              aria-current={isActive("/settings") ? "page" : undefined}
              aria-label="Wedding details & settings"
              title="Wedding details"
              className={`grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface transition hover:text-ink ${isActive("/settings") ? "text-ink" : "text-muted"}`}
            >
              ⚙
            </Link>
            <ThemeToggle />
            <form action={signOut}>
              <button className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-muted transition hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
