// Auto-scoped port of the couple's hand-built invite stylesheet (all
// selectors namespaced under .invite so nothing leaks into the app).
export const INVITE_CSS = `
.invite{--ink:#efe4cf; --ink-soft:#c4b79c; --ink-dim:#9d9079;
  --gold:#c9a86a; --gold-2:#dcc38d;
  --burg:#b06474; --sage:#9fae8a;
  --panel:rgba(16,11,6,.58);
  --font-display:'Cormorant Garamond'; --font-script:'Pinyon Script'; --font-sans:'Jost';}
.invite *{margin:0;padding:0;box-sizing:border-box}
.invite{scroll-behavior:smooth}
.invite{font-family:var(--font-display),serif;color:var(--ink);
  background:#0e0a06;overflow-x:hidden;}
.invite .bg-wood{position:fixed;inset:0;z-index:-2;background:var(--img-bg,url('/invite/1.jpg')) center/cover}
.invite .bg-veil{position:fixed;inset:0;z-index:-1;
  background:radial-gradient(130% 90% at 50% 0%, rgba(30,20,10,.15), rgba(9,6,3,.86) 72%)}
.invite .script{font-family:var(--font-script),cursive}
.invite .label{font-family:var(--font-sans),sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:.42em;font-size:.68rem;color:var(--gold)}
.invite .h-sec{font-family:var(--font-display),serif;font-weight:500;font-size:clamp(2.2rem,5vw,3.2rem);color:var(--ink);letter-spacing:.02em;line-height:1.05}
.invite .lead{font-family:var(--font-display),serif;font-weight:400;font-size:1.24rem;line-height:1.8;color:var(--ink-soft);max-width:52ch;margin:0 auto}
.invite .rule{display:flex;align-items:center;justify-content:center;gap:16px;color:var(--gold);margin:22px auto}
.invite .rule .l{height:1px;width:70px;background:linear-gradient(90deg,transparent,var(--gold))}
.invite .rule .l.r{background:linear-gradient(90deg,var(--gold),transparent)}
.invite .rule .d{width:7px;height:7px;border:1px solid var(--gold);transform:rotate(45deg)}
.invite section{position:relative;padding:96px 26px;z-index:1}
.invite .wrap{max-width:900px;margin:0 auto;position:relative;z-index:2;text-align:center}
.invite .sep-top{box-shadow:0 -1px 0 rgba(201,168,106,.12)}
.invite .lights-strip{position:relative;display:block;width:min(94%,1150px);margin:-52px auto 10px;
  aspect-ratio:1300/230;background:var(--img-lights,url('/invite/2.png')) center/100% 100% no-repeat;
  pointer-events:none;z-index:3;filter:brightness(1);animation:twinkle 4s ease-in-out infinite}
@keyframes twinkle{0%,100%{filter:brightness(.82)}50%{filter:brightness(1.12)}}
.invite .hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;padding:80px 24px 60px;
  background:linear-gradient(rgba(10,7,3,.42),rgba(10,7,3,.62)), var(--img-hero,url('/invite/3.jpg')) center/cover}
.invite .hero::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(60% 45% at 50% 46%, rgba(8,5,2,.55), transparent 70%)}
.invite .hero .inner{position:relative;z-index:3;max-width:720px}
.invite .garland{width:min(88vw,560px);margin:0 auto -6px;display:block;filter:drop-shadow(0 20px 30px rgba(0,0,0,.5))}
.invite .hero .label{font-size:.74rem}
.invite .hero-names{font-family:var(--font-display),serif;font-weight:500;color:var(--ink);
  font-size:clamp(3rem,9vw,5.6rem);line-height:.98;letter-spacing:.04em;
  text-shadow:0 4px 18px rgba(0,0,0,.6);margin:14px 0 2px}
.invite .hero-names .amp{font-family:var(--font-script),cursive;color:var(--gold-2);font-size:.7em;font-weight:400;
  display:inline-block;margin:0 6px;text-shadow:0 2px 12px rgba(0,0,0,.5)}
.invite .hero-date{font-family:var(--font-display),serif;font-size:1.34rem;letter-spacing:.22em;text-transform:uppercase;
  color:var(--ink);text-shadow:0 2px 10px rgba(0,0,0,.6)}
.invite .hero-venue{font-style:italic;font-size:1.18rem;color:var(--ink-soft);margin-top:6px;text-shadow:0 2px 10px rgba(0,0,0,.6)}
.invite .scroll-cue{position:absolute;bottom:26px;left:50%;transform:translateX(-50%);z-index:3;
  font-family:var(--font-sans);text-transform:uppercase;letter-spacing:.34em;font-size:.6rem;color:var(--ink-soft);
  display:flex;flex-direction:column;align-items:center;gap:8px;animation:bob 2.4s ease-in-out infinite;opacity:.85}
.invite .scroll-cue span{font-size:1rem;color:var(--gold)}
@keyframes bob{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(7px)}}
.invite .print{background:linear-gradient(160deg,#f6efdd,#e9dfc7);padding:11px 11px 11px;border-radius:2px;display:inline-block;
  box-shadow:0 30px 60px -26px rgba(0,0,0,.85), 0 0 0 1px rgba(0,0,0,.15);
  transform:rotate(var(--r,0deg));transition:transform .5s cubic-bezier(.2,.8,.3,1)}
.invite .print img{display:block;object-fit:cover;border-radius:1px}
.invite .print .cap{font-style:italic;font-size:1.02rem;color:#6a5641;text-align:center;padding-top:9px;letter-spacing:.02em}
.invite .print:hover{transform:rotate(0deg) translateY(-6px)}
.invite .print.lg img{width:min(82vw,420px);aspect-ratio:3/2}
.invite .print.port img{width:min(58vw,210px);aspect-ratio:2/3}
.invite .print.land img{width:min(74vw,300px);aspect-ratio:3/2}
.invite .hero-print{margin-top:34px}
.invite .photo-band{position:relative;min-height:82vh;display:flex;align-items:center;justify-content:center;
  text-align:center;padding:80px 26px;background-position:center;background-size:cover;background-repeat:no-repeat}
.invite .photo-band::before{content:"";position:absolute;inset:0;
  background:radial-gradient(70% 60% at 50% 50%, rgba(8,5,2,.28), rgba(8,5,2,.72) 82%),
    linear-gradient(rgba(8,5,2,.35), rgba(8,5,2,.5))}
.invite .photo-band .pb-inner{position:relative;z-index:2;max-width:640px}
.invite .photo-band .pb-script{font-family:var(--font-script),cursive;color:var(--gold-2);font-size:clamp(2.6rem,6vw,4rem);line-height:1;
  text-shadow:0 3px 16px rgba(0,0,0,.7)}
.invite .photo-band .pb-sub{font-family:var(--font-sans);text-transform:uppercase;letter-spacing:.4em;font-size:.72rem;color:var(--ink);
  margin-top:20px;text-shadow:0 2px 10px rgba(0,0,0,.7)}
.invite .prints-row{display:flex;gap:30px;justify-content:center;align-items:flex-start;flex-wrap:wrap;margin:30px 0 8px}
.invite .beats{max-width:540px;margin:26px auto 0;text-align:left}
.invite .beat{display:flex;gap:16px;padding:12px 0;align-items:flex-start}
.invite .beat .n{flex:0 0 auto;font-family:var(--font-script),cursive;color:var(--gold);font-size:2rem;line-height:.8;width:34px;text-align:center}
.invite .beat h4{font-family:var(--font-display),serif;font-weight:600;font-size:1.5rem;color:var(--ink)}
.invite .beat p{font-size:1.1rem;line-height:1.6;color:var(--ink-soft)}
.invite .dcards{display:flex;flex-wrap:wrap;gap:26px;justify-content:center;margin-top:32px}
.invite .dcard{background:var(--panel);border:1px solid rgba(201,168,106,.34);border-radius:3px;padding:30px 28px;
  width:min(100%,350px);text-align:center;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
.invite .dcard .k{font-family:var(--font-sans);text-transform:uppercase;letter-spacing:.3em;font-size:.6rem;color:var(--gold)}
.invite .dcard h3{font-family:var(--font-display),serif;font-weight:500;font-size:1.9rem;color:var(--ink);margin:8px 0 8px}
.invite .dcard p{font-size:1.08rem;line-height:1.55;color:var(--ink-soft)}
.invite .dcard .time{font-style:italic;font-size:1.2rem;color:var(--gold-2);margin-top:8px}
.invite .dcard a{display:inline-block;margin-top:14px;font-family:var(--font-sans);text-transform:uppercase;letter-spacing:.16em;
  font-size:.66rem;color:var(--ink);border-bottom:1px solid var(--gold);padding-bottom:3px;text-decoration:none;transition:color .2s}
.invite .dcard a:hover{color:var(--gold-2)}
.invite .cd{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:30px}
.invite .cd-box{background:var(--panel);border:1px solid rgba(201,168,106,.32);border-radius:3px;padding:20px 16px;min-width:88px;
  -webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
.invite .cd-n{font-family:var(--font-display),serif;font-weight:500;font-size:2.6rem;line-height:1;color:var(--ink)}
.invite .cd-l{font-family:var(--font-sans);text-transform:uppercase;letter-spacing:.2em;font-size:.56rem;color:var(--gold);margin-top:8px}
.invite .chip{display:inline-block;font-family:var(--font-display),serif;font-style:italic;font-size:1.4rem;color:var(--ink);
  border:1px solid var(--gold);padding:7px 28px;border-radius:40px;margin-top:6px}
.invite .rform{max-width:440px;margin:28px auto 0;text-align:left}
.invite .rform .field{margin-bottom:16px}
.invite .rform label{display:block;font-family:var(--font-sans);text-transform:uppercase;letter-spacing:.18em;font-size:.62rem;color:var(--gold);margin-bottom:6px}
.invite .rform input[type=text], .invite .rform textarea{width:100%;font-family:var(--font-display),serif;font-size:1.14rem;color:var(--ink);
  padding:12px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(201,168,106,.3);border-radius:3px;outline:none;transition:border .2s}
.invite .rform input::placeholder, .invite .rform textarea::placeholder{color:var(--ink-dim)}
.invite .rform input:focus, .invite .rform textarea:focus{border-color:var(--gold-2)}
.invite .rform textarea{min-height:60px;resize:vertical}
.invite .rr{display:flex;gap:12px}
.invite .rr label{flex:1;position:relative;margin:0}
.invite .rr input{position:absolute;opacity:0}
.invite .rr span{display:block;text-align:center;padding:12px;border-radius:3px;cursor:pointer;font-family:var(--font-display),serif;font-size:1.16rem;color:var(--ink-soft);
  border:1px solid rgba(201,168,106,.3);background:rgba(255,255,255,.04);transition:all .2s}
.invite .rr input:checked + span{background:rgba(201,168,106,.16);color:var(--ink);border-color:var(--gold)}
.invite .rform button{width:100%;margin-top:6px;font-family:var(--font-sans);font-weight:500;text-transform:uppercase;letter-spacing:.22em;
  font-size:.74rem;color:#20160c;background:linear-gradient(120deg,var(--gold-2),var(--gold));border:none;border-radius:3px;
  padding:15px;cursor:pointer;transition:transform .18s, box-shadow .25s;box-shadow:0 14px 28px -14px rgba(201,168,106,.5)}
.invite .rform button:hover{transform:translateY(-2px);box-shadow:0 18px 34px -14px rgba(201,168,106,.6)}
.invite .thanks{display:none;text-align:center;font-family:var(--font-display),serif;font-style:italic;font-size:1.5rem;color:var(--gold-2);padding:24px}
.invite .foot{position:relative;text-align:center;padding:80px 26px 70px;z-index:1;
  background:linear-gradient(rgba(9,6,3,.6),rgba(9,6,3,.85))}
.invite .foot .bouquet{width:min(80vw,420px);margin:0 auto 6px;display:block;filter:drop-shadow(0 20px 30px rgba(0,0,0,.5))}
.invite .foot .fn{font-family:var(--font-display),serif;font-weight:500;font-size:clamp(2.4rem,6vw,3.4rem);color:var(--ink);letter-spacing:.04em}
.invite .foot .fn .amp{font-family:var(--font-script),cursive;color:var(--gold-2)}
.invite .foot .fd{font-family:var(--font-sans);text-transform:uppercase;letter-spacing:.24em;font-size:.72rem;color:var(--ink-soft);margin-top:10px}
.invite .rise{opacity:0;transform:translateY(26px);transition:opacity 1s ease, transform 1.1s cubic-bezier(.2,.7,.2,1)}
.invite .rise.in{opacity:1;transform:none}
.invite .rise.d1{transition-delay:.12s}
.invite .rise.d2{transition-delay:.26s}
.invite .rise.d3{transition-delay:.4s}
.invite .print.rise{transition:opacity 1.1s ease, transform 1.2s cubic-bezier(.2,.7,.2,1)}
@media(max-width:600px){
.invite section{padding:72px 20px}
.invite .hero{background:linear-gradient(rgba(10,7,3,.42),rgba(10,7,3,.62)), var(--img-hero,url('/invite/3.jpg')) center/cover}
.invite .lights-strip{margin-top:-22px}
.invite .cd-box{min-width:70px;padding:16px 10px}
.invite .cd-n{font-size:2rem}

}
.invite{min-height:100vh}
.invite .site-nav{position:sticky;top:0;z-index:6;display:flex;flex-wrap:wrap;justify-content:center;gap:4px 22px;padding:13px 20px;background:rgba(14,10,6,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border-bottom:1px solid rgba(201,168,106,.18)}
.invite .site-nav a{font-family:var(--font-sans),sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:.66rem;color:var(--ink-soft);text-decoration:none;padding:4px 2px;border-bottom:1px solid transparent;transition:color .2s,border-color .2s}
.invite .site-nav a:hover{color:var(--ink)}
.invite .site-nav a.current{color:var(--gold-2);border-color:var(--gold)}
.invite .timeline{max-width:580px;margin:26px auto 0;text-align:left}
.invite .tl-item{display:flex;gap:18px;padding:14px 0;border-bottom:1px solid rgba(201,168,106,.14)}
.invite .tl-item:last-child{border-bottom:0}
.invite .tl-time{flex:0 0 150px;font-family:var(--font-display),serif;font-style:italic;font-size:1.1rem;color:var(--gold-2)}
.invite .tl-body h4{font-family:var(--font-display),serif;font-weight:600;font-size:1.35rem;color:var(--ink)}
.invite .tl-body p{font-size:1.02rem;color:var(--ink-soft)}
.invite .tl-loc{font-style:italic}
.invite .faq{max-width:620px;margin:22px auto 0;text-align:left}
.invite .faq-item{border-bottom:1px solid rgba(201,168,106,.16)}
.invite .faq-item summary{cursor:pointer;list-style:none;padding:14px 0;font-family:var(--font-display),serif;font-size:1.28rem;color:var(--ink)}
.invite .faq-item summary::-webkit-details-marker{display:none}
.invite .faq-item summary::after{content:"+";float:right;color:var(--gold)}
.invite .faq-item[open] summary::after{content:"–"}
.invite .faq-item p{padding:0 0 14px;font-size:1.05rem;line-height:1.65;color:var(--ink-soft)}
.invite .gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:26px}
.invite .gal-item{aspect-ratio:1;background:center/cover no-repeat;border-radius:2px;box-shadow:0 10px 24px -14px rgba(0,0,0,.7)}
.invite .party-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:28px;margin-top:28px}
.invite .party-member{width:150px;text-align:center}
.invite .pm-photo{width:120px;height:120px;margin:0 auto 10px;border-radius:50%;background:center/cover no-repeat;border:1px solid rgba(201,168,106,.34)}
.invite .party-member h4{font-family:var(--font-display),serif;font-weight:500;font-size:1.3rem;color:var(--ink)}
.invite .party-member p{font-family:var(--font-sans),sans-serif;text-transform:uppercase;letter-spacing:.16em;font-size:.62rem;color:var(--gold);margin-top:2px}

/* Wedding-day app: camera, guestbook, songs */
.invite .wd-input{width:100%;font-family:var(--font-display),serif;font-size:1.1rem;color:var(--ink);padding:12px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(201,168,106,.3);border-radius:3px;outline:none}
.invite .wd-input::placeholder{color:var(--ink-dim)}
.invite .wd-input:focus{border-color:var(--gold)}
.invite textarea.wd-input{resize:vertical;line-height:1.5}
.invite .wd-ph{min-height:44px;background:rgba(255,255,255,.03)}
.invite .wd-shutter{margin-top:4px;font-family:var(--font-sans),sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:.72rem;color:#0e0a06;background:linear-gradient(var(--gold-2),var(--gold));border:none;padding:14px 28px;border-radius:3px;cursor:pointer;transition:filter .2s}
.invite .wd-shutter:hover{filter:brightness(1.08)}
.invite .wd-shutter:disabled{opacity:.6;cursor:default}
.invite .wd-cam-controls,.invite .wd-gb-form,.invite .wd-song-form{display:flex;flex-direction:column;gap:12px;max-width:440px;margin:24px auto 0}
.invite .wd-err{color:#e6a5a5;font-size:.98rem;margin:0}
.invite .wd-empty{margin-top:24px;font-family:var(--font-display),serif;font-style:italic;font-size:1.14rem;color:var(--ink-soft)}
.invite .wd-prompt{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center;max-width:520px;margin:22px auto 0;padding:14px 18px;background:rgba(201,168,106,.1);border:1px solid rgba(201,168,106,.28);border-radius:4px}
.invite .wd-prompt-eyebrow{font-family:var(--font-sans),sans-serif;text-transform:uppercase;letter-spacing:.18em;font-size:.58rem;color:var(--gold)}
.invite .wd-prompt-text{font-family:var(--font-display),serif;font-style:italic;font-size:1.24rem;color:var(--ink)}
.invite .wd-shuffle{background:none;border:1px solid rgba(201,168,106,.4);color:var(--gold-2);width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1rem;line-height:1}
.invite .wd-qr-toggle{background:none;border:none;color:var(--gold-2);font-family:var(--font-sans),sans-serif;text-transform:uppercase;letter-spacing:.16em;font-size:.62rem;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.invite .wd-qr{margin:8px auto 0;text-align:center}
.invite .wd-qr-img{width:180px;height:180px;margin:0 auto;background:#f6efe0;padding:8px;border-radius:6px}
.invite .wd-qr p{font-size:.9rem;color:var(--ink-soft);margin-top:8px}
.invite .wd-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:30px}
.invite .wd-shot{margin:0;position:relative;border-radius:2px;overflow:hidden;background:rgba(0,0,0,.3);box-shadow:0 10px 24px -14px rgba(0,0,0,.7)}
.invite .wd-shot img{display:block;width:100%;aspect-ratio:1;object-fit:cover}
.invite .wd-shot figcaption{position:absolute;left:0;right:0;bottom:0;padding:16px 10px 8px;font-family:var(--font-display),serif;font-size:.98rem;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.72))}
.invite .wd-shot .wd-by{color:var(--gold-2)}
.invite .wd-notes{max-width:560px;margin:30px auto 0;text-align:left;display:flex;flex-direction:column;gap:14px}
.invite .wd-note{margin:0;padding:16px 18px;background:rgba(255,255,255,.04);border-left:2px solid var(--gold);border-radius:2px}
.invite .wd-note p{font-family:var(--font-display),serif;font-size:1.2rem;font-style:italic;color:var(--ink);line-height:1.55}
.invite .wd-note cite{display:block;margin-top:8px;font-family:var(--font-sans),sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:.6rem;color:var(--gold);font-style:normal}
.invite .wd-when{color:var(--ink-dim);letter-spacing:.08em}
.invite .wd-songlist{list-style:none;max-width:520px;margin:28px auto 0;padding:0;text-align:left}
.invite .wd-songlist li{padding:12px 4px;border-bottom:1px solid rgba(201,168,106,.14);color:var(--ink-soft);font-size:1.05rem}
.invite .wd-song-title{font-family:var(--font-display),serif;font-size:1.2rem;color:var(--ink)}
.invite .wd-song-artist{color:var(--ink-soft)}
@media(max-width:560px){.invite .wd-gallery{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}}

/* ---- Element engine: generic sections / columns / widgets ---- */
.invite .node-sec{position:relative;padding:var(--sec-pad,64px 24px);background-repeat:no-repeat}
.invite .node-sec.full{padding:var(--sec-pad,0)}
.invite .node-overlay{position:absolute;inset:0;z-index:0;pointer-events:none}
.invite .node-sec>.node-row{position:relative;z-index:1}
.invite .node-row{max-width:1080px;margin:0 auto;display:flex;gap:28px;flex-wrap:wrap;align-items:flex-start}
.invite .node-col{flex:1 1 100%;min-width:0}
@media(min-width:760px){.invite .node-row .node-col{flex-basis:0}}
.invite .node-w{margin:0 0 4px}
.invite .node-w:last-child{margin-bottom:0}
.invite .nh{font-family:var(--font-display),serif;font-weight:500;color:var(--ink);line-height:1.15;font-size:var(--w-fs,2.2rem)}
.invite .nt{font-family:var(--font-display),serif;color:var(--ink-soft);font-size:var(--w-fs,1.14rem);line-height:1.7;margin:0 0 12px}
.invite .nt:last-child{margin-bottom:0}
.invite .nimg{display:block;max-width:100%;height:auto;margin:0 auto}
.invite .nbtn{display:inline-block;font-family:var(--font-sans),sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:.72rem;padding:13px 30px;border-radius:3px;text-decoration:none;transition:filter .2s,background .2s,color .2s}
.invite .nbtn.solid{color:#0e0a06;background:linear-gradient(var(--gold-2),var(--gold))}
.invite .nbtn.solid:hover{filter:brightness(1.08)}
.invite .nbtn.outline{color:var(--gold-2);border:1px solid var(--gold)}
.invite .nbtn.outline:hover{background:rgba(201,168,106,.12)}
.invite .nhr{border:0;border-top:1px solid rgba(201,168,106,.3);margin:8px 0}
.invite .nornament{display:flex;align-items:center;justify-content:center;gap:10px;margin:6px 0}
.invite .nornament .l{height:1px;width:64px;background:linear-gradient(90deg,transparent,var(--gold))}
.invite .nornament .l.r{background:linear-gradient(90deg,var(--gold),transparent)}
.invite .nornament .d{width:6px;height:6px;transform:rotate(45deg);background:var(--gold)}
.invite .nicon{color:var(--gold);line-height:1}
.invite .nvideo{position:relative;width:100%;aspect-ratio:16/9;border-radius:3px;overflow:hidden;background:#000}
.invite .nvideo iframe,.invite .nvideo video{position:absolute;inset:0;width:100%;height:100%;border:0}
.invite .nmap{width:100%;border-radius:3px;overflow:hidden}
.invite .nmap iframe{width:100%;height:100%;border:0}
.invite .nraw{max-width:100%}
.invite .nembed-empty{padding:28px;border:1px dashed rgba(201,168,106,.4);border-radius:4px;color:var(--ink-dim);font-family:var(--font-sans),sans-serif;font-size:.8rem;text-align:center}
.invite .nquote{margin:0;padding:4px 0 4px 20px;border-left:2px solid var(--gold)}
.invite .nquote p{font-family:var(--font-display),serif;font-style:italic;font-size:var(--w-fs,1.4rem);line-height:1.5;color:var(--ink)}
.invite .nquote cite{display:block;margin-top:10px;font-family:var(--font-sans),sans-serif;text-transform:uppercase;letter-spacing:.16em;font-size:.62rem;color:var(--gold);font-style:normal}
.invite .nlist{margin:0;padding-left:1.2em;color:var(--ink-soft);font-family:var(--font-display),serif;font-size:var(--w-fs,1.14rem);line-height:1.9}
.invite .nlist li{margin:0}
.invite .nsocials{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.invite .nsocial{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;border:1px solid rgba(201,168,106,.4);color:var(--gold-2);font-family:var(--font-display),serif;font-size:1.1rem;text-decoration:none;transition:background .2s,color .2s}
.invite .nsocial:hover{background:var(--gold);color:#0e0a06}
.invite .n-fade{opacity:0;animation:nFade .9s ease forwards}
.invite .n-zoom{opacity:0;transform:scale(.94);animation:nZoom .7s ease forwards}
@keyframes nFade{to{opacity:1}}
@keyframes nZoom{to{opacity:1;transform:none}}
.invite .node-hide-d{display:none}
@media(max-width:600px){
  .invite .node-sec{padding:var(--sec-padm,var(--sec-pad,40px 18px))}
  .invite .node-hide-d{display:block}
  .invite .node-hide-m{display:none}
  .invite .nh{font-size:var(--w-fsm,var(--w-fs,1.7rem))}
  .invite .nt{font-size:var(--w-fsm,var(--w-fs,1.08rem))}
}

/* Disposable-camera film counter */
.invite .wd-film{display:flex;align-items:baseline;justify-content:center;gap:8px;margin-bottom:4px}
.invite .wd-film-count{font-family:var(--font-display),serif;font-size:2.4rem;font-weight:600;color:var(--gold-2);line-height:1}
.invite .wd-film.empty .wd-film-count{color:var(--ink-dim)}
.invite .wd-film-label{font-family:var(--font-sans),sans-serif;text-transform:uppercase;letter-spacing:.16em;font-size:.62rem;color:var(--gold)}
.invite .wd-film-table{text-align:center;font-family:var(--font-display),serif;font-size:1.2rem;color:var(--ink);margin:0 0 4px}
.invite .wd-film-table span{color:var(--gold);font-style:italic;font-size:.9rem}
.invite .gal-item,.invite .wd-shot img,.invite .nimg[data-full]{cursor:zoom-in}

/* Photo scavenger hunt */
.invite .wd-hunt{max-width:600px;margin:24px auto 0}
.invite .wd-hunt-progress{text-align:center;font-family:var(--font-display),serif;font-style:italic;font-size:1.14rem;color:var(--gold-2);margin:0 0 16px}
.invite .wd-hunt-list{display:flex;flex-direction:column;gap:12px;text-align:left}
.invite .wd-hunt-item{padding:14px 16px;background:rgba(255,255,255,.04);border:1px solid rgba(201,168,106,.2);border-radius:4px;transition:border-color .2s}
.invite .wd-hunt-item.done{border-color:rgba(147,172,130,.5);background:rgba(147,172,130,.08)}
.invite .wd-hunt-head{display:flex;align-items:center;gap:12px}
.invite .wd-hunt-check{flex:0 0 26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid rgba(201,168,106,.4);color:var(--gold-2);font-family:var(--font-sans),sans-serif;font-size:.8rem}
.invite .wd-hunt-item.done .wd-hunt-check{background:var(--gold);color:#0e0a06;border-color:var(--gold)}
.invite .wd-hunt-text{flex:1;font-family:var(--font-display),serif;font-size:1.16rem;color:var(--ink)}
.invite .wd-hunt-btn{flex:0 0 auto;width:38px;height:38px;border-radius:50%;border:1px solid rgba(201,168,106,.4);background:rgba(255,255,255,.05);color:var(--gold-2);font-size:1rem;cursor:pointer;transition:background .2s}
.invite .wd-hunt-btn:hover{background:var(--gold);color:#0e0a06}
.invite .wd-hunt-item .wd-gallery{margin-top:12px}

/* Lightbox (rendered as a sibling of .invite, so intentionally unscoped) */
.lb-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(6,4,2,.92);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);animation:lbFade .18s ease}
@keyframes lbFade{from{opacity:0}to{opacity:1}}
.lb-img{max-width:92vw;max-height:88vh;object-fit:contain;border-radius:3px;box-shadow:0 30px 80px -20px rgba(0,0,0,.9)}
.lb-close{position:fixed;top:18px;right:22px;width:42px;height:42px;border:0;border-radius:50%;background:rgba(255,255,255,.1);color:#fff;font-size:1.1rem;cursor:pointer}
.lb-close:hover{background:rgba(255,255,255,.2)}
.lb-nav{position:fixed;top:50%;transform:translateY(-50%);width:48px;height:64px;border:0;background:rgba(255,255,255,.08);color:#fff;font-size:2rem;line-height:1;cursor:pointer;border-radius:6px}
.lb-nav:hover{background:rgba(255,255,255,.18)}
.lb-prev{left:18px}.lb-next{right:18px}
.lb-count{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.8);font:500 13px ui-sans-serif,system-ui,sans-serif;letter-spacing:.05em}
@media(max-width:600px){.lb-nav{width:40px;height:52px;font-size:1.5rem}.lb-prev{left:6px}.lb-next{right:6px}}
`;
