import { createClient } from "@/lib/supabase/server";
import { INVITE_CSS } from "./invite-styles";
import { type InviteGuest } from "./RsvpForm";
import { InviteRenderer } from "./InviteRenderer";
import { DEFAULT_INVITE, fontsHref, type InviteConfig, type Section } from "@/lib/invite-config";

export const dynamic = "force-dynamic"; // per-token, never cached

type InviteRow = {
  name: string;
  max_seats: number;
  rsvp: "pending" | "yes" | "no";
  attending_count: number | null;
  additional_names: unknown;
  dietary: string | null;
  invite_config: InviteConfig | null;
};

function Head({ config }: { config: InviteConfig }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={fontsHref(config.theme)} />
      <style dangerouslySetInnerHTML={{ __html: INVITE_CSS }} />
      <noscript><style dangerouslySetInnerHTML={{ __html: ".invite .rise{opacity:1;transform:none}" }} /></noscript>
    </>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invite", { p_token: token });
  const row = (Array.isArray(data) ? data[0] : data) as InviteRow | undefined;

  if (error || !row) {
    return (
      <>
        <Head config={DEFAULT_INVITE} />
        <div className="invite">
          <div className="bg-wood" />
          <div className="bg-veil" />
          <section className="hero">
            <div className="inner">
              <div className="label">With love</div>
              <h1 className="hero-names">You’re<span className="amp">&amp;</span>Invited</h1>
              <div className="rule"><span className="l" /><span className="d" /><span className="l r" /></div>
              <p className="lead">We couldn’t find this invitation. Please double-check your link, or reach out and we’ll send a fresh one.</p>
            </div>
          </section>
        </div>
      </>
    );
  }

  const config = normalizeConfig(row.invite_config);
  const guest: InviteGuest = {
    name: row.name,
    maxSeats: row.max_seats,
    rsvp: row.rsvp,
    attending: row.attending_count,
    additional: Array.isArray(row.additional_names) ? row.additional_names.map(String) : [],
    dietary: row.dietary,
  };

  return (
    <>
      <Head config={config} />
      <InviteRenderer config={config} mode="live" token={token} guest={guest} />
    </>
  );
}

// Guard against a partially-saved or empty config.
function normalizeConfig(c: InviteConfig | null): InviteConfig {
  if (!c || !Array.isArray(c.sections) || !c.theme) return DEFAULT_INVITE;
  return { theme: { ...DEFAULT_INVITE.theme, ...c.theme }, sections: c.sections as Section[] };
}
