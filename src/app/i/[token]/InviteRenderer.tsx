"use client";

import type { InviteConfig, Section } from "@/lib/invite-config";
import { themeVars } from "@/lib/invite-config";
import { pageBySlug, type SiteConfig } from "@/lib/site-config";
import { RsvpForm, type InviteGuest } from "./RsvpForm";
import { InviteMotion } from "./InviteMotion";

type Mode = "live" | "preview";

export function InviteRenderer({ config, mode, token, guest }: { config: InviteConfig; mode: Mode; token?: string; guest?: InviteGuest }) {
  const hero = config.sections.find((s) => s.type === "hero") as Extract<Section, { type: "hero" }> | undefined;
  const countdown = config.sections.find((s) => s.type === "countdown") as Extract<Section, { type: "countdown" }> | undefined;
  const style: React.CSSProperties = { ...themeVars(config.theme) };
  if (hero) (style as Record<string, string>)["--img-hero"] = `url('${hero.bgImage}')`;

  return (
    <>
      <div className="invite" style={style}>
        <div className="bg-wood" />
        <div className="bg-veil" />
        {config.sections.filter((s) => s.visible).map((s) => (
          <SectionView key={s.id} s={s} mode={mode} token={token} guest={guest} />
        ))}
      </div>
      {mode === "live" && countdown && <InviteMotion targetIso={countdown.targetIso} />}
    </>
  );
}

// Renders ONE page of a multi-page site + a themed top nav (when >1 page).
export function SiteRenderer({ site, pageSlug, mode, token, guest, base = "" }: {
  site: SiteConfig; pageSlug?: string; mode: Mode; token?: string; guest?: InviteGuest; base?: string;
}) {
  const page = pageBySlug(site, pageSlug);
  const hero = page.sections.find((s) => s.type === "hero") as Extract<Section, { type: "hero" }> | undefined;
  const countdown = page.sections.find((s) => s.type === "countdown") as Extract<Section, { type: "countdown" }> | undefined;
  const style: React.CSSProperties = { ...themeVars(site.theme) };
  if (hero) (style as Record<string, string>)["--img-hero"] = `url('${hero.bgImage}')`;

  const navPages = site.pages.filter((p) => p.showInNav);
  const hrefFor = (slug: string) => (slug === "home" ? base || "/" : `${base}/${slug}`);

  return (
    <>
      <div className="invite" style={style}>
        <div className="bg-wood" />
        <div className="bg-veil" />
        {navPages.length > 1 && (
          <nav className="site-nav">
            {navPages.map((p) => (
              <a key={p.id} href={mode === "live" ? hrefFor(p.slug) : undefined} className={p.slug === page.slug ? "current" : ""}>{p.title}</a>
            ))}
          </nav>
        )}
        {page.sections.filter((s) => s.visible).map((s) => (
          <SectionView key={s.id} s={s} mode={mode} token={token} guest={guest} />
        ))}
      </div>
      {mode === "live" && countdown && <InviteMotion targetIso={countdown.targetIso} />}
    </>
  );
}

// rise helper: reveal-on-scroll only in the live invite; always-visible in the builder
const rk = (mode: Mode, base: string, delay?: string) => (mode === "live" ? `${base} rise${delay ? " " + delay : ""}` : base);

function SectionView({ s, mode, token, guest }: { s: Section; mode: Mode; token?: string; guest?: InviteGuest }) {
  switch (s.type) {
    case "hero":
      return (
        <section className="hero">
          <div className="inner">
            <img className={rk(mode, "garland")} src={s.garland} alt="" />
            <div className={rk(mode, "label", "d1")}>{s.label}</div>
            <h1 className={rk(mode, "hero-names", "d1")}>{s.name1}<span className="amp">&amp;</span>{s.name2}</h1>
            <div className={rk(mode, "rule", "d2")}><span className="l" /><span className="d" /><span className="l r" /></div>
            <div className={rk(mode, "hero-date", "d2")}>{s.date}</div>
            <div className={rk(mode, "hero-venue", "d2")}>{s.venue}</div>
          </div>
          <div className="scroll-cue">Explore<span>↓</span></div>
        </section>
      );
    case "story":
      return (
        <section className="sep-top">
          <div className="lights-strip" />
          <div className="wrap">
            <div className={rk(mode, "label")}>{s.label}</div>
            <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
            <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
            <div className={rk(mode, "beats", "d2")}>
              {s.beats.map((b, i) => (
                <div key={i} className="beat"><span className="n">{b.numeral}</span><div><h4>{b.title}</h4><p>{b.text}</p></div></div>
              ))}
            </div>
          </div>
        </section>
      );
    case "photoBand":
      return (
        <section className="photo-band" style={{ backgroundImage: `url('${s.image}')` }}>
          <div className="pb-inner">
            <div className={rk(mode, "pb-script")}>{s.script}</div>
            <div className={rk(mode, "pb-sub", "d1")}>{s.sub}</div>
          </div>
        </section>
      );
    case "details":
      return (
        <section className="sep-top">
          <div className="wrap">
            <div className={rk(mode, "label")}>{s.label}</div>
            <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
            <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
            <div className={rk(mode, "lead", "d1")}>{s.lead}</div>
            <div className="dcards">
              {s.cards.map((c, i) => (
                <div key={i} className={rk(mode, "dcard", i === 0 ? "d1" : "d2")}>
                  <div className="k">{c.kind}</div>
                  <h3>{c.title}</h3>
                  <p>{c.lines.split("\n").map((ln, k) => (<span key={k}>{k > 0 && <br />}{ln}</span>))}</p>
                  {c.time && <div className="time">{c.time}</div>}
                  {c.linkLabel && c.linkHref && <div><a href={c.linkHref} target="_blank" rel="noopener">{c.linkLabel}</a></div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case "countdown":
      return (
        <section className="sep-top">
          <div className="lights-strip" />
          <div className="wrap">
            <div className={rk(mode, "label")}>{s.label}</div>
            <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
            <div className={rk(mode, "cd", "d1")}>
              <div className="cd-box"><div className="cd-n" id={mode === "live" ? "cd-d" : undefined}>{mode === "live" ? "--" : "120"}</div><div className="cd-l">Days</div></div>
              <div className="cd-box"><div className="cd-n" id={mode === "live" ? "cd-h" : undefined}>{mode === "live" ? "--" : "08"}</div><div className="cd-l">Hours</div></div>
              <div className="cd-box"><div className="cd-n" id={mode === "live" ? "cd-m" : undefined}>{mode === "live" ? "--" : "30"}</div><div className="cd-l">Minutes</div></div>
              <div className="cd-box"><div className="cd-n" id={mode === "live" ? "cd-s" : undefined}>{mode === "live" ? "--" : "00"}</div><div className="cd-l">Seconds</div></div>
            </div>
            <div className={rk(mode, "rule", "d2")} style={{ marginTop: 46 }}><span className="l" /><span className="d" /><span className="l r" /></div>
            <div className={rk(mode, "label", "d2")}>{s.dressLabel}</div>
            <div className={rk(mode, "", "d2")} style={{ marginTop: 12 }}><span className="chip">{s.dressChip}</span></div>
            <div className={rk(mode, "lead", "d2")} style={{ marginTop: 16, fontSize: "1.14rem" }}>{s.dressText}</div>
          </div>
        </section>
      );
    case "rsvp":
      return (
        <section className="sep-top" style={{ background: `linear-gradient(rgba(9,6,3,.66),rgba(9,6,3,.82)), url('${s.bgImage}') center/cover` }}>
          <div className="wrap">
            <div className={rk(mode, "label")}>{s.label}</div>
            <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
            <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
            <div className={rk(mode, "lead", "d1")} style={{ fontSize: "1.14rem" }}>{s.lead}</div>
            {mode === "live" && token && guest ? <RsvpForm token={token} guest={guest} /> : <RsvpPreview />}
          </div>
        </section>
      );
    case "footer":
      return (
        <footer className="foot">
          <img className={rk(mode, "bouquet")} src={s.bouquet} alt="" />
          <div className={rk(mode, "fn", "d1")}>{s.name1} <span className="amp">&amp;</span> {s.name2}</div>
          <div className={rk(mode, "fd", "d1")}>{s.dateLine}</div>
        </footer>
      );
  }
}

// Non-functional replica of the RSVP form for the builder preview.
function RsvpPreview() {
  return (
    <form className="rform" onSubmit={(e) => e.preventDefault()}>
      <div className="field"><label>Your Name</label><input type="text" placeholder="First & last name" readOnly /></div>
      <div className="field"><label>Will you be attending?</label>
        <div className="rr">
          <label><input type="radio" name="p" readOnly /><span>Joyfully accepts</span></label>
          <label><input type="radio" name="p" readOnly /><span>Regretfully declines</span></label>
        </div>
      </div>
      <div className="field"><label>Dietary notes</label><textarea placeholder="Allergies, preferences, anything we should know" readOnly /></div>
      <button type="button">Send our reply</button>
    </form>
  );
}
