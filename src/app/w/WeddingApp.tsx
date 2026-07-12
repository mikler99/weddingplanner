"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { qrSvg } from "@/lib/qr";
import {
  createPhotoUpload, addPhoto, getPhotos, type PhotoItem,
  getTableInfo, type TableInfo,
  addGuestbook, getGuestbook, type GuestbookItem,
  addSong, getSongs, type SongItem,
} from "./app-actions";

// The guest's name is shared across the wedding-day widgets (camera + songs),
// remembered in localStorage so they only type it once.
function useGuestName(): [string, (v: string) => void] {
  const [name, setName] = useState("");
  useEffect(() => { try { setName(localStorage.getItem("wed_guest_name") || ""); } catch {} }, []);
  const set = (v: string) => { setName(v); try { localStorage.setItem("wed_guest_name", v); } catch {} };
  return [name, set];
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

// Shared upload flow: signed URL → direct upload → record row. Used by both the
// free camera and the scavenger hunt.
async function uploadGuestPhoto(slug: string, file: File, opts: { name?: string; caption?: string; prompt?: string; tableToken?: string }): Promise<{ ok: boolean; error?: string }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const up = await createPhotoUpload(slug, ext, opts.tableToken);
  if (!up.ok || !up.path || !up.token) return { ok: false, error: up.error || "Upload failed" };
  const sb = createClient();
  const { error } = await sb.storage.from("wedding-photos").uploadToSignedUrl(up.path, up.token, file);
  if (error) return { ok: false, error: "Upload failed" };
  const rec = await addPhoto({ slug, path: up.path, uploaderName: opts.name, caption: opts.caption, prompt: opts.prompt, tableToken: opts.tableToken });
  return rec.ok ? { ok: true } : { ok: false, error: rec.error || "Could not save" };
}

// A guest's personal roll of film, counted in localStorage (playful/soft — the
// "disposable" feel, not a hard server limit since guests are anonymous).
function useShotCount(slug: string): [number, () => void] {
  const key = `wed_shots_${slug}`;
  const [used, setUsed] = useState(0);
  useEffect(() => { try { setUsed(Number(localStorage.getItem(key) || "0")); } catch {} }, [key]);
  const spend = () => setUsed((u) => { const n = u + 1; try { localStorage.setItem(key, String(n)); } catch {} return n; });
  return [used, spend];
}

// A grid of photos with lightbox (data-full / data-gallery are read by <Lightbox>).
function PhotoGrid({ photos, groupId }: { photos: PhotoItem[]; groupId: string }) {
  return (
    <div className="wd-gallery" data-gallery={groupId}>
      {photos.map((p) => (
        <figure key={p.id} className="wd-shot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt={p.caption || "Guest photo"} loading="lazy" data-full={p.url} />
          {(p.caption || p.uploaderName) && (
            <figcaption>{p.caption}{p.uploaderName ? <span className="wd-by"> — {p.uploaderName}</span> : null}</figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

// --- Disposable camera (free shooting, limited shots) ------------------------
// Two limit modes:
//  • Table QR (?t=<token>): a shared, SERVER-enforced roll for the whole table.
//  • General site link: a per-guest soft limit tracked in localStorage.
export function CameraBlock({ slug, shots }: { slug: string; shots: number }) {
  const [name, setName] = useGuestName();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [tableToken, setTableToken] = useState<string | null>(null);
  const [table, setTable] = useState<TableInfo | null>(null);
  const [used, spend] = useShotCount(slug);
  const fileRef = useRef<HTMLInputElement>(null);
  const caption = useRef<HTMLInputElement>(null);

  useEffect(() => { try { const t = new URLSearchParams(window.location.search).get("t"); if (t) setTableToken(t); } catch {} }, []);
  const loadTable = () => { if (tableToken) getTableInfo(slug, tableToken).then(setTable).catch(() => {}); };
  useEffect(() => { loadTable(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tableToken, slug]);

  const load = () => { getPhotos(slug).then(setPhotos).catch(() => {}); };
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [slug]);

  const tableMode = !!tableToken;
  const generalLimit = shots > 0 ? shots : Infinity;
  const remaining = tableMode ? (table?.remaining ?? 0) : generalLimit - used;
  const tableInvalid = tableMode && table !== null && !table.ok;
  const outOfFilm = tableInvalid || (tableMode ? table !== null && remaining <= 0 : remaining <= 0);
  const showCount = tableMode ? table?.ok : Number.isFinite(generalLimit);

  const qr = useMemo(() => {
    if (typeof window === "undefined") return "";
    try { return qrSvg(window.location.href, { margin: 2, dark: "#1a120a", light: "#f6efe0" }); } catch { return ""; }
  }, []);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || outOfFilm) return;
    setErr(null); setBusy(true);
    try {
      const r = await uploadGuestPhoto(slug, file, { name, caption: caption.current?.value, tableToken: tableToken ?? undefined });
      if (!r.ok) throw new Error(r.error);
      if (caption.current) caption.current.value = "";
      if (tableMode) loadTable(); else spend();
      load();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Something went wrong.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="wd-camera">
      <div className="wd-cam-controls">
        {tableInvalid ? (
          <p className="wd-err" style={{ textAlign: "center" }}>{table?.error || "That camera code isn't valid."}</p>
        ) : (
          <>
            {tableMode && table?.name && <p className="wd-film-table">🎞️ {table.name}’s camera <span>· shared roll</span></p>}
            {showCount && (
              <div className={`wd-film ${outOfFilm ? "empty" : ""}`}>
                <span className="wd-film-count">{Math.max(0, remaining)}</span>
                <span className="wd-film-label">{outOfFilm ? "🎞️ Out of film" : `shot${remaining === 1 ? "" : "s"} left${tableMode ? " (shared)" : ""}`}</span>
              </div>
            )}
            {!outOfFilm && <>
              <input className="wd-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (so we know who to thank)" />
              <input className="wd-input" ref={caption} type="text" placeholder="Add a caption (optional)" />
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
              <button type="button" className="wd-shutter" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Adding…" : "📷 Take a photo"}</button>
            </>}
            {outOfFilm && <p className="wd-empty" style={{ marginTop: 0 }}>{tableMode ? "Your table's roll is used up — thank you for capturing the day!" : "Your roll is used up — thank you for capturing the day!"} The photos are in the gallery below.</p>}
          </>
        )}
        {err && <p className="wd-err">{err}</p>}
        {qr && (
          <button type="button" className="wd-qr-toggle" onClick={() => setShowQr((v) => !v)}>{showQr ? "Hide QR" : "Share this camera (QR)"}</button>
        )}
        {showQr && qr && (
          <div className="wd-qr"><div className="wd-qr-img" dangerouslySetInnerHTML={{ __html: qr }} /><p>Scan to open this camera on another phone</p></div>
        )}
      </div>

      {photos.length > 0 ? <PhotoGrid photos={photos} groupId={`cam-${slug}`} /> : <p className="wd-empty">Be the first to add a photo ✨</p>}
    </div>
  );
}

// --- Photo scavenger hunt ----------------------------------------------------
export function ScavengerBlock({ slug, prompts }: { slug: string; prompts: string[] }) {
  const [name] = useGuestName();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [busyPrompt, setBusyPrompt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const activePrompt = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const doneKey = `wed_hunt_${slug}`;

  const load = () => { getPhotos(slug).then(setPhotos).catch(() => {}); };
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [slug]);
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem(doneKey) || "[]")); } catch {} }, [doneKey]);

  const markDone = (p: string) => setDone((d) => { const n = d.includes(p) ? d : [...d, p]; try { localStorage.setItem(doneKey, JSON.stringify(n)); } catch {} return n; });

  const capture = (prompt: string) => { activePrompt.current = prompt; fileRef.current?.click(); };
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; const prompt = activePrompt.current;
    if (!file || !prompt) return;
    setErr(null); setBusyPrompt(prompt);
    try {
      const r = await uploadGuestPhoto(slug, file, { name, prompt });
      if (!r.ok) throw new Error(r.error);
      markDone(prompt); load();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Something went wrong.");
    } finally {
      setBusyPrompt(null); activePrompt.current = null;
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const completed = done.length;
  return (
    <div className="wd-hunt">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
      {prompts.length > 0 && <p className="wd-hunt-progress">{completed} of {prompts.length} captured</p>}
      {err && <p className="wd-err" style={{ textAlign: "center" }}>{err}</p>}
      <div className="wd-hunt-list">
        {prompts.map((p, i) => {
          const shots = photos.filter((ph) => ph.prompt === p);
          const isDone = done.includes(p) || shots.length > 0;
          return (
            <div key={i} className={`wd-hunt-item ${isDone ? "done" : ""}`}>
              <div className="wd-hunt-head">
                <span className="wd-hunt-check">{isDone ? "✓" : i + 1}</span>
                <span className="wd-hunt-text">{p}</span>
                <button type="button" className="wd-hunt-btn" disabled={busyPrompt === p} onClick={() => capture(p)}>{busyPrompt === p ? "…" : shots.length ? "＋" : "📷"}</button>
              </div>
              {shots.length > 0 && <PhotoGrid photos={shots} groupId={`hunt-${slug}-${i}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Guestbook ---------------------------------------------------------------
export function GuestbookBlock({ slug }: { slug: string }) {
  const [name, setName] = useGuestName();
  const [message, setMessage] = useState("");
  const [entries, setEntries] = useState<GuestbookItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = () => { getGuestbook(slug).then(setEntries).catch(() => {}); };
  useEffect(() => { load(); }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    const r = await addGuestbook({ slug, name, message });
    setBusy(false);
    if (!r.ok) { setErr(r.error || "Could not post."); return; }
    setMessage(""); setDone(true); load();
    setTimeout(() => setDone(false), 4000);
  };

  return (
    <div className="wd-guestbook">
      <form className="wd-gb-form" onSubmit={submit}>
        <input className="wd-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        <textarea className="wd-input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your wish for the newlyweds…" rows={3} />
        {err && <p className="wd-err">{err}</p>}
        <button type="submit" className="wd-shutter" disabled={busy}>{busy ? "Signing…" : done ? "Thank you! ♥" : "Sign the guestbook"}</button>
      </form>
      {entries.length > 0 && (
        <div className="wd-notes">
          {entries.map((e) => (
            <blockquote key={e.id} className="wd-note">
              <p>{e.message}</p>
              <cite>{e.name}<span className="wd-when"> · {relTime(e.createdAt)}</span></cite>
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Song requests -----------------------------------------------------------
export function SongsBlock({ slug }: { slug: string }) {
  const [name, setName] = useGuestName();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [songs, setSongs] = useState<SongItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => { getSongs(slug).then(setSongs).catch(() => {}); };
  useEffect(() => { load(); }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    const r = await addSong({ slug, title, artist, requestedBy: name });
    setBusy(false);
    if (!r.ok) { setErr(r.error || "Could not add."); return; }
    setTitle(""); setArtist(""); load();
  };

  return (
    <div className="wd-songs">
      <form className="wd-song-form" onSubmit={submit}>
        <input className="wd-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" />
        <input className="wd-input" type="text" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist (optional)" />
        <input className="wd-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" />
        {err && <p className="wd-err">{err}</p>}
        <button type="submit" className="wd-shutter" disabled={busy}>{busy ? "Adding…" : "🎵 Request this song"}</button>
      </form>
      {songs.length > 0 && (
        <ul className="wd-songlist">
          {songs.map((s) => (
            <li key={s.id}><span className="wd-song-title">{s.title}</span>{s.artist && <span className="wd-song-artist"> — {s.artist}</span>}{s.requestedBy && <span className="wd-when"> · {s.requestedBy}</span>}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
