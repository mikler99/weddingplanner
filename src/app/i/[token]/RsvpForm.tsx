"use client";

import { useState } from "react";
import { submitRsvp } from "./actions";

export type InviteGuest = {
  name: string;
  maxSeats: number;
  rsvp: "pending" | "yes" | "no";
  attending: number | null;
  additional: string[];
  dietary: string | null;
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "'Cormorant Garamond',serif",
  fontSize: "1.14rem",
  color: "var(--ink)",
  padding: "12px 14px",
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(201,168,106,.3)",
  borderRadius: "3px",
  outline: "none",
};

export function RsvpForm({ token, guest }: { token: string; guest: InviteGuest }) {
  const hasPlus = guest.maxSeats > 1;
  const [att, setAtt] = useState<"" | "yes" | "no">(guest.rsvp === "yes" || guest.rsvp === "no" ? guest.rsvp : "");
  const [count, setCount] = useState(guest.attending && guest.attending > 0 ? Math.min(guest.attending, guest.maxSeats) : guest.maxSeats);
  const [names, setNames] = useState<string[]>(() => {
    const seed = guest.additional ?? [];
    return Array.from({ length: Math.max(0, guest.maxSeats - 1) }, (_, i) => seed[i] ?? "");
  });
  const [dietary, setDietary] = useState(guest.dietary ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const setName = (i: number, v: string) => setNames((ns) => ns.map((n, k) => (k === i ? v : n)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (att !== "yes" && att !== "no") { setErr("Please let us know if you can make it."); return; }
    setErr(null);
    setBusy(true);
    const res = await submitRsvp({
      token,
      rsvp: att,
      attending: att === "yes" ? (hasPlus ? count : 1) : 0,
      additional: att === "yes" && hasPlus ? names.slice(0, count - 1) : [],
      dietary: dietary || null,
    });
    setBusy(false);
    if (res.ok) setDone(true);
    else setErr(res.error);
  };

  if (done) {
    return (
      <div className="thanks" style={{ display: "block" }}>
        Thank you, {guest.name.split(" ")[0]} — we cannot wait to celebrate with you.
      </div>
    );
  }

  return (
    <form className="rform rise d2" onSubmit={submit}>
      <div className="field">
        <label htmlFor="r-name">Your Name</label>
        <input type="text" id="r-name" defaultValue={guest.name} placeholder="First & last name" required />
      </div>

      <div className="field">
        <label>Will you be attending?</label>
        <div className="rr">
          <label>
            <input type="radio" name="att" value="yes" checked={att === "yes"} onChange={() => setAtt("yes")} />
            <span>Joyfully accepts</span>
          </label>
          <label>
            <input type="radio" name="att" value="no" checked={att === "no"} onChange={() => setAtt("no")} />
            <span>Regretfully declines</span>
          </label>
        </div>
      </div>

      {hasPlus && att === "yes" && (
        <>
          <div className="field">
            <label htmlFor="r-count">How many in your party? (up to {guest.maxSeats})</label>
            <select id="r-count" value={count} onChange={(e) => setCount(Number(e.target.value))} style={selectStyle}>
              {Array.from({ length: guest.maxSeats }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? "guest" : "guests"}</option>
              ))}
            </select>
          </div>
          {count > 1 && (
            <div className="field">
              <label>Names of your guests</label>
              {Array.from({ length: count - 1 }, (_, i) => (
                <input key={i} type="text" value={names[i] ?? ""} onChange={(e) => setName(i, e.target.value)} placeholder={`Guest ${i + 2}`} style={{ marginBottom: 10 }} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="field">
        <label htmlFor="r-diet">Dietary notes</label>
        <textarea id="r-diet" value={dietary} onChange={(e) => setDietary(e.target.value)} placeholder="Allergies, preferences, anything we should know" />
      </div>

      {err && <p style={{ color: "var(--burg)", fontSize: "1.02rem", margin: "0 0 12px" }}>{err}</p>}
      <button type="submit" disabled={busy}>{busy ? "Sending…" : "Send our reply"}</button>
    </form>
  );
}
