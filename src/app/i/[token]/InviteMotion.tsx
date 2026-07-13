"use client";

import { useEffect } from "react";

// Ports the couple's two inline scripts: the scroll-reveal (.rise → .in) and the
// live countdown. Runs after hydration; scoped to the .invite subtree.
export function InviteMotion({ targetIso }: { targetIso: string }) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".invite .rise"));
    const show = (el: HTMLElement) => el.classList.add("in");
    let obs: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      obs = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) { show(e.target as HTMLElement); obs?.unobserve(e.target); } }),
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
      );
      els.forEach((el) => obs!.observe(el));
    } else {
      els.forEach(show);
    }
    // Fallback: reveal anything already in view shortly after load.
    const t = setTimeout(() => {
      els.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) show(el); });
    }, 2600);
    // Safety net: whatever happens with the observer, nothing stays hidden.
    const t2 = setTimeout(() => els.forEach(show), 5000);

    // Countdown (only when a valid target is provided).
    const target = new Date(targetIso).getTime();
    let iv: ReturnType<typeof setInterval> | undefined;
    if (targetIso && !Number.isNaN(target)) {
      const pad = (n: number) => (n < 10 ? "0" + n : "" + n);
      const set = (id: string, v: string) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      const tick = () => {
        let d = target - Date.now();
        if (d < 0) d = 0;
        set("cd-d", String(Math.floor(d / 86400000)));
        set("cd-h", pad(Math.floor((d % 86400000) / 3600000)));
        set("cd-m", pad(Math.floor((d % 3600000) / 60000)));
        set("cd-s", pad(Math.floor((d % 60000) / 1000)));
      };
      tick();
      iv = setInterval(tick, 1000);
    }

    return () => { obs?.disconnect(); clearTimeout(t); clearTimeout(t2); if (iv) clearInterval(iv); };
  }, [targetIso]);

  return null;
}
