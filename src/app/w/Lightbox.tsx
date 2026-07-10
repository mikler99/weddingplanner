"use client";

import { useCallback, useEffect, useState } from "react";

// A single, delegated lightbox for the whole live site. Any element carrying a
// `data-full="<url>"` opens it; siblings within the same `[data-gallery]`
// container become the prev/next set. Mounted once by SiteRenderer (live only),
// so galleries don't have to thread any props.
export function Lightbox() {
  const [items, setItems] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const open = items.length > 0;

  const close = useCallback(() => setItems([]), []);
  const step = useCallback((d: number) => setItems((cur) => { if (cur.length) setIdx((i) => (i + d + cur.length) % cur.length); return cur; }), []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>("[data-full]");
      if (!el) return;
      const url = el.getAttribute("data-full");
      if (!url) return;
      e.preventDefault();
      e.stopPropagation();
      const group = el.closest<HTMLElement>("[data-gallery]") ?? document.body;
      const els = Array.from(group.querySelectorAll<HTMLElement>("[data-full]"));
      const urls = els.map((x) => x.getAttribute("data-full") || "").filter(Boolean);
      setItems(urls.length ? urls : [url]);
      setIdx(Math.max(0, els.indexOf(el)));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, step]);

  if (!open) return null;
  return (
    <div className="lb-overlay" onClick={close}>
      <button className="lb-close" aria-label="Close" onClick={close}>✕</button>
      {items.length > 1 && <button className="lb-nav lb-prev" aria-label="Previous" onClick={(e) => { e.stopPropagation(); step(-1); }}>‹</button>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="lb-img" src={items[idx]} alt="" onClick={(e) => e.stopPropagation()} />
      {items.length > 1 && <button className="lb-nav lb-next" aria-label="Next" onClick={(e) => { e.stopPropagation(); step(1); }}>›</button>}
      {items.length > 1 && <span className="lb-count">{idx + 1} / {items.length}</span>}
    </div>
  );
}
