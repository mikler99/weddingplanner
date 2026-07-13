"use server";

import { z } from "zod";

// One-click email sending via Resend. Lights up when the couple sets
// RESEND_API_KEY (and INVITE_FROM_EMAIL, a verified sender). Until then it
// returns notConfigured so the UI can steer them to copy/export instead.

const recipients = z.array(
  z.object({ name: z.string().max(200), email: z.string().email(), url: z.string().url() })
).min(1).max(500);

export type SendResult =
  | { ok: true; sent: number; failed: number; reason?: string }
  | { ok: false; notConfigured?: true; error: string };

export async function sendInvites(coupleName: string, input: z.infer<typeof recipients>): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL; // e.g. "Michael & Olivia <rsvp@yourdomain.com>"
  if (!key || !from) {
    return {
      ok: false,
      notConfigured: true,
      error: "Email sending isn’t set up yet. Add RESEND_API_KEY and INVITE_FROM_EMAIL (a verified sender) to enable one-click sending — until then, use Copy links or Export CSV.",
    };
  }
  const parsed = recipients.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some recipients were invalid (missing a valid email)." };

  let sent = 0;
  let failed = 0;
  let reason = "";
  // Resend has no bulk endpoint with per-recipient bodies; send individually.
  const results = await Promise.allSettled(
    parsed.data.map(async (r) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: r.email,
          subject: `You're invited — ${coupleName}`,
          html: inviteEmailHtml(coupleName, r.name, r.url),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string; error?: { message?: string } } | null;
        throw new Error(body?.message || body?.error?.message || `HTTP ${res.status}`);
      }
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled") sent++;
    else { failed++; if (!reason) reason = String((r.reason as Error)?.message ?? "").slice(0, 220); }
  }
  return { ok: true, sent, failed, reason: failed ? reason : undefined };
}

// A gentle nudge to guests who haven't replied yet. Same plumbing as invites.
export async function sendReminders(coupleName: string, deadline: string | null, input: z.infer<typeof recipients>): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL;
  if (!key || !from) {
    return { ok: false, notConfigured: true, error: "Email sending isn’t set up yet. Add RESEND_API_KEY and INVITE_FROM_EMAIL to enable reminders — until then, use Copy links." };
  }
  const parsed = recipients.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some recipients were invalid (missing a valid email)." };

  const by = deadline ? new Date(deadline + "T00:00:00").toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" }) : null;
  let sent = 0, failed = 0, reason = "";
  const results = await Promise.allSettled(
    parsed.data.map(async (r) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: r.email, subject: `A quick RSVP reminder — ${coupleName}`, html: reminderEmailHtml(coupleName, r.name, r.url, by) }),
      });
      if (!res.ok) { const b = (await res.json().catch(() => null)) as { message?: string; error?: { message?: string } } | null; throw new Error(b?.message || b?.error?.message || `HTTP ${res.status}`); }
    })
  );
  for (const r of results) { if (r.status === "fulfilled") sent++; else { failed++; if (!reason) reason = String((r.reason as Error)?.message ?? "").slice(0, 220); } }
  return { ok: true, sent, failed, reason: failed ? reason : undefined };
}

function reminderEmailHtml(couple: string, name: string, url: string, by: string | null): string {
  return `<div style="font-family:Georgia,serif;background:#0e0a06;color:#efe4cf;padding:40px 24px;text-align:center">
    <p style="letter-spacing:.3em;text-transform:uppercase;color:#c9a86a;font-size:12px">A gentle reminder</p>
    <h1 style="font-weight:500;font-size:34px;margin:12px 0">${couple}</h1>
    <p style="color:#c4b79c;font-size:17px;margin:0 0 8px">Dear ${name}, we haven’t heard from you yet and would love to know if you can join us.</p>
    ${by ? `<p style="color:#c9a86a;font-size:15px;margin:0 0 24px">Kindly reply by ${by}.</p>` : `<p style="margin:0 0 24px"></p>`}
    <a href="${url}" style="display:inline-block;background:linear-gradient(120deg,#dcc38d,#c9a86a);color:#20160c;text-decoration:none;padding:14px 30px;border-radius:3px;letter-spacing:.14em;text-transform:uppercase;font-size:13px">RSVP now</a>
    <p style="color:#9d9079;font-size:13px;margin-top:24px">${url}</p>
  </div>`;
}

function inviteEmailHtml(couple: string, name: string, url: string): string {
  return `<div style="font-family:Georgia,serif;background:#0e0a06;color:#efe4cf;padding:40px 24px;text-align:center">
    <p style="letter-spacing:.3em;text-transform:uppercase;color:#c9a86a;font-size:12px">You're invited</p>
    <h1 style="font-weight:500;font-size:34px;margin:12px 0">${couple}</h1>
    <p style="color:#c4b79c;font-size:17px;margin:0 0 24px">Dear ${name}, we would be honoured to have you celebrate with us.</p>
    <a href="${url}" style="display:inline-block;background:linear-gradient(120deg,#dcc38d,#c9a86a);color:#20160c;text-decoration:none;padding:14px 30px;border-radius:3px;letter-spacing:.14em;text-transform:uppercase;font-size:13px">View invitation &amp; RSVP</a>
    <p style="color:#9d9079;font-size:13px;margin-top:24px">${url}</p>
  </div>`;
}
