// ============================================================================
//  STYLES — one inlined stylesheet, built from the theme tokens in config.js
//  Mobile-first. Breakpoints: 480 / 600 / 768 / 1024 / 1280 / 1440
// ============================================================================
export function styles(t) {
  return `
*,*::before,*::after{box-sizing:border-box}
:root{
--brand:${t.brand};--brand-dk:${t.brandDark};--accent:${t.accent};
--price:${t.price};--sale:${t.sale};--ink:${t.ink};--muted:${t.muted};
--line:${t.line};--bg:${t.bg};--card:${t.card};--r:${t.radius};
--maxw:1320px;--gut:14px;--hdr:56px;
}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-behavior:smooth}
html,body{margin:0;padding:0;max-width:100%;overflow-x:hidden}
body{font-family:${t.font};background:var(--bg);color:var(--ink);
font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased;
padding-bottom:env(safe-area-inset-bottom)}
img,svg,video{max-width:100%;height:auto;display:block}
a{color:inherit;text-decoration:none}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer;border:0;background:none}
h1,h2,h3,h4{margin:0 0 .4em;line-height:1.22;font-weight:700;letter-spacing:-.01em}
h1{font-size:clamp(22px,5.4vw,36px)}
h2{font-size:clamp(18px,4.2vw,26px)}
h3{font-size:clamp(15px,3.4vw,19px)}
p{margin:0 0 .9em}
ul,ol{margin:0 0 1em;padding-left:1.15em}
:focus-visible{outline:2px solid var(--brand);outline-offset:2px;border-radius:4px}
.sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
clip:rect(0 0 0 0);white-space:nowrap;border:0}
[hidden]{display:none!important}
.wrap{width:100%;max-width:var(--maxw);margin:0 auto;padding:0 var(--gut)}
.ph{background:linear-gradient(110deg,#eef2f1,#f7faf9,#eef2f1);border-radius:10px}

/* ------------------------------- announce ------------------------------- */
.announce{background:var(--brand);color:#fff;font-size:12px;text-align:center;
padding:7px 12px;font-weight:600;letter-spacing:.2px}

/* -------------------------------- header -------------------------------- */
header{position:sticky;top:0;z-index:60;background:var(--card);
border-bottom:1px solid var(--line)}
.nav{display:flex;align-items:center;gap:10px;height:var(--hdr);
max-width:var(--maxw);margin:0 auto;padding:0 var(--gut)}
.burger{width:38px;height:38px;display:grid;place-items:center;border-radius:10px;flex:0 0 auto}
.burger:hover{background:var(--accent)}
.logo{display:flex;align-items:center;gap:8px;font-weight:800;font-size:19px;
letter-spacing:-.4px;flex:0 0 auto;-webkit-user-select:none;user-select:none}
.logo img{height:30px;width:auto}
.logo span{color:var(--brand)}
.navlinks{display:none}
.navacts{margin-left:auto;display:flex;align-items:center;gap:4px;flex:0 0 auto}
.iconbtn{width:40px;height:40px;display:grid;place-items:center;border-radius:11px;position:relative}
.iconbtn:hover{background:var(--accent)}
.badge{position:absolute;top:3px;right:2px;min-width:17px;height:17px;padding:0 4px;
border-radius:9px;background:var(--price);color:#fff;font-size:10px;font-weight:800;
display:grid;place-items:center;line-height:1}
.searchrow{padding:0 var(--gut) 10px;max-width:var(--maxw);margin:0 auto}
.search{display:flex;align-items:center;gap:8px;background:var(--bg);
border:1px solid var(--line);border-radius:999px;padding:0 14px;height:40px}
.search input{flex:1;border:0;background:none;outline:none;font-size:14px;min-width:0}
.search input::placeholder{color:var(--muted)}
.searchbox{position:relative}
.suggest{position:absolute;left:var(--gut);right:var(--gut);top:100%;z-index:70;
background:var(--card);border:1px solid var(--line);border-radius:12px;
box-shadow:0 14px 40px rgba(0,0,0,.12);overflow:hidden;display:none;max-height:60vh;overflow-y:auto}
.suggest.on{display:block}
.suggest a,.suggest button{display:flex;gap:10px;align-items:center;width:100%;
padding:10px 14px;text-align:left;font-size:14px;border-bottom:1px solid var(--line)}
.suggest a:last-child,.suggest button:last-child{border-bottom:0}
.suggest a:hover,.suggest button:hover{background:var(--accent)}
.suggest img{width:34px;height:34px;border-radius:7px;object-fit:cover;flex:0 0 auto}
.suggest .sh{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;
letter-spacing:.6px;padding:9px 14px 4px;border:0}

/* --------------------------------- drawer -------------------------------- */
.scrim{position:fixed;inset:0;background:rgba(12,22,20,.45);z-index:90;opacity:0;
pointer-events:none;transition:opacity .22s}
.scrim.on{opacity:1;pointer-events:auto}
.side{position:fixed;top:0;left:0;bottom:0;width:min(84vw,330px);background:var(--card);
z-index:100;transform:translateX(-100%);transition:transform .26s cubic-bezier(.4,0,.2,1);
display:flex;flex-direction:column;overflow-y:auto}
.side.on{transform:none}
.sidehead{display:flex;align-items:center;justify-content:space-between;
padding:14px 16px;border-bottom:1px solid var(--line)}
.side nav{padding:8px 0}
.side nav a{display:flex;align-items:center;justify-content:space-between;
padding:12px 18px;font-size:15px;font-weight:600;border-bottom:1px solid var(--line)}
.side nav a:hover{background:var(--accent)}
.side .grp{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;
letter-spacing:.7px;padding:16px 18px 6px}
.sidefoot{margin-top:auto;padding:16px 18px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}

/* ---------------------------------- hero --------------------------------- */
.hero{margin:12px 0 0}
.slider{position:relative;overflow:hidden;border-radius:var(--r);background:var(--accent)}
.track{display:flex;transition:transform .55s cubic-bezier(.65,0,.35,1)}
.slide{min-width:100%;position:relative}
.slide img{width:100%;height:auto;display:block}
.dots{position:absolute;left:0;right:0;bottom:8px;display:flex;justify-content:center;gap:6px}
.dots b{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.55);
box-shadow:0 0 0 1px rgba(0,0,0,.08)}
.dots b.on{background:#fff;width:18px;border-radius:4px}
.snav{position:absolute;top:50%;transform:translateY(-50%);width:34px;height:34px;
border-radius:50%;background:rgba(255,255,255,.88);display:none;place-items:center;
box-shadow:0 2px 10px rgba(0,0,0,.15)}
.snav.l{left:10px}.snav.r{right:10px}

.herotext{padding:22px 0 6px;text-align:center}
.herotext p{color:var(--muted);max-width:56ch;margin:0 auto .9em}

/* -------------------------------- trustbar ------------------------------- */
.trust{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:16px 0}
.trust>div{background:var(--card);border:1px solid var(--line);border-radius:12px;
padding:11px 12px;display:flex;gap:9px;align-items:center}
.trust .ti{min-width:0}
.trust b{display:block;font-size:12.5px;line-height:1.25}
.trust small{display:block;color:var(--muted);font-size:11px;line-height:1.3}
.trust svg{flex:0 0 auto;color:var(--brand)}

/* ------------------------------- categories ------------------------------ */
.sect{margin:26px 0}
.secthead{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:12px}
.secthead a{font-size:13px;font-weight:700;color:var(--brand);flex:0 0 auto;
display:inline-flex;align-items:center;gap:3px;white-space:nowrap}
.catrow{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;
scrollbar-width:none;-webkit-overflow-scrolling:touch}
.catrow::-webkit-scrollbar{display:none}
.cat{flex:0 0 auto;width:78px;text-align:center}
.cat img,.cat .ph{width:70px;height:70px;border-radius:50%;object-fit:cover;
margin:0 auto 6px;border:1px solid var(--line);background:var(--card)}
.cat span{display:block;font-size:11.5px;font-weight:600;line-height:1.25}

.cattabs{display:flex;gap:8px;overflow-x:auto;padding:2px 0 6px;scrollbar-width:none}
.cattabs::-webkit-scrollbar{display:none}
.cattabs a{flex:0 0 auto;padding:7px 14px;border-radius:999px;background:var(--card);
border:1px solid var(--line);font-size:13px;font-weight:600;white-space:nowrap}
.cattabs a.on{background:var(--brand);border-color:var(--brand);color:#fff}

/* --------------------------------- grid ---------------------------------- */
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);
overflow:hidden;display:flex;flex-direction:column;position:relative;
transition:box-shadow .18s,transform .18s}
.card:hover{box-shadow:0 8px 26px rgba(16,40,36,.09);transform:translateY(-2px)}
.cardimg{position:relative;background:#fff}
.cardimg img{width:100%;aspect-ratio:1/1;object-fit:cover}
.off{position:absolute;top:8px;left:8px;background:var(--sale);color:#fff;font-size:10.5px;
font-weight:800;padding:3px 7px;border-radius:6px;letter-spacing:.2px}
.oos{position:absolute;inset:0;background:rgba(255,255,255,.72);display:grid;place-items:center;
font-size:12px;font-weight:800;color:var(--ink);text-transform:uppercase;letter-spacing:.6px}
.cardbody{padding:9px 10px 11px;display:flex;flex-direction:column;gap:4px;flex:1}
.cardname{font-size:13px;font-weight:600;line-height:1.32;display:-webkit-box;
-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.64em}
.rate{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted)}
.stars{color:#f5a524;letter-spacing:-1px;font-size:12px}
.pricerow{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin-top:auto}
.price{font-size:16px;font-weight:800;color:var(--price)}
.was{font-size:12px;color:var(--muted);text-decoration:line-through}
.cardbtn{margin-top:7px;width:100%;height:34px;border-radius:9px;background:var(--brand);
color:#fff;font-size:12.5px;font-weight:700;display:grid;place-items:center}
.cardbtn:hover{background:var(--brand-dk)}
.cardbtn[disabled]{background:#cbd5d3;cursor:not-allowed}

/* -------------------------------- buttons -------------------------------- */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
min-height:46px;padding:0 20px;border-radius:12px;font-weight:700;font-size:15px;
background:var(--card);border:1px solid var(--line);width:100%}
.btn:hover{background:var(--accent)}
.btn-primary{background:var(--brand);border-color:var(--brand);color:#fff}
.btn-primary:hover{background:var(--brand-dk)}
.btn-dark{background:var(--ink);border-color:var(--ink);color:#fff}
.btn-dark:hover{opacity:.9}
.btn-wa{background:#25d366;border-color:#25d366;color:#fff}
.btn[disabled]{opacity:.55;cursor:not-allowed}
.btnrow{display:grid;gap:10px;grid-template-columns:1fr}

/* ----------------------------- breadcrumbs ------------------------------- */
.crumbs{font-size:12px;color:var(--muted);padding:12px 0 4px;display:flex;
gap:6px;flex-wrap:wrap;align-items:center}
.crumbs a:hover{color:var(--brand);text-decoration:underline}

/* ------------------------------- product --------------------------------- */
.pdp{display:grid;gap:18px;padding:8px 0 90px}
.gal{background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
.galmain img{width:100%;aspect-ratio:1/1;object-fit:cover}
.thumbs{display:flex;gap:8px;padding:8px;overflow-x:auto;scrollbar-width:none}
.thumbs::-webkit-scrollbar{display:none}
.thumbs button{flex:0 0 auto;width:56px;height:56px;border-radius:9px;overflow:hidden;
border:2px solid transparent;background:#fff}
.thumbs button.on{border-color:var(--brand)}
.thumbs img{width:100%;height:100%;object-fit:cover}
.pinfo h1{margin-bottom:8px}
.pbrand{font-size:12px;font-weight:700;color:var(--brand);text-transform:uppercase;letter-spacing:.7px}
.pprice{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin:10px 0 4px}
.pprice .price{font-size:26px}
.psave{font-size:12px;font-weight:800;color:var(--sale);background:#e7f7ef;
padding:3px 8px;border-radius:6px}
.pshort{color:#3a4a47;margin:8px 0 14px}
.feat{list-style:none;padding:0;margin:0 0 16px;display:grid;gap:7px}
.feat li{display:flex;gap:8px;align-items:flex-start;font-size:14px}
.feat svg{flex:0 0 auto;margin-top:2px;color:var(--brand)}
.packs{display:grid;gap:8px;margin:0 0 16px}
.pack{display:flex;align-items:center;gap:10px;border:1.5px solid var(--line);
border-radius:12px;padding:11px 12px;background:var(--card);text-align:left;width:100%}
.pack.on{border-color:var(--brand);background:var(--accent)}
.pack .dot{width:18px;height:18px;border-radius:50%;border:2px solid var(--line);flex:0 0 auto;position:relative}
.pack.on .dot{border-color:var(--brand)}
.pack.on .dot::after{content:"";position:absolute;inset:3px;border-radius:50%;background:var(--brand)}
.pack b{font-size:14px;display:block}
.pack small{color:var(--muted);font-size:12px}
.pack .pp{margin-left:auto;text-align:right;flex:0 0 auto}
.pack .pp b{color:var(--price);font-size:15px}
.pack .pp s{color:var(--muted);font-size:11.5px}
.pack .tag{background:var(--sale);color:#fff;font-size:10px;font-weight:800;
padding:2px 6px;border-radius:5px;margin-left:6px}
.qty{display:inline-flex;align-items:center;border:1px solid var(--line);
border-radius:11px;overflow:hidden;background:var(--card)}
.qty button{width:40px;height:42px;font-size:19px;font-weight:700;display:grid;place-items:center}
.qty span{min-width:38px;text-align:center;font-weight:700}
.eta{display:flex;gap:8px;align-items:center;font-size:13px;color:#3a4a47;
background:var(--accent);border-radius:10px;padding:10px 12px;margin:14px 0}
.acc{border:1px solid var(--line);border-radius:var(--r);background:var(--card);
overflow:hidden;margin-top:18px}
.acc details{border-bottom:1px solid var(--line)}
.acc details:last-child{border-bottom:0}
.acc summary{padding:13px 15px;font-weight:700;font-size:14px;cursor:pointer;
list-style:none;display:flex;justify-content:space-between;align-items:center;gap:10px}
.acc summary::-webkit-details-marker{display:none}
.acc summary::after{content:"+";font-size:19px;color:var(--brand);font-weight:700}
.acc details[open] summary::after{content:"–"}
.acc .body{padding:0 15px 14px;font-size:14px;color:#3a4a47}
.buybar{position:fixed;left:0;right:0;bottom:0;z-index:70;background:var(--card);
border-top:1px solid var(--line);padding:9px var(--gut) calc(9px + env(safe-area-inset-bottom));
display:flex;gap:9px;align-items:center;box-shadow:0 -4px 18px rgba(0,0,0,.07)}
.buybar .tot{flex:0 0 auto;line-height:1.1}
.buybar .tot small{display:block;font-size:10.5px;color:var(--muted)}
.buybar .tot b{font-size:17px;color:var(--price)}
.buybar .btn{flex:1;min-height:44px}

/* --------------------------------- cart ---------------------------------- */
.line{display:flex;gap:11px;padding:12px 0;border-bottom:1px solid var(--line)}
.line img,.line .ph{width:74px;height:74px;border-radius:10px;object-fit:cover;flex:0 0 auto}
.line .li{flex:1;min-width:0}
.line b{font-size:14px;font-weight:600;display:block;line-height:1.3}
.line small{color:var(--muted);font-size:12px}
.line .rm{color:#b42318;font-size:12px;font-weight:700;margin-top:4px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px}
.totals{display:grid;gap:7px;font-size:14px}
.totals div{display:flex;justify-content:space-between;gap:12px}
.totals .gt{border-top:1px dashed var(--line);padding-top:9px;margin-top:3px;
font-weight:800;font-size:17px}
.totals .gt span:last-child{color:var(--price)}
.empty{text-align:center;padding:48px 16px}
.empty svg{color:var(--muted);margin:0 auto 12px}

/* --------------------------------- forms --------------------------------- */
.field{margin-bottom:12px}
.field label{display:block;font-size:12.5px;font-weight:700;margin-bottom:5px}
.field .req{color:#b42318}
.inp{width:100%;min-height:46px;border:1px solid var(--line);border-radius:11px;
padding:10px 13px;background:var(--card);outline:none;font-size:15px}
.inp:focus{border-color:var(--brand);box-shadow:0 0 0 3px ${hexA(t.brand, .13)}}
textarea.inp{min-height:84px;resize:vertical}
.err{color:#b42318;font-size:12px;margin-top:4px;display:none}
.field.bad .inp{border-color:#b42318}
.field.bad .err{display:block}
.pays{display:grid;gap:9px;margin-bottom:14px}
.pay{display:flex;align-items:center;gap:10px;border:1.5px solid var(--line);
border-radius:12px;padding:12px;background:var(--card);text-align:left;width:100%}
.pay.on{border-color:var(--brand);background:var(--accent)}
.pay .dot{width:18px;height:18px;border-radius:50%;border:2px solid var(--line);flex:0 0 auto;position:relative}
.pay.on .dot{border-color:var(--brand)}
.pay.on .dot::after{content:"";position:absolute;inset:3px;border-radius:50%;background:var(--brand)}
.pay b{font-size:14px;display:block}
.pay small{color:var(--muted);font-size:12px}
.coupon{display:flex;gap:8px;margin-bottom:12px}
.coupon .inp{flex:1}
.coupon button{flex:0 0 auto;padding:0 16px;border-radius:11px;background:var(--ink);color:#fff;font-weight:700}
.note{font-size:12.5px;color:var(--muted)}

/* -------------------------------- status --------------------------------- */
.state{text-align:center;padding:40px 16px 24px}
.state .ic{width:66px;height:66px;border-radius:50%;display:grid;place-items:center;
margin:0 auto 14px;background:var(--accent);color:var(--brand)}
.state.ok .ic{background:#e7f7ef;color:#0a8754}
.state.bad .ic{background:#fdeceb;color:#b42318}
.state.warn .ic{background:#fff7e6;color:#b25e00}
.pill{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;
font-size:12px;font-weight:700;background:var(--accent);color:var(--brand-dk)}
.pill.ok{background:#e7f7ef;color:#0a6b45}
.pill.bad{background:#fdeceb;color:#b42318}
.pill.warn{background:#fff7e6;color:#b25e00}
.steps{display:flex;gap:0;margin:18px 0;overflow-x:auto;scrollbar-width:none}
.steps::-webkit-scrollbar{display:none}
.step{flex:1 0 auto;min-width:92px;text-align:center;font-size:11.5px;color:var(--muted);position:relative;padding-top:24px}
.step::before{content:"";position:absolute;top:6px;left:50%;width:14px;height:14px;
margin-left:-7px;border-radius:50%;background:#dfe6e4;z-index:2}
.step::after{content:"";position:absolute;top:12px;left:0;right:0;height:2px;background:#dfe6e4;z-index:1}
.step:first-child::after{left:50%}
.step:last-child::after{right:50%}
.step.done{color:var(--brand-dk);font-weight:700}
.step.done::before{background:var(--brand)}
.step.done::after{background:var(--brand)}

/* --------------------------------- misc ---------------------------------- */
.pager{display:flex;gap:6px;justify-content:center;align-items:center;margin:24px 0;flex-wrap:wrap}
.pager a,.pager span{min-width:38px;height:38px;padding:0 10px;display:grid;place-items:center;
border-radius:10px;border:1px solid var(--line);background:var(--card);font-size:14px;font-weight:600}
.pager .on{background:var(--brand);border-color:var(--brand);color:#fff}
.filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.filters select{height:38px;border:1px solid var(--line);border-radius:10px;
background:var(--card);padding:0 32px 0 12px;font-size:13.5px;font-weight:600;
appearance:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='3'><path d='M6 9l6 6 6-6'/></svg>");
background-repeat:no-repeat;background-position:right 11px center}
.count{font-size:13px;color:var(--muted);margin-left:auto}
.wa{position:fixed;right:13px;bottom:74px;z-index:65;width:50px;height:50px;border-radius:50%;
background:#25d366;display:grid;place-items:center;box-shadow:0 6px 20px rgba(0,0,0,.22)}
.chatfab{position:fixed;left:13px;bottom:74px;z-index:65;height:50px;padding:0 16px;border-radius:999px;
background:var(--brand);color:#fff;font-weight:700;font-size:13.5px;display:flex;align-items:center;gap:8px;
box-shadow:0 6px 20px rgba(0,0,0,.22)}
.chatbox{position:fixed;left:0;right:0;bottom:0;z-index:130;height:min(560px,88vh);background:var(--card);
border-radius:16px 16px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.25);display:flex;flex-direction:column}
.chatbox[hidden]{display:none}
.chathd{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;
background:var(--brand);color:#fff;border-radius:16px 16px 0 0;font-weight:700}
.chathd button{color:#fff;font-size:22px;line-height:1;padding:0 6px}
.chatlog{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
.chatmsg{max-width:85%;padding:9px 12px;border-radius:14px;font-size:14px;white-space:pre-wrap;word-break:break-word}
.chatmsg.bot{background:var(--accent);align-self:flex-start}
.chatmsg.me{background:var(--brand);color:#fff;align-self:flex-end}
.chatmsg a{text-decoration:underline}
.chatform{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line)}
.chatform input{flex:1;min-width:0;height:42px;border:1px solid var(--line);border-radius:999px;padding:0 14px;font-size:16px;background:var(--bg)}
.chatform button{height:42px;padding:0 16px;border-radius:999px;background:var(--brand);color:#fff;font-weight:700}
.chatnote{font-size:11px;color:var(--muted);text-align:center;padding:0 10px 8px}
@media(min-width:600px){.chatbox{left:auto;right:16px;bottom:16px;width:380px;border-radius:16px}.chathd{border-radius:16px 16px 0 0}}
.toast{position:fixed;left:50%;bottom:86px;transform:translate(-50%,16px);z-index:120;
background:var(--ink);color:#fff;padding:11px 18px;border-radius:999px;font-size:13.5px;
font-weight:600;opacity:0;pointer-events:none;transition:.22s;max-width:90vw;text-align:center}
.toast.on{opacity:1;transform:translate(-50%,0)}
.prose{font-size:15px;color:#33403e}
.prose h2{margin-top:1.3em}
.rich{font-size:14.5px;color:#33403e}
.rich h2,.rich h3{margin-top:1.2em}

/* -------------------------------- footer --------------------------------- */
footer{margin-top:36px;background:var(--card);border-top:1px solid var(--line);
padding:26px 0 18px}
.fgrid{display:grid;gap:22px}
.fcol h4{font-size:13px;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin-bottom:10px}
.fcol a{display:block;padding:5px 0;font-size:14px}
.fcol a:hover{color:var(--brand)}
.fbrand p{font-size:13.5px;color:var(--muted);max-width:40ch}
.social{display:flex;gap:9px;margin-top:12px}
.social a{width:36px;height:36px;border-radius:10px;border:1px solid var(--line);
display:grid;place-items:center;color:var(--muted)}
.social a:hover{color:var(--brand);border-color:var(--brand)}
.fbot{border-top:1px solid var(--line);margin-top:22px;padding-top:14px;
font-size:12.5px;color:var(--muted);display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between}

/* ============================ 480px and up ============================== */
@media(min-width:480px){
:root{--gut:16px}
.grid{gap:12px}
.cardname{font-size:14px}
.trust{grid-template-columns:repeat(4,1fr)}
.btnrow{grid-template-columns:1fr 1fr}
}

/* ============================ 600px and up ============================== */
@media(min-width:600px){
body{font-size:15.5px}
.grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.cat{width:92px}
.cat img,.cat .ph{width:84px;height:84px}
.snav{display:grid}
.fgrid{grid-template-columns:1.4fr 1fr 1fr}
}

/* ============================ 768px and up ============================== */
@media(min-width:768px){
:root{--gut:22px;--hdr:64px}
.pdp{grid-template-columns:1fr 1fr;gap:28px;padding-bottom:24px}
.pdp .gal{position:sticky;top:calc(var(--hdr) + 14px);align-self:start}
.buybar{display:none}
.thumbs button{width:64px;height:64px}
.trust div{padding:13px 14px}
.fgrid{grid-template-columns:1.5fr 1fr 1fr 1fr}
.cartgrid{display:grid;grid-template-columns:1fr 330px;gap:22px;align-items:start}
.cartgrid .panel.sum{position:sticky;top:calc(var(--hdr) + 14px)}
}

/* ============================ 1024px and up ============================= */
@media(min-width:1024px){
:root{--gut:26px}
.burger{display:none}
.navlinks{display:flex;gap:2px;flex:0 0 auto;margin-left:6px}
.navlinks a{padding:9px 13px;border-radius:10px;font-size:14px;font-weight:600;white-space:nowrap}
.navlinks a:hover{background:var(--accent);color:var(--brand-dk)}
.nav{gap:14px}
.searchrow{padding-bottom:12px}
.searchrow .searchbox{max-width:620px}
.search{height:44px}
.grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.checkgrid{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:28px;align-items:start}
.checkgrid .panel.sum{position:sticky;top:calc(var(--hdr) + 16px)}
.herotext{padding:34px 0 10px}
.sect{margin:38px 0}
.cardname{min-height:2.6em}
}

/* ============================ 1280px and up ============================= */
@media(min-width:1280px){
.grid{grid-template-columns:repeat(5,minmax(0,1fr))}
.pdp{grid-template-columns:minmax(0,560px) minmax(0,1fr);gap:40px}
}

/* ============================ 1440px and up ============================= */
@media(min-width:1440px){
:root{--maxw:1400px;--gut:32px}
body{font-size:16px}
}

@media(prefers-reduced-motion:reduce){
*{animation-duration:.001ms!important;transition-duration:.001ms!important}
html{scroll-behavior:auto}
}
@media print{header,footer,.buybar,.wa,.chatfab,.chatbox,.side,.scrim{display:none!important}}
`;
}

/** #rrggbb + alpha → rgba() string, for focus rings. */
function hexA(hex, a) {
  const h = String(hex).replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r||0},${g||0},${b||0},${a})`;
}
