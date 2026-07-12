"use client";

import { useState } from "react";
import { setHidden, removeItem, type ModerationData, type ModKind } from "./actions";

type Tab = "photos" | "notes" | "songs";

export function ModerationClient({ initial }: { initial: ModerationData }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>("photos");

  const patchLocal = (kind: ModKind, id: string, hidden: boolean) => setData((d) => ({
    ...d,
    photos: kind === "photo" ? d.photos.map((p) => (p.id === id ? { ...p, hidden } : p)) : d.photos,
    notes: kind === "note" ? d.notes.map((p) => (p.id === id ? { ...p, hidden } : p)) : d.notes,
    songs: kind === "song" ? d.songs.map((p) => (p.id === id ? { ...p, hidden } : p)) : d.songs,
  }));
  const dropLocal = (kind: ModKind, id: string) => setData((d) => ({
    photos: kind === "photo" ? d.photos.filter((p) => p.id !== id) : d.photos,
    notes: kind === "note" ? d.notes.filter((p) => p.id !== id) : d.notes,
    songs: kind === "song" ? d.songs.filter((p) => p.id !== id) : d.songs,
  }));

  const toggle = (kind: ModKind, id: string, hidden: boolean) => { patchLocal(kind, id, hidden); setHidden(kind, id, hidden); };
  const del = (kind: ModKind, id: string, label: string) => { if (!confirm(`Delete this ${label} permanently?`)) return; dropLocal(kind, id); removeItem(kind, id); };

  const counts = { photos: data.photos.length, notes: data.notes.length, songs: data.songs.length };

  return (
    <div>
      <div className="flex gap-1 border-b border-line text-sm">
        {(["photos", "notes", "songs"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 capitalize ${tab === t ? "border-b-2 border-accent font-semibold text-accent" : "text-muted hover:text-ink"}`}>
            {t === "notes" ? "Guestbook" : t} <span className="text-faint">({counts[t]})</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "photos" && (
          data.photos.length === 0 ? <Empty>No photos yet.</Empty> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.photos.map((p) => (
                <figure key={p.id} className={`overflow-hidden rounded-lg border border-line ${p.hidden ? "opacity-50" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption || ""} className="aspect-square w-full object-cover" />
                  <figcaption className="p-2">
                    <p className="truncate text-xs text-muted">{p.caption || p.prompt || "—"}{p.uploaderName ? ` · ${p.uploaderName}` : ""}</p>
                    <div className="mt-1.5 flex gap-1">
                      <button onClick={() => toggle("photo", p.id, !p.hidden)} className="flex-1 rounded border border-line py-1 text-xs hover:border-accent">{p.hidden ? "Show" : "Hide"}</button>
                      <button onClick={() => del("photo", p.id, "photo")} className="rounded border border-line px-2 py-1 text-xs text-faint hover:text-bad">✕</button>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          )
        )}

        {tab === "notes" && (
          data.notes.length === 0 ? <Empty>No guestbook notes yet.</Empty> : (
            <div className="space-y-2">
              {data.notes.map((n) => (
                <div key={n.id} className={`rounded-lg border border-line p-3 ${n.hidden ? "opacity-50" : ""}`}>
                  <p className="text-sm">{n.message}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="flex-1 text-xs text-muted">— {n.name}</span>
                    <button onClick={() => toggle("note", n.id, !n.hidden)} className="rounded border border-line px-2 py-1 text-xs hover:border-accent">{n.hidden ? "Show" : "Hide"}</button>
                    <button onClick={() => del("note", n.id, "note")} className="rounded border border-line px-2 py-1 text-xs text-faint hover:text-bad">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "songs" && (
          data.songs.length === 0 ? <Empty>No song requests yet.</Empty> : (
            <div className="space-y-2">
              {data.songs.map((s) => (
                <div key={s.id} className={`flex items-center gap-2 rounded-lg border border-line p-3 ${s.hidden ? "opacity-50" : ""}`}>
                  <span className="min-w-0 flex-1 text-sm"><span className="font-medium">{s.title}</span>{s.artist ? <span className="text-muted"> — {s.artist}</span> : null}{s.requestedBy ? <span className="text-faint"> · {s.requestedBy}</span> : null}</span>
                  <button onClick={() => toggle("song", s.id, !s.hidden)} className="rounded border border-line px-2 py-1 text-xs hover:border-accent">{s.hidden ? "Show" : "Hide"}</button>
                  <button onClick={() => del("song", s.id, "request")} className="rounded border border-line px-2 py-1 text-xs text-faint hover:text-bad">✕</button>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="rounded-lg border border-dashed border-line py-8 text-center text-sm text-muted">{children}</p>;
