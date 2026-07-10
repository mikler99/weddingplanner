"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { qrSvg } from "@/lib/qr";
import {
  createPhotoUpload, addPhoto, getPhotos, type PhotoItem,
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

// --- Disposable camera -------------------------------------------------------
export function CameraBlock({ slug, prompts }: { slug: string; prompts: string[] }) {
  const [name, setName] = useGuestName();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [promptIdx, setPromptIdx] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const caption = useRef<HTMLInputElement>(null);

  const load = () => { getPhotos(slug).then(setPhotos).catch(() => {}); };
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [slug]);

  const prompt = prompts.length ? prompts[promptIdx % prompts.length] : "";
  const shuffle = () => setPromptIdx((i) => i + 1);

  const qr = useMemo(() => {
    if (typeof window === "undefined") return "";
    try { return qrSvg(window.location.href, { margin: 2, dark: "#1a120a", light: "#f6efe0" }); } catch { return ""; }
  }, []);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const up = await createPhotoUpload(slug, ext);
      if (!up.ok || !up.path || !up.token) throw new Error(up.error || "Upload failed");
      const sb = createClient();
      const { error } = await sb.storage.from("wedding-photos").uploadToSignedUrl(up.path, up.token, file);
      if (error) throw new Error("Upload failed");
      const rec = await addPhoto({ slug, path: up.path, uploaderName: name, caption: caption.current?.value, prompt });
      if (!rec.ok) throw new Error(rec.error || "Could not save");
      if (caption.current) caption.current.value = "";
      shuffle();
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
      {prompt && (
        <div className="wd-prompt">
          <span className="wd-prompt-eyebrow">Photo challenge</span>
          <span className="wd-prompt-text">{prompt}</span>
          <button type="button" className="wd-shuffle" onClick={shuffle} aria-label="Next challenge">↻</button>
        </div>
      )}
      <div className="wd-cam-controls">
        <input className="wd-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (so we know who to thank)" />
        <input className="wd-input" ref={caption} type="text" placeholder="Add a caption (optional)" />
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
        <button type="button" className="wd-shutter" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "Adding…" : "📷 Take a photo"}
        </button>
        {err && <p className="wd-err">{err}</p>}
        {qr && (
          <button type="button" className="wd-qr-toggle" onClick={() => setShowQr((v) => !v)}>
            {showQr ? "Hide QR" : "Share this camera (QR)"}
          </button>
        )}
        {showQr && qr && (
          <div className="wd-qr"><div className="wd-qr-img" dangerouslySetInnerHTML={{ __html: qr }} /><p>Scan to open the camera on another phone</p></div>
        )}
      </div>

      {photos.length > 0 ? (
        <div className="wd-gallery">
          {photos.map((p) => (
            <figure key={p.id} className="wd-shot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption || "Guest photo"} loading="lazy" />
              {(p.caption || p.uploaderName) && (
                <figcaption>{p.caption}{p.uploaderName ? <span className="wd-by"> — {p.uploaderName}</span> : null}</figcaption>
              )}
            </figure>
          ))}
        </div>
      ) : (
        <p className="wd-empty">Be the first to add a photo ✨</p>
      )}
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
