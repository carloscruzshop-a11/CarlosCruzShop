import { db, ref, onValue, push, set, update, remove, runTransaction } from "./firebase-init.js";

/* ============================================================
   STATE
   ============================================================ */
let PRODUCTS = {};      // proizvodi/{id}
let COLLECTIONS = {};   // kolekcije/{id}
let PROMO = [];         // promo texts
let SPECIJALNE_PONUDE = {};
onValue(ref(db, "specijalnePonude"), snap => { SPECIJALNE_PONUDE = snap.val() || {}; startPromoRotation(); });
let HERO_SLIKE = [];    // admin-picked hero marquee images
let KODOVI = {};        // popust kodovi/{id}
let cart = [];
let currentImgIndex = {};   // per product id -> index for auto-cycle
let cardTimers = {};

const FALLBACK_IMG = "assets/icons/logo-square-512.png";

const ICON_INSTAGRAM_WHITE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1"/></svg>`;
const ICON_TIKTOK_WHITE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M16.5 3c.3 1.9 1.6 3.4 3.5 3.7v2.9c-1.3 0-2.5-.4-3.5-1.1v6.6c0 3.3-2.7 6-6 6s-6-2.7-6-6 2.7-6 6-6c.3 0 .6 0 .9.1v3.1c-.3-.1-.6-.2-.9-.2-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3V3h3z"/></svg>`;
const ICON_INSTAGRAM_DARK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1"/></svg>`;
const ICON_TIKTOK_DARK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#111"><path d="M16.5 3c.3 1.9 1.6 3.4 3.5 3.7v2.9c-1.3 0-2.5-.4-3.5-1.1v6.6c0 3.3-2.7 6-6 6s-6-2.7-6-6 2.7-6 6-6c.3 0 .6 0 .9.1v3.1c-.3-.1-.6-.2-.9-.2-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3V3h3z"/></svg>`;

const ICON_TRUCK = `<svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.4"><rect x="1" y="6" width="13" height="10"/><path d="M14 9h4l3 3v4h-7z"/><circle cx="6" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg>`;
const ICON_CASH = `<svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.4"><rect x="2" y="6" width="20" height="12" rx="1.5"/><circle cx="12" cy="12" r="3"/><path d="M6 6v12M18 6v12" stroke-opacity=".5"/></svg>`;
const ICON_PRINTER = `<svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.4"><path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1"/><path d="M6 14h12v7H6z"/></svg>`;
const ICON_DIAMOND = `<svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.4"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l-3 6 6 12 6-12-3-6"/></svg>`;
const ICON_SPARKLE = `<svg viewBox="0 0 24 24" fill="#111"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/></svg>`;
const ICON_ZOOM = `<svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;
const ICON_SHARE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.6" x2="15.4" y2="6.4"/><line x1="8.6" y1="13.4" x2="15.4" y2="17.6"/></svg>`;
const ICON_LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.5"><rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></svg>`;

/* ============================================================
   FIREBASE LISTENERS
   ============================================================ */
onValue(ref(db, "proizvodi"), snap => {
  PRODUCTS = snap.val() || {};
  router();
});

onValue(ref(db, "kolekcije"), snap => {
  COLLECTIONS = snap.val() || {};
  renderSideDrawerCollections();
  router();
});

onValue(ref(db, "promo"), snap => {
  const data = snap.val() || {};
  PROMO = Object.values(data).map(p => (typeof p === "string" ? p : p.tekst)).filter(Boolean);
  startPromoRotation();
});

onValue(ref(db, "heroSlike"), snap => {
  const data = snap.val();
  HERO_SLIKE = Array.isArray(data) ? data.filter(Boolean) : Object.keys(data || {});
  buildHeroMarquee();
});

let TICKER_TEXT = "PROMO TRAKA";
onValue(ref(db, "tickerTekst"), snap => {
  TICKER_TEXT = snap.val() || "PROMO TRAKA";
  buildTicker();
});
onValue(ref(db, "kodovi"), snap => { KODOVI = snap.val() || {}; });

let ONAMA_GORE = [];
let ONAMA_DOLE = [];
onValue(ref(db, "onamaSlikeGore"), snap => { const d = snap.val(); ONAMA_GORE = Array.isArray(d) ? d.filter(Boolean) : Object.values(d || {}); if (location.hash.startsWith("#/o-nama")) renderAboutPage(); });
onValue(ref(db, "onamaSlikeDole"), snap => { const d = snap.val(); ONAMA_DOLE = Array.isArray(d) ? d.filter(Boolean) : Object.values(d || {}); if (location.hash.startsWith("#/o-nama")) renderAboutPage(); });

let knownOrderIds = null;

/* ============================================================
   HELPERS
   ============================================================ */
function money(n) { return Math.round(n).toLocaleString("sr-RS") + " RSD"; }

/* ============================================================
   EMAILJS — potvrda porudžbine (kupac + vlasnik)
   ============================================================ */
const EMAILJS_PUBLIC_KEY = "Hx_e2DUctFUwfBFjl";
const EMAILJS_SERVICE_ID = "service_b5ptq8o";
const EMAILJS_TEMPLATE_KUPAC = "template_7lv6lfo";
const EMAILJS_TEMPLATE_VLASNIK = "template_xrts9yc";
if (window.emailjs) window.emailjs.init(EMAILJS_PUBLIC_KEY);

function formatStavke(cart) {
  return cart.map(i =>
    `${i.naziv} × ${i.kolicina} — ${(i.boja || "").toUpperCase()}, ${(i.pol || "").toUpperCase()}, ${(i.velicina || "").toUpperCase()} — ${money(i.cena * i.kolicina)}`
  ).join("\n");
}

function buildEmailParams(order) {
  const popust_red = order.popustKod
    ? `<tr><td style="padding: 4px 0; color: #1a7a3c;">Popust (${order.popustKod})</td><td style="padding: 4px 0; text-align: right; color: #1a7a3c; white-space: nowrap;">−${money(order.popustIznos)}</td></tr>`
    : "";
  return {
    order_id: order.sifra,
    ime: order.ime || "",
    adresa: order.adresa || "",
    grad: order.grad || "",
    postanski: order.postanski || "",
    telefon: order.telefon || "",
    email: order.email || "",
    stavke: formatStavke(order.stavke || []),
    vrednost_korpe: money(order.proizvodi || 0),
    cena_dostave: order.dostava === 0 ? "BESPLATNO" : money(order.dostava || 0),
    konacna_cena: money(order.ukupno || 0),
    popust_red,
    napomena: order.napomena || "—"
  };
}

function sendOrderEmails(order) {
  if (!window.emailjs) return;
  const params = buildEmailParams(order);
  window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_KUPAC, params).catch(err => console.error("EmailJS (kupac) greška:", err));
  window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_VLASNIK, params).catch(err => console.error("EmailJS (vlasnik) greška:", err));
}
function effectivePrice(p) {
  const base = p.cena || 0;
  if (p.akcija) return Math.round(base * (1 - p.akcija / 100));
  return base;
}
function imgOf(p, i = 0) {
  const arr = Array.isArray(p.slike) ? p.slike : (p.slikaUrl ? [p.slikaUrl] : []);
  return arr[i] || arr[0] || FALLBACK_IMG;
}
function imagesOf(p) {
  const arr = Array.isArray(p.slike) ? p.slike : (p.slikaUrl ? [p.slikaUrl] : []);
  return arr.length ? arr : [FALLBACK_IMG];
}
function cardImagesOf(p) {
  const all = imagesOf(p);
  if (Array.isArray(p.karticaSlike) && p.karticaSlike.length) {
    const filtered = all.filter(u => p.karticaSlike.includes(u));
    return filtered.length ? filtered : all;
  }
  return all;
}
function imageForColor(p, boja) {
  if (!boja || !Array.isArray(p.slikeBoje) || !Array.isArray(p.slike)) return null;
  let lastMatch = null;
  p.slike.forEach((url, i) => { if (p.slikeBoje[i] === boja) lastMatch = url; });
  return lastMatch; // last match ≈ "back" photo if uploaded front-then-back
}
function seededRating(id) {
  const seed = String(id).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (4.6 + (seed % 4) / 10).toFixed(1);
}
function ratingOf(p, id) {
  if (p.ocena) return Math.max(4.6, Number(p.ocena)).toFixed(1);
  const r = p.rating || {};
  if (!r.brojGlasova) return seededRating(id);
  return Math.max(4.6, r.suma / r.brojGlasova).toFixed(1);
}
function slugify(s) { return String(s).toLowerCase().trim().replace(/[^a-z0-9čćžšđ\s-]/gi, "").replace(/\s+/g, "-"); }
function toUrlSlug(s) {
  const map = { č: "c", ć: "c", ž: "z", š: "s", đ: "dj", Č: "c", Ć: "c", Ž: "z", Š: "s", Đ: "dj" };
  return String(s).split("").map(ch => map[ch] || ch).join("")
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function showToast(msg, type = "success") {
  // Toast popups removed per request — kept as no-op so existing calls don't break.
}
window.showToast = showToast;

/* ============================================================
   PROMO TOP BAR ROTATION
   ============================================================ */
let promoIdx = 0, promoInterval;
function activePromoMessages() {
  const extra = [];
  if (SPECIJALNE_PONUDE.korpaPreko5000) extra.push("Korpa preko 5000 RSD — besplatna poštarina");
  if (SPECIJALNE_PONUDE.kupi3Modela) extra.push("Kupi 3 bilo koja modela — besplatna poštarina");
  return [...extra, ...PROMO];
}
function startPromoRotation() {
  const el = document.getElementById("promoTopText");
  if (!el) return;
  const messages = activePromoMessages();
  if (!messages.length) { el.textContent = "Dobrodošli u Carlos Cruz"; return; }
  promoIdx = 0;
  updatePromoText();
  if (promoInterval) clearInterval(promoInterval);
  promoInterval = setInterval(() => {
    promoIdx = (promoIdx + 1) % activePromoMessages().length;
    updatePromoText();
  }, 3800);
}
function updatePromoText() {
  const el = document.getElementById("promoTopText");
  const messages = activePromoMessages();
  if (!el || !messages.length) return;
  el.style.transition = "opacity .4s, transform .4s";
  el.style.opacity = 0; el.style.transform = "translateY(4px)";
  setTimeout(() => {
    el.textContent = messages[promoIdx];
    el.style.opacity = 1; el.style.transform = "translateY(0)";
  }, 400);
}

/* ============================================================
   ROUTER (hash based: #/ #/kolekcija/NAME #/model/ID #/svi-modeli)
   ============================================================ */
window.addEventListener("hashchange", router);
function goTo(hash) { location.hash = hash; window.scrollTo(0, 0); }
window.goTo = goTo;

function router() {
  const h = location.hash || "#/";
  const view = document.getElementById("view");
  if (!view) return;
  closeDrawer(); closeCart();
  if (h.startsWith("#/model/")) {
    renderProductDetail(decodeURIComponent(h.replace("#/model/", "")));
  } else if (h.startsWith("#/proizvod/")) {
    renderProductDetail(decodeURIComponent(h.replace("#/proizvod/", ""))); // legacy link support
  } else if (h.startsWith("#/checkout")) {
    renderCheckoutPage();
  } else if (h.startsWith("#/kolekcija/")) {
    renderCollectionPage(decodeURIComponent(h.replace("#/kolekcija/", "")));
  } else if (h.startsWith("#/svi-modeli")) {
    renderAllProductsPage();
  } else if (h.startsWith("#/svi-proizvodi")) {
    renderAllProductsPage(); // legacy link support
  } else if (h.startsWith("#/pretraga/")) {
    renderSearchPage(decodeURIComponent(h.replace("#/pretraga/", "")));
  } else if (h.startsWith("#/faq")) {
    renderFAQPage();
  } else if (h.startsWith("#/kontakt")) {
    renderContactPage();
  } else if (h.startsWith("#/o-nama")) {
    renderAboutPage();
  } else if (h.startsWith("#/info/")) {
    renderInfoPage(h.replace("#/info/", ""));
  } else {
    renderHome();
  }
  window.scrollTo(0, 0);
}

/* ============================================================
   HOME VIEW
   ============================================================ */
function renderHome() {
  const view = document.getElementById("view");
  view.innerHTML = `
    <section class="hero-marquee"><div class="hero-track" id="heroTrack"></div></section>
    <div class="ticker-strip"><div class="ticker-track" id="tickerTrack"></div></div>

    <section class="section">
      <div class="section-head left-align"><h2>Najprodavaniji modeli</h2><div class="eyebrow-link" onclick="goTo('#/svi-modeli')">Pogledaj sve modele →</div></div>
      <div class="grid-4 bestseller-grid" id="bestsellerGrid"></div>
    </section>

    <div id="collectionsHome"></div>

    <section class="trust-section section">
      <div class="section-head"><h2>Vaše poverenje, naš standard.</h2></div>
      <div class="trust-grid">
        <div class="trust-item"><div class="emoji">${ICON_TRUCK}</div><h4>Brza isporuka</h4><p>Isporuka širom Srbije za 5–7 dana.</p></div>
        <div class="trust-item"><div class="emoji">${ICON_CASH}</div><h4>Plaćanje pouzećem</h4><p>Platite kuriru pri preuzimanju, bez brige.</p></div>
        <div class="trust-item"><div class="emoji">${ICON_DIAMOND}</div><h4>Ekskluzivnost</h4><p>Ograničene kolekcije.</p></div>
        <div class="trust-item"><div class="emoji">${ICON_SPARKLE}</div><h4>Premium brend</h4><p>Pažljivo biran materijal i dizajn.</p></div>
      </div>
    </section>

    <section class="cta-band">
      <div class="cta-content">
        <h2>Otkrijte sve Carlos Cruz modele.</h2>
        <button onclick="goTo('#/svi-modeli')">SVI MODELI</button>
      </div>
    </section>

    <section class="section" style="max-width:760px;">
      <div class="section-head"><h2>Česta pitanja</h2><div class="eyebrow-link" onclick="goTo('#/faq')">Sva pitanja →</div></div>
      <div id="faqHome"></div>
    </section>
  `;
  buildHeroMarquee();
  buildTicker();
  renderBestsellers();
  renderCollectionsHome();
  renderFAQ(document.getElementById("faqHome"));
}

function renderFAQPage() {
  const view = document.getElementById("view");
  view.innerHTML = `
    <div class="breadcrumbs"><a href="#/" onclick="goTo('#/')">Početna</a> / <span>Česta pitanja</span></div>
    <section class="section" style="max-width:760px;">
      <div class="section-head"><h2>Česta pitanja</h2></div>
      <div id="faqFull"></div>
    </section>
  `;
  renderFAQ(document.getElementById("faqFull"), true);
}

const INFO_PAGES = {
  privatnost: {
    title: "Politika privatnosti",
    body: `
      <p>Ova Politika privatnosti objašnjava koje podatke prikupljamo, na koji način ih koristimo i kako obezbeđujemo njihovu zaštitu prilikom kupovine na našem sajtu. Vaša privatnost nam je prioritet.</p>
      <h4>1. Podaci koje prikupljamo</h4>
      <p>Prilikom kreiranja porudžbine, od vas prikupljamo isključivo podatke koji su neophodni za uspešnu realizaciju kupovine:</p>
      <ul>
        <li>Ime i prezime – za identifikaciju primaoca.</li>
        <li>Adresa za dostavu – kako bi pošiljka stigla na tačnu lokaciju.</li>
        <li>Broj telefona – radi kontaktiranja od strane kurirske službe pre isporuke.</li>
        <li>Email adresa – za slanje potvrde o porudžbini i obaveštenja o statusu pošiljke.</li>
      </ul>
      <h4>2. Kako koristimo vaše podatke</h4>
      <p>Vaše podatke koristimo isključivo u svrhu obrade, pripreme i isporuke porudžbine, kao i za pružanje neophodne korisničke podrške u vezi sa vašom kupovinom.</p>
      <h4>3. Deljenje podataka sa trećim licima</h4>
      <p>Vaši lični podaci su strogo poverljivi. Ne prodajemo ih, ne iznajmljujemo i ne prosleđujemo trećim licima, osim kurirskoj službi koja je zadužena za dostavu vašeg paketa. Kurirskoj službi se prosleđuju samo podaci neophodni za transport i uručenje (ime, adresa i telefon).</p>
      <h4>4. Rok čuvanja podataka</h4>
      <p>Podaci se čuvaju onoliko dugo koliko je potrebno za potpunu realizaciju, isporuku i kompletno kompletiranje vaše porudžbine.</p>
    `
  },
  uslovi: {
    title: "Uslovi korišćenja",
    body: `
      <p>Korišćenjem Carlos Cruz sajta prihvatate uslove kupovine koji su navedeni ovde.</p>
      <ul>
        <li>Cene artikala – Sve cene na sajtu su izražene u dinarima (RSD). Zadržavamo pravo izmene cena bez prethodne najave.</li>
        <li>Izrada po porudžbini – Sve majice se izrađuju isključivo po vašoj porudžbini. Modeli su dostupni u crnoj i beloj boji, a zadržavamo pravo izmene dostupnosti samih veličina u zavisnosti od trenutne nabavke tekstila.</li>
      </ul>
    `
  },
  isporuka: {
    title: "Isporuka i dostava",
    body: `
      <p>Sve majice se izrađuju po vašoj porudžbini, nakon čega se šalju na vašu adresu.</p>
      <p><strong>Rok izrade i isporuke</strong> – Pošto se svaka majica pravi namenski za vas, kompletan rok za izradu i dostavu paketa na vašu adresu iznosi od 5 do 7 radnih dana od momenta kada napravite porudžbinu na sajtu.</p>
      <p><strong>Način dostave</strong> – Isporuka se vrši putem kurirske službe na teritoriji cele Srbije.</p>
      <p><strong>Cena dostave</strong> – Cena poštarine zavisi od same kurirske službe, a okvirni trošak iznosi oko 600 RSD.</p>
      <p><strong>Način plaćanja</strong> – Sve porudžbine se plaćaju pouzećem, odnosno gotovinom kuriru prilikom preuzimanja paketa.</p>
    `
  }
};
function renderInfoPage(slug) {
  const view = document.getElementById("view");
  const page = INFO_PAGES[slug];
  if (!page) { renderProductDetail("__nepostojece__"); return; }
  view.innerHTML = `
    <div class="breadcrumbs"><a href="#/" onclick="goTo('#/')">Početna</a> / <span>${page.title}</span></div>
    <section class="section info-page-content" style="max-width:720px;">
      <div class="section-head left-align"><h2>${page.title}</h2></div>
      ${page.body}
    </section>
  `;
}

function renderAboutPage() {
  aboutTimers.forEach(t => clearInterval(t));
  aboutTimers = [];
  const view = document.getElementById("view");
  const textGore = [
    "Carlos Cruz je priča o detaljima koji prave razliku.",
    "Svaki model nastaje iz želje da spojimo minimalizam i karakter.",
    "Ne pratimo trendove — gradimo prepoznatljiv stil koji traje.",
    "Svaka kolekcija je pažljivo osmišljena, u ograničenom broju komada.",
    "Ovo nije samo majica, ovo je stav."
  ];
  const textDole = [
    "Verujemo u premium pamuk i pažljivu izradu, bez kompromisa.",
    "Svaki komad se štampa posebno, tek nakon porudžbine.",
    "Ograničene kolekcije znače da nosite nešto retko, ne masovno.",
    "Kvalitet materijala biramo pažljivije nego što diktira brzina mode.",
    "Obucite Carlos Cruz i nosite priču, ne samo majicu."
  ];
  const imgsGore = ONAMA_GORE.length ? ONAMA_GORE : [FALLBACK_IMG];
  const imgsDole = ONAMA_DOLE.length ? ONAMA_DOLE : [FALLBACK_IMG];
  view.innerHTML = `
    <div class="breadcrumbs"><a href="#/" onclick="goTo('#/')">Početna</a> / <span>O nama</span></div>
    <section class="section about-section">
      <div class="section-head"><h2 class="about-title">O nama</h2></div>

      <div class="about-row">
        <div class="about-text">${textGore.map(t => `<p>${t}</p>`).join("")}</div>
        <div class="about-img-frame" id="aboutImgGore"><img src="${imgsGore[0]}" alt="" class="active"></div>
      </div>

      <div class="about-row reverse">
        <div class="about-img-frame" id="aboutImgDole"><img src="${imgsDole[0]}" alt="" class="active"></div>
        <div class="about-text">${textDole.map(t => `<p>${t}</p>`).join("")}</div>
      </div>
    </section>
  `;
  startAboutCarousel("aboutImgGore", imgsGore);
  startAboutCarousel("aboutImgDole", imgsDole);
}

let aboutTimers = [];
function startAboutCarousel(frameId, imgs) {
  const frame = document.getElementById(frameId);
  if (!frame || imgs.length <= 1) return;
  frame.innerHTML = imgs.map((src, i) => `<img src="${src}" alt="" class="${i === 0 ? "active" : ""}">`).join("");
  let idx = 0;
  const timer = setInterval(() => {
    idx = (idx + 1) % imgs.length;
    frame.querySelectorAll("img").forEach((img, i) => img.classList.toggle("active", i === idx));
  }, 3500);
  aboutTimers.push(timer);
}

function renderContactPage() {
  const view = document.getElementById("view");
  view.innerHTML = `
    <div class="breadcrumbs"><a href="#/" onclick="goTo('#/')">Početna</a> / <span>Kontakt</span></div>
    <section class="section" style="max-width:560px;">
      <div class="section-head"><h2>Kontakt</h2><div style="font-size:13px;color:var(--ink-soft);">Imate pitanje? Pošaljite nam poruku, javljamo se u najkraćem roku.</div></div>
      <div class="form-row"><label>Ime i prezime</label><input id="ct_ime"></div>
      <div class="form-row"><label>Email</label><input id="ct_email"></div>
      <div class="form-row"><label>Poruka</label><textarea id="ct_poruka" rows="5"></textarea></div>
      <button class="btn-dark" id="ct_submit" style="margin-top:6px;">Pošalji poruku</button>
      <div style="margin-top:34px; text-align:center;">
        <div class="opt-label" style="margin-bottom:14px;">ILI NAS PRATITE</div>
        <div style="display:flex; gap:20px; justify-content:center;">
          <a href="https://instagram.com/carloscruz" target="_blank" rel="noopener" class="icon-btn" style="gap:8px;">${ICON_INSTAGRAM_DARK} Instagram</a>
          <a href="https://tiktok.com/@carloscruz" target="_blank" rel="noopener" class="icon-btn" style="gap:8px;">${ICON_TIKTOK_DARK} TikTok</a>
        </div>
      </div>
    </section>
  `;
  document.getElementById("ct_submit").addEventListener("click", () => {
    clearFieldErrors(document.querySelector(".section"));
    const ime = val("ct_ime"), email = val("ct_email"), poruka = val("ct_poruka");
    let ok = true;
    if (!ime) { showFieldError("ct_ime"); ok = false; }
    if (!poruka) { showFieldError("ct_poruka"); ok = false; }
    if (!ok) return;
    push(ref(db, "poruke"), { ime, email, poruka, datum: Date.now() }).then(() => {
      document.querySelector(".section").innerHTML = `<div class="section-head"><h2>Hvala na poruci!</h2><p style="color:var(--ink-soft);font-size:13.5px;">Javićemo vam se uskoro.</p></div>`;
    });
  });
}
function clearFieldErrors(scope) {
  (scope || document).querySelectorAll(".field-error").forEach(e => e.remove());
  (scope || document).querySelectorAll(".err").forEach(e => e.classList.remove("err"));
}
function showFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field || field.nextElementSibling?.classList.contains("field-error")) return;
  field.classList.add("err");
  const p = document.createElement("p");
  p.className = "field-error";
  p.textContent = "* Obavezno polje";
  field.insertAdjacentElement("afterend", p);
}

function buildHeroMarquee() {
  const tracks = [document.getElementById("heroTrack"), document.getElementById("heroTrackBottom")].filter(Boolean);
  if (!tracks.length) return;
  let entries; // array of {img, id, naziv}
  if (HERO_SLIKE.length) {
    entries = HERO_SLIKE.map(id => PRODUCTS[id] ? { img: PRODUCTS[id].dizajnSlika || imgOf(PRODUCTS[id]), id, naziv: PRODUCTS[id].naziv } : null).filter(Boolean);
  } else {
    entries = [];
  }
  if (!entries.length) {
    const listWithIds = Object.entries(PRODUCTS);
    entries = listWithIds.length
      ? listWithIds.map(([id, p]) => ({ img: p.dizajnSlika || imgOf(p), id, naziv: p.naziv }))
      : [{ img: FALLBACK_IMG, id: null }, { img: FALLBACK_IMG, id: null }, { img: FALLBACK_IMG, id: null }];
  }
  const doubled = entries.concat(entries);
  const html = doubled.map(e =>
    `<img src="${e.img}" loading="lazy" alt="" ${e.id ? `style="cursor:pointer;" onclick="goTo('#/model/${toUrlSlug(e.naziv)}')"` : ""}>`
  ).join("");
  tracks.forEach(t => t.innerHTML = html);
}
function buildTicker() {
  const track = document.getElementById("tickerTrack");
  if (!track) return;
  const items = new Array(10).fill(TICKER_TEXT);
  track.innerHTML = items.map(t => `<span>${t}</span>`).join("");
}

let BESTSELLER_ORDER = [];
onValue(ref(db, "bestselerRedosled"), snap => {
  BESTSELLER_ORDER = snap.val() || [];
  renderBestsellers();
});

function renderBestsellers() {
  const grid = document.getElementById("bestsellerGrid");
  if (!grid) return;
  const all = Object.entries(PRODUCTS);
  let list = all.filter(([id, p]) => p.bestseler);
  if (list.length && BESTSELLER_ORDER.length) {
    const map = Object.fromEntries(list);
    const ordered = BESTSELLER_ORDER.filter(id => map[id]).map(id => [id, map[id]]);
    const missing = list.filter(([id]) => !BESTSELLER_ORDER.includes(id));
    list = [...ordered, ...missing];
  }
  if (!list.length) list = all.slice(0, 8);
  grid.innerHTML = "";
  list.slice(0, 8).forEach(([id, p]) => grid.appendChild(productCard(id, p)));
}

function renderCollectionsHome() {
  const host = document.getElementById("collectionsHome");
  if (!host) return;
  host.innerHTML = "";
  const cols = Object.entries(COLLECTIONS);
  cols.forEach(([cid, c]) => {
    const naziv = c.naziv || c;
    const products = Object.entries(PRODUCTS).filter(([id, p]) => p.kolekcija === naziv).slice(0, 4);
    if (!products.length) return;
    const sec = document.createElement("section");
    sec.className = "section";
    sec.innerHTML = `
      <div class="collection-heading-row">
        <h2 style="cursor:pointer;">${naziv}</h2>
        <div class="view-all">Pogledaj kolekciju →</div>
      </div>
      <div class="grid-4" id="col-${slugify(naziv)}"></div>
    `;
    sec.querySelector("h2").addEventListener("click", () => goTo(`#/kolekcija/${toUrlSlug(naziv)}`));
    sec.querySelector(".view-all").addEventListener("click", () => goTo(`#/kolekcija/${toUrlSlug(naziv)}`));
    host.appendChild(sec);
    const grid = sec.querySelector(`#col-${slugify(naziv)}`);
    products.forEach(([id, p]) => grid.appendChild(productCard(id, p)));
  });
}

/* ============================================================
   PRODUCT CARD (auto-cycle images, hover swap)
   ============================================================ */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function productCard(id, p) {
  const div = document.createElement("div");
  div.className = "pcard";
  const imgs = cardImagesOf(p);
  const order = shuffleArray(imgs.map((_, i) => i));
  let posIdx = 0;
  currentImgIndex[id] = order[0];
  const badges = [];
  if (p.novo) badges.push('<span class="badge badge-novo">NOVO</span>');
  if (p.popularno) badges.push('<span class="badge badge-popularno">POPULARNO</span>');
  if (p.akcija) badges.push(`<span class="badge badge-akcija">AKCIJA ${p.akcija}%</span>`);
  const priceHTML = p.akcija
    ? `<span class="pprice-old">${money(p.cena || 0)}</span> <span class="pprice-new">${money(effectivePrice(p))}</span>`
    : money(p.cena || 0);
  div.innerHTML = `
    <div class="pframe" data-id="${id}">
      ${imgs.map((src, i) => `<img src="${src}" loading="lazy" class="${i === order[0] ? "active" : ""}" data-i="${i}" alt="${p.naziv || ""}">`).join("")}
      ${badges.length ? `<div class="badge-stack">${badges.join("")}</div>` : ""}
    </div>
    <div class="pmeta">
      <div class="pname">${p.naziv || ""}</div>
      <div class="pprice">${priceHTML}</div>
    </div>
  `;
  let justSwiped = false;
  div.addEventListener("click", () => { if (!justSwiped) goTo(`#/model/${toUrlSlug(p.naziv)}`); });
  const frame = div.querySelector(".pframe");
  if (imgs.length > 1) {
    if (cardTimers[id + "_start"]) clearTimeout(cardTimers[id + "_start"]);
    if (cardTimers[id]) clearInterval(cardTimers[id]);
    const randomDelay = Math.floor(Math.random() * 4000);
    let timer;
    const startTimer = setTimeout(() => {
      timer = setInterval(() => {
        posIdx = (posIdx + 1) % order.length;
        swapCardImage(frame, order[posIdx]);
      }, 7000);
      cardTimers[id] = timer;
    }, randomDelay);
    cardTimers[id + "_start"] = startTimer;
    frame.addEventListener("mouseenter", () => swapCardImage(frame, order[(posIdx + 1) % order.length]));
    frame.addEventListener("mouseleave", () => swapCardImage(frame, order[posIdx]));

    // touch swipe to change image on mobile
    let touchStartX = null;
    frame.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; justSwiped = false; }, { passive: true });
    frame.addEventListener("touchend", e => {
      if (touchStartX === null) return;
      const diff = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(diff) > 30) {
        justSwiped = true;
        posIdx = ((posIdx + (diff < 0 ? 1 : -1)) % order.length + order.length) % order.length;
        swapCardImage(frame, order[posIdx]);
        setTimeout(() => { justSwiped = false; }, 300);
      }
      touchStartX = null;
    });
  }
  return div;
}
function swapCardImage(frame, i) {
  frame.querySelectorAll("img").forEach(img => img.classList.toggle("active", Number(img.dataset.i) === i));
}

/* ============================================================
   COLLECTION PAGE
   ============================================================ */
function renderCollectionPage(slugOrNaziv) {
  const view = document.getElementById("view");
  let naziv = slugOrNaziv;
  let colEntry = Object.values(COLLECTIONS).find(c => (c.naziv || c) === naziv);
  if (!colEntry) {
    colEntry = Object.values(COLLECTIONS).find(c => toUrlSlug(c.naziv || c) === slugOrNaziv);
    if (colEntry) naziv = colEntry.naziv || colEntry;
  }
  const products = Object.entries(PRODUCTS).filter(([id, p]) => p.kolekcija === naziv);
  const opis = colEntry && colEntry.opis ? colEntry.opis : "";
  view.innerHTML = `
    <div class="breadcrumbs"><a href="#/" onclick="goTo('#/')">Početna</a> / <a href="#/svi-modeli">Kolekcije</a> / <span>${naziv}</span></div>
    <section class="section">
      <div class="section-head"><h2 class="collection-page-title">${naziv}</h2>${opis ? `<p style="font-size:15px;color:var(--ink-soft);max-width:560px;margin:12px auto 0;">${opis}</p>` : ""}
        <button class="share-badge collection-share-btn" id="shareCollectionBtn" style="margin:14px auto 0;">${ICON_SHARE} Podeli kolekciju</button>
      </div>
      <div class="grid-3" id="collectionGrid"></div>
    </section>
  `;
  const grid = document.getElementById("collectionGrid");
  document.getElementById("shareCollectionBtn")?.addEventListener("click", () => shareCollection(naziv, opis, colEntry));
  if (!products.length) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--grey);">Trenutno nema modela u ovoj kolekciji.</p>`;
    return;
  }
  products.forEach(([id, p]) => grid.appendChild(productCard(id, p)));
}

/* ============================================================
   ALL PRODUCTS PAGE (filters + pagination)
   ============================================================ */
let apState = { kolekcija: "sve", sort: "najnovije", page: 1 };
const PER_PAGE = 8;

function renderAllProductsPage() {
  const view = document.getElementById("view");
  const cols = Object.values(COLLECTIONS).map(c => c.naziv || c);
  view.innerHTML = `
    <div class="breadcrumbs"><a href="#/" onclick="goTo('#/')">Početna</a> / <span>Svi modeli</span></div>
    <section class="section">
      <div class="section-head left-align"><h2>Svi modeli</h2></div>
      <div class="filters-row left-align">
        <select id="filterKolekcija">
          <option value="sve">Sve kolekcije</option>
          ${cols.map(c => `<option value="${c}">${c}</option>`).join("")}
        </select>
        <select id="filterSort">
          <option value="najnovije">Najnovije</option>
          <option value="az">Naziv A–Z</option>
          <option value="za">Naziv Z–A</option>
        </select>
      </div>
      <div class="grid-4" id="allProductsGrid"></div>
      <div class="pagination" id="allProductsPagination"></div>
    </section>
  `;
  document.getElementById("filterKolekcija").value = apState.kolekcija;
  document.getElementById("filterSort").value = apState.sort;
  document.getElementById("filterKolekcija").addEventListener("change", e => { apState.kolekcija = e.target.value; apState.page = 1; drawAllProducts(); });
  document.getElementById("filterSort").addEventListener("change", e => { apState.sort = e.target.value; apState.page = 1; drawAllProducts(); });
  drawAllProducts();
}

function drawAllProducts() {
  const grid = document.getElementById("allProductsGrid");
  const pag = document.getElementById("allProductsPagination");
  if (!grid) return;
  let list = Object.entries(PRODUCTS);
  if (apState.kolekcija !== "sve") list = list.filter(([id, p]) => p.kolekcija === apState.kolekcija);
  if (apState.sort === "az") list.sort((a, b) => (a[1].naziv || "").localeCompare(b[1].naziv || ""));
  else if (apState.sort === "za") list.sort((a, b) => (b[1].naziv || "").localeCompare(a[1].naziv || ""));
  else list.sort((a, b) => (b[1].datumDodavanja || 0) - (a[1].datumDodavanja || 0));

  const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  if (apState.page > totalPages) apState.page = totalPages;
  const start = (apState.page - 1) * PER_PAGE;
  const pageItems = list.slice(start, start + PER_PAGE);

  grid.innerHTML = "";
  if (!pageItems.length) grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--grey);">Nema modela.</p>`;
  pageItems.forEach(([id, p]) => grid.appendChild(productCard(id, p)));

  pag.innerHTML = "";
  if (totalPages > 1) {
    for (let i = 1; i <= totalPages; i++) {
      const b = document.createElement("button");
      b.textContent = i;
      if (i === apState.page) b.classList.add("active");
      b.addEventListener("click", () => { apState.page = i; drawAllProducts(); window.scrollTo({ top: 300, behavior: "smooth" }); });
      pag.appendChild(b);
    }
  }
}

/* ============================================================
   PRODUCT DETAIL
   ============================================================ */
let detailState = { id: null, imgIndex: 0, boja: null, pol: null, velicina: null, kolicina: 1 };

function renderProductDetail(slugOrId) {
  const view = document.getElementById("view");
  let id = slugOrId;
  let p = PRODUCTS[id];
  if (!p) {
    const found = Object.entries(PRODUCTS).find(([pid, prod]) => toUrlSlug(prod.naziv) === slugOrId);
    if (found) { id = found[0]; p = found[1]; }
  }
  if (!p) {
    view.innerHTML = `<div class="notfound-wrap"><h1 class="serif">404</h1><p>Model nije pronađen.</p><a href="#/" class="btn-dark" style="display:inline-block;width:auto;padding:14px 30px;">Nazad na početnu</a></div>`;
    return;
  }
  runTransaction(ref(db, "pregledi/" + id), cur => (cur || 0) + 1).catch(() => {});
  const imgs = imagesOf(p);
  const boje = p.boje || ["crna", "bela"];
  const polovi = p.polovi || ["muška", "ženska"];
  const velicine = p.velicine || ["XS", "S", "M", "L", "XL", "XXL"];
  detailState = { id, imgIndex: 0, boja: boje[0], pol: polovi[0], velicina: velicine[0], kolicina: 1 };

  const rating = ratingOf(p, id);
  const filledStars = Math.round(rating);
  const gledaBrojevi = [
    { r: "jedna osoba gleda" },
    { r: "dve osobe gledaju" },
    { r: "tri osobe gledaju" },
    { r: "četiri osobe gledaju" },
    { r: "pet osoba gleda" }
  ];
  const gledaSada = gledaBrojevi[String(id).split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 5].r;

  view.innerHTML = `
    <div class="breadcrumbs">
      <a href="#/" onclick="goTo('#/')">Početna</a> /
      <a id="breadcrumbKolekcija" style="cursor:pointer;">${p.kolekcija || "Kolekcija"}</a> /
      <span>${p.naziv || ""}</span>
    </div>
    <div class="detail-wrap">
      <div class="detail-gallery">
        <div class="detail-main-frame" id="detailMainFrame">
          <img id="detailMainImg" src="${imgs[0]}" alt="${p.naziv || ""}">
          <div class="zoom-hint" id="zoomHintBtn">${ICON_ZOOM}</div>
          ${imgs.length > 1 ? `<div class="gal-arrow left" id="galPrev">‹</div><div class="gal-arrow right" id="galNext">›</div>` : ""}
        </div>
        ${imgs.length > 1 ? `<div class="scrub-track" id="scrubTrack"><div class="scrub-fill" id="scrubFill" style="width:${100 / imgs.length}%"></div></div>` : ""}
      </div>
      <div class="zoom-overlay" id="zoomOverlay"><button class="close-x">✕</button><img id="zoomImg" src=""></div>
      <div class="detail-info">
        <div class="detail-collection-tag" id="detailCollectionTag" style="cursor:pointer;" data-kolekcija="${(p.kolekcija || "").replace(/"/g, "&quot;")}">${(p.kolekcija || "").toUpperCase()}</div>
        ${(p.majica || p.novo || p.popularno || p.akcija) ? `<div class="badge-stack-inline">
          ${p.majica ? '<span class="badge badge-majica">MAJICA</span>' : ''}
          ${p.novo ? '<span class="badge badge-novo">NOVO</span>' : ''}
          ${p.popularno ? '<span class="badge badge-popularno">POPULARNO</span>' : ''}
          ${p.akcija ? `<span class="badge badge-akcija">AKCIJA ${p.akcija}%</span>` : ''}
        </div>` : ''}
        <h1 class="detail-name">${p.naziv || ""}</h1>
        <div class="rating-row">
          <div class="stars-wrapper">${[1,2,3,4,5].map(n => `<span class="star ${n <= filledStars ? 'filled' : ''}">★</span>`).join("")}</div>
          <span class="rating-text">${rating} / 5</span>
          <button class="share-badge" id="shareProductBtn">${ICON_SHARE} Podeli</button>
        </div>
        <div class="viewing-now">🔥 Trenutno ${gledaSada} ovaj model</div>
        <p class="detail-desc">${p.opis || "Opis modela uskoro."}</p>
        <div style="display:flex; gap:20px; margin-bottom:22px;">
          <div class="size-chart-link" id="openSizeChart" style="margin-bottom:0;">Tabela veličina</div>
          <div class="size-chart-link" id="openFactsModal" style="margin-bottom:0;">O materijalu i izradi</div>
        </div>

        <div class="opt-block">
          <div class="opt-label">BOJA</div>
          <div class="opt-row" id="colorRow">
            ${boje.map(b => `<div class="opt-swatch ${b === boje[0] ? 'selected' : ''}" data-val="${b}" style="background:${b === 'crna' ? '#111' : '#fff'}; ${b === 'bela' ? 'border:1.5px solid #111;' : ''}" title="${b}"></div>`).join("")}
          </div>
        </div>

        <div class="opt-block">
          <div class="opt-label">POL</div>
          <div class="opt-row" id="polRow">
            ${polovi.map(g => `<div class="opt-pill ${g === polovi[0] ? 'selected' : ''}" data-val="${g}">${g}</div>`).join("")}
          </div>
        </div>

        <div class="opt-block">
          <div class="opt-label">VELIČINA</div>
          <div class="opt-row" id="sizeRow">
            ${velicine.map(v => `<div class="opt-pill ${v === velicine[0] ? 'selected' : ''}" data-val="${v}">${v}</div>`).join("")}
          </div>
        </div>

        <div class="qty-price-row">
          <div class="qty-stepper-lg" id="detailQty">
            <button data-d="-1">−</button><span>1</span><button data-d="1">+</button>
          </div>
          <div class="detail-price">${p.akcija ? `<span class="pprice-old">${money(p.cena || 0)}</span> <span class="pprice-new">${money(effectivePrice(p))}</span>` : money(p.cena || 0)}</div>
        </div>

        <button class="btn-dark detail-add-btn" id="detailAddBtn">Dodaj u korpu</button>
        <div class="trust-emojis-row">
          <span>${ICON_LOCK} Sigurna kupovina</span>
          <span>${ICON_SPARKLE} Premium brend</span>
          <span>${ICON_CASH} Plaćanje pouzećem</span>
        </div>
      </div>
    </div>

    <div class="related-block">
      <div class="section-head left-align"><h2>Možda će vam se svideti</h2></div>
      <div class="grid-4" id="relatedGrid"></div>
    </div>

    <section class="section" style="max-width:760px;">
      <div class="section-head"><h2>Česta pitanja</h2></div>
      <div id="faqDetail"></div>
    </section>
  `;

  // gallery interactions — swipeable main image + scrub progress bar
  const setImg = i => {
    i = ((i % imgs.length) + imgs.length) % imgs.length;
    detailState.imgIndex = i;
    const mainImg = document.getElementById("detailMainImg");
    mainImg.src = imgs[i];
    mainImg.classList.toggle("is-design", imgs[i] === p.dizajnSlika);
    const fill = document.getElementById("scrubFill");
    if (fill) fill.style.width = `${((i + 1) / imgs.length) * 100}%`;
  };
  document.getElementById("galPrev")?.addEventListener("click", () => setImg(detailState.imgIndex - 1));
  document.getElementById("galNext")?.addEventListener("click", () => setImg(detailState.imgIndex + 1));
  const frameEl = document.getElementById("detailMainFrame");
  if (frameEl) {
    let startX = null;
    const onStart = (x, e) => { if (e.target.closest(".gal-arrow, .zoom-hint")) { startX = null; return; } startX = x; };
    // touch: tap left/right half to navigate, swipe to navigate, no tap-to-zoom (use the zoom icon instead)
    const onTouchEnd = (x, e) => {
      if (startX === null) return;
      if (e.target.closest(".gal-arrow, .zoom-hint")) { startX = null; return; }
      e.preventDefault(); // stop the browser's follow-up synthetic mouse/click event from also firing (was opening zoom on every tap)
      const diff = x - startX;
      if (imgs.length > 1 && Math.abs(diff) > 40) {
        setImg(detailState.imgIndex + (diff < 0 ? 1 : -1));
      } else if (imgs.length > 1 && Math.abs(diff) < 8) {
        const rect = frameEl.getBoundingClientRect();
        const tappedRight = (x - rect.left) > rect.width / 2;
        setImg(detailState.imgIndex + (tappedRight ? 1 : -1));
      }
      startX = null;
    };
    // mouse (desktop): click opens zoom, drag swipes
    const onMouseEnd = (x, e) => {
      if (startX === null) return;
      if (e.target.closest(".gal-arrow, .zoom-hint")) { startX = null; return; }
      const diff = x - startX;
      if (Math.abs(diff) > 40 && imgs.length > 1) {
        setImg(detailState.imgIndex + (diff < 0 ? 1 : -1));
      } else if (Math.abs(diff) < 8) {
        openZoom(imgs[detailState.imgIndex]);
      }
      startX = null;
    };
    frameEl.addEventListener("touchstart", e => onStart(e.touches[0].clientX, e));
    frameEl.addEventListener("touchend", e => onTouchEnd(e.changedTouches[0].clientX, e));
    frameEl.addEventListener("mousedown", e => onStart(e.clientX, e));
    frameEl.addEventListener("mouseup", e => onMouseEnd(e.clientX, e));
  }
  const scrubTrack = document.getElementById("scrubTrack");
  scrubTrack?.addEventListener("click", e => {
    const rect = scrubTrack.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setImg(Math.floor(ratio * imgs.length));
  });

  const zoomOverlay = document.getElementById("zoomOverlay");
  function openZoom(src) {
    document.getElementById("zoomImg").src = src;
    zoomOverlay.classList.add("show");
  }
  document.getElementById("zoomHintBtn")?.addEventListener("click", (e) => { e.stopPropagation(); openZoom(imgs[detailState.imgIndex]); });
  zoomOverlay.addEventListener("click", () => zoomOverlay.classList.remove("show"));

  // option selectors
  document.querySelectorAll("#colorRow .opt-swatch").forEach(el => el.addEventListener("click", () => {
    document.querySelectorAll("#colorRow .opt-swatch").forEach(x => x.classList.remove("selected"));
    el.classList.add("selected"); detailState.boja = el.dataset.val;
  }));
  document.querySelectorAll("#polRow .opt-pill").forEach(el => el.addEventListener("click", () => {
    document.querySelectorAll("#polRow .opt-pill").forEach(x => x.classList.remove("selected"));
    el.classList.add("selected"); detailState.pol = el.dataset.val;
  }));
  document.querySelectorAll("#sizeRow .opt-pill").forEach(el => el.addEventListener("click", () => {
    document.querySelectorAll("#sizeRow .opt-pill").forEach(x => x.classList.remove("selected"));
    el.classList.add("selected"); detailState.velicina = el.dataset.val;
  }));
  document.querySelectorAll("#detailQty button").forEach(btn => btn.addEventListener("click", () => {
    const span = document.querySelector("#detailQty span");
    detailState.kolicina = Math.max(1, detailState.kolicina + Number(btn.dataset.d));
    span.textContent = detailState.kolicina;
  }));
  document.getElementById("detailAddBtn").addEventListener("click", () => addToCart(id));
  document.getElementById("openSizeChart").addEventListener("click", openSizeChart);
  document.getElementById("openFactsModal").addEventListener("click", openFactsModal);
  document.getElementById("detailCollectionTag").addEventListener("click", (e) => goTo(`#/kolekcija/${toUrlSlug(e.target.dataset.kolekcija)}`));
  document.getElementById("breadcrumbKolekcija").addEventListener("click", () => goTo(`#/kolekcija/${toUrlSlug(p.kolekcija || "")}`));
  document.getElementById("shareProductBtn").addEventListener("click", () => shareProduct(p, id));

  renderRelated(id, p);
  renderFAQ(document.getElementById("faqDetail"));
}

async function shareProduct(p, id) {
  const url = `${location.origin}${location.pathname}#/model/${toUrlSlug(p.naziv)}`;
  const priceText = p.akcija ? `${money(effectivePrice(p))} (umesto ${money(p.cena || 0)})` : money(p.cena || 0);
  const text = `${p.naziv} — ${p.kolekcija || ""} — ${priceText}`;
  const imgUrl = p.dizajnSlika || imgOf(p);

  // try sharing the image itself as a file, with text as caption
  try {
    const resp = await fetch(imgUrl);
    const blob = await resp.blob();
    const file = new File([blob], "carlos-cruz.jpg", { type: blob.type || "image/jpeg" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `Carlos Cruz — ${p.naziv}`, text: `${text}\n${url}` });
      return;
    }
  } catch (e) { /* fall through to link-only share */ }

  if (navigator.share) {
    try { await navigator.share({ title: `Carlos Cruz — ${p.naziv}`, text, url }); return; } catch (e) { /* canceled or unsupported */ }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
  } catch (e) {
    prompt("Kopiraj link:", url);
  }
}

async function shareCollection(naziv, opis, colEntry) {
  const url = `${location.origin}${location.pathname}#/kolekcija/${toUrlSlug(naziv)}`;
  const text = opis ? `${naziv} — ${opis}` : naziv;
  const firstProduct = Object.values(PRODUCTS).find(p => p.kolekcija === naziv);
  const imgUrl = firstProduct ? (firstProduct.dizajnSlika || imgOf(firstProduct)) : null;

  if (imgUrl) {
    try {
      const resp = await fetch(imgUrl);
      const blob = await resp.blob();
      const file = new File([blob], "carlos-cruz.jpg", { type: blob.type || "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Carlos Cruz — ${naziv}`, text: `${text}\n${url}` });
        return;
      }
    } catch (e) { /* fall through to link-only share */ }
  }

  if (navigator.share) {
    try { await navigator.share({ title: `Carlos Cruz — ${naziv}`, text, url }); return; } catch (e) { /* canceled or unsupported */ }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
  } catch (e) {
    prompt("Kopiraj link:", url);
  }
}

function renderRelated(currentId, current) {
  const host = document.getElementById("relatedGrid");
  if (!host) return;
  const list = Object.entries(PRODUCTS).filter(([id, p]) => id !== currentId && p.kolekcija === current.kolekcija).slice(0, 4);
  host.innerHTML = "";
  list.forEach(([id, p]) => host.appendChild(productCard(id, p)));
}

/* ============================================================
   SIZE CHART MODAL (real tables, not images)
   ============================================================ */
const SIZE_CHARTS = {
  m: {
    label: "Muške majice",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    grudi: [47.5, 49.5, 52.5, 55.5, 58.5, 61.5],
    duzina: [66, 70, 73, 75, 77, 79.5]
  },
  z: {
    label: "Ženske majice",
    sizes: ["S", "M", "L", "XL", "XXL"],
    grudi: [41, 44, 47, 50, 53],
    duzina: [63, 65, 67, 69, 71]
  }
};
function sizeTableHTML(type) {
  const d = SIZE_CHARTS[type];
  return `
    <table class="size-table">
      <caption>${d.label}</caption>
      <thead><tr><th></th>${d.sizes.map(s => `<th>${s}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><td>Poluobim grudi (cm)</td>${d.grudi.map(v => `<td>${v}</td>`).join("")}</tr>
        <tr><td>Dužina (cm)</td>${d.duzina.map(v => `<td>${v}</td>`).join("")}</tr>
      </tbody>
    </table>
    <p class="size-table-note">Mere su okvirne i mogu odstupati ±1–2 cm zavisno od modela.<br>A — poluobim grudi (izmereno od šava do šava)<br>B — dužina majice od ramena do dna</p>
    <button class="share-badge share-badge-visible" id="shareSizeChartBtn" style="margin:4px auto 0;">${ICON_SHARE} Podeli kao sliku</button>
  `;
}
function drawSizeChartCanvas(type) {
  const d = SIZE_CHARTS[type];
  const cols = d.sizes.length;
  const colW = 90, labelW = 190, rowH = 54, headH = 70, pad = 30;
  const w = labelW + cols * colW + pad * 2;
  const h = headH + rowH * 3 + pad * 2;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#111111";
  ctx.font = "italic 26px Georgia, serif";
  ctx.fillText(`Carlos Cruz — ${d.label}`, pad, pad + 30);
  ctx.font = "12px Arial";
  ctx.fillStyle = "#8a8680";
  const headerY = pad + headH;
  ctx.fillText("VELIČINA", pad, headerY - 10);
  d.sizes.forEach((s, i) => {
    ctx.fillStyle = "#111111";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(s, pad + labelW + i * colW + colW / 2, headerY - 10);
  });
  ctx.textAlign = "left";
  const rows = [["Poluobim grudi (cm)", d.grudi], ["Dužina (cm)", d.duzina]];
  rows.forEach((row, ri) => {
    const y = headerY + ri * rowH;
    ctx.strokeStyle = "#e6e3dc"; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
    ctx.fillStyle = "#4a4a4a"; ctx.font = "13px Arial";
    ctx.fillText(row[0], pad, y + rowH / 2 + 5);
    row[1].forEach((v, i) => {
      ctx.fillStyle = "#111111"; ctx.font = "14px Arial"; ctx.textAlign = "center";
      ctx.fillText(String(v), pad + labelW + i * colW + colW / 2, y + rowH / 2 + 5);
      ctx.textAlign = "left";
    });
  });
  return canvas;
}
async function shareSizeChart(type) {
  const canvas = drawSizeChartCanvas(type);
  canvas.toBlob(async blob => {
    const fileName = `carlos-cruz-tabela-velicina-${type === "m" ? "muske" : "zenske"}.png`;
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Tabela veličina — Carlos Cruz" }); return; } catch (e) { /* fall through to download */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
window.shareSizeChart = shareSizeChart;
function lockBodyScroll() { document.body.style.overflow = "hidden"; }
function unlockBodyScroll() { document.body.style.overflow = ""; }

function openSizeChart() {
  document.getElementById("sizeChartModal").classList.add("show");
  lockBodyScroll();
  setSizeTab("m");
}
function closeSizeChart() { document.getElementById("sizeChartModal").classList.remove("show"); unlockBodyScroll(); }
function setSizeTab(type) {
  document.querySelectorAll(".modal-tabs button").forEach(b => b.classList.toggle("active", b.dataset.t === type));
  document.getElementById("sizeChartContent").innerHTML = sizeTableHTML(type);
  document.getElementById("shareSizeChartBtn").addEventListener("click", () => shareSizeChart(type));
}
window.closeSizeChart = closeSizeChart;
window.setSizeTab = setSizeTab;

const MATERIAL_FACTS = [
  "100% prirodni pamuk – pruža maksimalnu mekoću na koži i vrhunski osećaj udobnosti tokom celog dana.",
  "Premium DTF štampa – najnovija generacija štampe koja zadržava pun intenzitet boja i stabilnost teksture nakon pranja.",
  "Šivenje iz tube – moderan kroj koji obezbeđuje savršeno ravan i stabilan pad majice duž tela.",
  "Maksimalna izdržljivost – dupli štepovi na renderu, rukavima i dnu, uz dodatni štep duž ramena, za dug vek trajanja.",
  "Udobnost oko vrata – okovratnik ojačan trakom zadržava svoj prvobitni oblik i pruža prijatan osećaj na koži."
];
function openFactsModal() {
  document.getElementById("factsContent").innerHTML = `
    <div class="facts-list">
      ${MATERIAL_FACTS.map(f => `<div class="facts-item">${f}</div>`).join("")}
    </div>
  `;
  document.getElementById("factsModal").classList.add("show");
  lockBodyScroll();
}
function closeFactsModal() { document.getElementById("factsModal").classList.remove("show"); unlockBodyScroll(); }
window.openFactsModal = openFactsModal;
window.closeFactsModal = closeFactsModal;

document.querySelectorAll(".modal-scrim").forEach(scrim => {
  scrim.addEventListener("click", (e) => { if (e.target === scrim) scrim.classList.remove("show"), unlockBodyScroll(); });
});

/* ============================================================
   FAQ
   ============================================================ */
const FAQ_ITEMS = [
  { q: "Koliko traje isporuka?", a: "Isporuka traje 5–7 dana, u zavisnosti od vaše lokacije u Srbiji." },
  { q: "Da li mogu da platim pouzećem?", a: "Da, plaćanje se vrši kuriru prilikom preuzimanja pošiljke." },
  { q: "Kako da izaberem pravu veličinu?", a: "Pogledajte tabelu veličina na stranici svakog modela za tačne mere." },
];
const FAQ_ITEMS_FULL = [
  ...FAQ_ITEMS,
  { q: "Da li mogu da vratim ili zamenim model?", a: "Nažalost, ne vršimo zamenu niti povraćaj robe. Sve majice izrađujemo isključivo po porudžbini (custom-made). Molimo vas da pre kupovine pažljivo pogledate našu tabelu veličina kako biste odabrali odgovarajući model." },
  { q: "Da li štampate majice po porudžbini?", a: "Da, svaki komad se štampa posebno nakon porudžbine, zato molimo za strpljenje pri isporuci." },
  { q: "Koje veličine su dostupne?", a: "I muške i ženske majice dostupne su u veličinama od S do XXL — pogledajte tabelu veličina na stranici modela za tačne mere." },
  { q: "Da li dostavljate van Srbije?", a: "Trenutno dostavljamo samo na teritoriji Srbije." },
  { q: "Da li su boje na sajtu identične boji majice?", a: "Trudimo se da fotografije verno prikažu model, ali male razlike u nijansi su moguće u zavisnosti od vašeg ekrana." },
  { q: "Kako da vam se obratim za dodatna pitanja?", a: "Slobodno nam pišite putem kontakt forme ili društvenih mreža — odgovaramo u najkraćem mogućem roku." },
];
function renderFAQ(host, full = false) {
  if (!host) return;
  const items = full ? FAQ_ITEMS_FULL : FAQ_ITEMS;
  host.innerHTML = items.map((f, i) => `
    <div class="faq-item" data-i="${i}">
      <div class="faq-q">${f.q}<span class="faq-plus">+</span></div>
      <div class="faq-a">${f.a}</div>
    </div>
  `).join("");
  host.querySelectorAll(".faq-item").forEach(item => {
    item.querySelector(".faq-q").addEventListener("click", () => item.classList.toggle("open"));
  });
}

/* ============================================================
   SIDE DRAWER
   ============================================================ */
function renderSideDrawerCollections() {
  const host = document.getElementById("drawerCollections");
  if (!host) return;
  host.innerHTML = Object.values(COLLECTIONS).map(c => {
    const naziv = c.naziv || c;
    return `<a class="sd-sub" href="#/kolekcija/${toUrlSlug(naziv)}" onclick="goTo('#/kolekcija/${toUrlSlug(naziv)}')">${naziv}</a>`;
  }).join("");
}
function openDrawer() { document.getElementById("sideDrawer").classList.add("open"); document.getElementById("scrim").classList.add("show"); }
function closeDrawer() { document.getElementById("sideDrawer")?.classList.remove("open"); if (!document.getElementById("cartDrawer")?.classList.contains("open")) document.getElementById("scrim")?.classList.remove("show"); }
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;

/* ============================================================
   CART
   ============================================================ */
function loadCart() {
  try { cart = JSON.parse(localStorage.getItem("cc_cart") || "[]"); } catch (e) { cart = []; }
  renderCart();
}
function saveCart() { localStorage.setItem("cc_cart", JSON.stringify(cart)); }

function addToCart(id) {
  const p = PRODUCTS[id];
  if (!p) return;
  const key = `${id}_${detailState.boja}_${detailState.pol}_${detailState.velicina}`;
  const existing = cart.find(i => i.key === key);
  if (existing) {
    existing.kolicina += detailState.kolicina;
  } else {
    cart.push({
      key, id, naziv: p.naziv, cena: effectivePrice(p), cenaPuna: p.cena, akcija: p.akcija || null,
      slika: imageForColor(p, detailState.boja) || imgOf(p),
      boja: detailState.boja, pol: detailState.pol, velicina: detailState.velicina,
      kolicina: detailState.kolicina
    });
  }
  saveCart(); renderCart(); openCart();
  showToast(`${p.naziv} je dodat u korpu`);
}
window.addToCart = addToCart;

function renderCart() {
  const badge = document.getElementById("cartBadge");
  if (badge) badge.textContent = `(${cart.length})`;
  const host = document.getElementById("cartItems");
  if (!host) return;
  if (!cart.length) { host.innerHTML = `<div class="cart-empty-msg">Korpa je trenutno prazna.</div>`; updateCartFoot(); return; }
  host.innerHTML = cart.map(item => `
    <div class="cart-item" data-key="${item.key}">
      <img src="${item.slika}" alt="" loading="lazy">
      <div>
        <h4>${item.naziv}</h4>
        <div class="ci-meta">${item.boja} · ${item.pol} · ${item.velicina}</div>
        <div class="cart-qty-row">
          <div class="qty-stepper">
            <button data-d="-1">−</button><span>${item.kolicina}</span><button data-d="1">+</button>
          </div>
        </div>
        <div class="cart-price">${item.akcija ? `<span class="pprice-old">${money(item.cenaPuna * item.kolicina)}</span> <span class="pprice-new">${money(item.cena * item.kolicina)}</span>` : money(item.cena * item.kolicina)}</div>
      </div>
      <button class="remove-x" data-remove="${item.key}">✕</button>
    </div>
  `).join("");

  host.querySelectorAll(".qty-stepper button").forEach(btn => btn.addEventListener("click", () => {
    const key = btn.closest(".cart-item").dataset.key;
    const item = cart.find(i => i.key === key);
    item.kolicina = Math.max(1, item.kolicina + Number(btn.dataset.d));
    saveCart(); renderCart();
  }));
  host.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => {
    cart = cart.filter(i => i.key !== btn.dataset.remove);
    saveCart(); renderCart();
  }));
  updateCartFoot();
}

function updateCartFoot() {
  const foot = document.getElementById("cartFoot");
  if (!foot) return;
  const total = cart.reduce((s, i) => s + i.cena * i.kolicina, 0);
  foot.innerHTML = cart.length ? `
    <div class="cart-total-row"><span>Ukupno</span><span>${money(total)}</span></div>
    <button class="btn-dark" id="checkoutBtn">Nastavi na plaćanje</button>
  ` : "";
  document.getElementById("checkoutBtn")?.addEventListener("click", () => { closeCart(); goTo("#/checkout"); });
}

function openCart() { document.getElementById("cartDrawer").classList.add("open"); document.getElementById("scrim").classList.add("show"); }
function closeCart() {
  document.getElementById("cartDrawer")?.classList.remove("open");
  if (!document.getElementById("sideDrawer")?.classList.contains("open")) document.getElementById("scrim")?.classList.remove("show");
  if (!cart.length && location.hash.startsWith("#/checkout")) goTo("#/");
}
window.openCart = openCart;
window.closeCart = closeCart;

/* ============================================================
   CHECKOUT — full page (not a modal)
   ============================================================ */
let checkoutStep = 1;
let appliedCode = null; // { id, kod, tip, vrednost }
let DELIVERY_FEE = 600;
onValue(ref(db, "cenaDostave"), snap => { const v = snap.val(); if (v !== null && v !== undefined) DELIVERY_FEE = Number(v); });

function computeTotals() {
  const subtotal = cart.reduce((s, i) => s + i.cena * i.kolicina, 0);
  const totalQty = cart.reduce((s, i) => s + i.kolicina, 0);
  let discount = 0;
  if (appliedCode) {
    discount = appliedCode.tip === "procenat" ? subtotal * (appliedCode.vrednost / 100) : Math.min(appliedCode.vrednost, subtotal);
  }
  let deliveryFee = DELIVERY_FEE;
  let besplatnaDostavaRazlog = null;
  if (SPECIJALNE_PONUDE.korpaPreko5000 && subtotal > 5000) {
    deliveryFee = 0; besplatnaDostavaRazlog = "korpa preko 5000 RSD";
  } else if (SPECIJALNE_PONUDE.kupi3Modela && totalQty >= 3) {
    deliveryFee = 0; besplatnaDostavaRazlog = "kupljena 3 ili više modela";
  }
  const finalTotal = Math.max(0, subtotal - discount) + deliveryFee;
  return { subtotal, discount, finalTotal, deliveryFee, besplatnaDostavaRazlog };
}

function renderCheckoutPage() {
  const view = document.getElementById("view");
  if (!cart.length) {
    view.innerHTML = `<div class="notfound-wrap"><h1 class="serif" style="font-size:32px;">Korpa je prazna</h1><p>Dodajte modele pre nego što nastavite na plaćanje.</p><a href="#/svi-modeli" onclick="goTo('#/svi-modeli')" class="btn-dark" style="display:inline-block;width:auto;padding:14px 30px;">Pogledaj modele</a></div>`;
    return;
  }
  checkoutStep = 1;
  appliedCode = null;
  drawCheckoutStep(JSON.parse(localStorage.getItem("cc_customer") || "{}"));
}

function stepperHTML() {
  const s1 = checkoutStep >= 1 ? "active" : "";
  const s2done = checkoutStep >= 2 ? "done" : "";
  const s2active = checkoutStep === 2 ? "active" : "";
  return `
    <div class="checkout-stepper">
      <div class="step-item ${checkoutStep === 1 ? "active" : "done"}"><div class="step-circle">${checkoutStep > 1 ? "✓" : "1"}</div><div class="step-label">Podaci za dostavu</div></div>
      <div class="step-line ${checkoutStep > 1 ? "done" : ""}"></div>
      <div class="step-item ${s2active}${s2done}"><div class="step-circle">2</div><div class="step-label">Pregled porudžbine</div></div>
    </div>
  `;
}

function validateCode(kodTekst) {
  kodTekst = kodTekst.trim().toUpperCase();
  if (!kodTekst) return { ok: false, msg: "Unesite kod." };
  const entry = Object.entries(KODOVI).find(([id, k]) => (k.kod || "").toUpperCase() === kodTekst);
  if (!entry) return { ok: false, msg: "Nevažeći kod." };
  const [id, k] = entry;
  if (k.rokIsteka && Date.now() > k.rokIsteka) return { ok: false, msg: "Nevažeći kod." };
  if (k.jednokratna && k.iskorisceno) return { ok: false, msg: "Nevažeći kod." };
  return { ok: true, code: { id, kod: k.kod, tip: k.tip, vrednost: k.vrednost } };
}

function drawCheckoutStep(saved = {}) {
  if (!cart.length) { goTo("#/"); return; }
  const view = document.getElementById("view");
  if (checkoutStep === 1) {
    view.innerHTML = `
      <div class="checkout-page">
        ${stepperHTML()}
        <div class="checkout-grid">
          <div class="checkout-card">
            <h3>Podaci za dostavu</h3>
            <div class="form-row"><label>Ime i prezime</label><input id="ck_ime" value="${saved.ime || ""}"></div>
            <div class="form-2col">
              <div class="form-row"><label>Email</label><input id="ck_email" value="${saved.email || ""}"></div>
              <div class="form-row"><label>Telefon</label><input id="ck_telefon" value="${saved.telefon || ""}"></div>
            </div>
            <div class="form-row"><label>Adresa</label><input id="ck_adresa" value="${saved.adresa || ""}"></div>
            <div class="form-2col">
              <div class="form-row"><label>Grad</label><input id="ck_grad" value="${saved.grad || ""}"></div>
              <div class="form-row"><label>Poštanski broj</label><input id="ck_postanski" value="${saved.postanski || ""}"></div>
            </div>
          </div>
          <div class="checkout-card method-card">
            <h3>Način dostave i plaćanja</h3>
            <div class="method-icon-row">
              <div class="icon-circle">${ICON_TRUCK}</div>
              <div><strong>Dostava na adresu</strong><p>Kurirska služba, isporuka za 5–7 dana širom Srbije.</p></div>
            </div>
            <div class="method-icon-row">
              <div class="icon-circle">${ICON_CASH}</div>
              <div><strong>Plaćanje pouzećem</strong><p>Platite gotovinom kuriru prilikom preuzimanja pošiljke.</p></div>
            </div>
          </div>
        </div>
        <div class="checkout-footer-row">
          <div></div>
          <button class="btn-dark" id="toStep2">Nastavi na pregled</button>
        </div>
      </div>
    `;
    document.getElementById("toStep2").addEventListener("click", () => {
      clearFieldErrors(document.querySelector(".checkout-page"));
      const podaci = {
        ime: val("ck_ime"), email: val("ck_email"), telefon: val("ck_telefon"),
        adresa: val("ck_adresa"), grad: val("ck_grad"), postanski: val("ck_postanski")
      };
      let ok = true;
      if (!podaci.ime) { showFieldError("ck_ime"); ok = false; }
      if (!podaci.telefon) { showFieldError("ck_telefon"); ok = false; }
      if (!podaci.adresa) { showFieldError("ck_adresa"); ok = false; }
      if (!ok) return;
      localStorage.setItem("cc_customer", JSON.stringify(podaci));
      checkoutStep = 2;
      drawCheckoutStep(podaci);
      window.scrollTo(0, 0);
    });
  } else if (checkoutStep === 2) {
    const { subtotal, discount, finalTotal, deliveryFee, besplatnaDostavaRazlog } = computeTotals();
    view.innerHTML = `
      <div class="checkout-page">
        ${stepperHTML()}
        <div class="checkout-grid">
          <div class="checkout-card">
            <h3>Podaci za dostavu</h3>
            <div class="checkout-delivery-info">
              <div>${saved.ime}</div>
              <div>${saved.adresa}</div>
              <div>${saved.grad}${saved.postanski ? ", " + saved.postanski : ""}</div>
              <div>${saved.telefon}</div>
              ${saved.email ? `<div>${saved.email}</div>` : ""}
            </div>
            <div class="form-row" style="margin-top:20px;"><label>Napomena (opciono)</label><textarea id="ck_napomena" rows="3"></textarea></div>
          </div>
          <div class="checkout-card">
            <h3>Pregled porudžbine</h3>
            ${cart.map(i => `<div class="checkout-summary-item"><img src="${i.slika}" alt="" class="ci-thumb"><span style="flex:1;">${i.naziv} × ${i.kolicina}<br><span style="font-size:11px;color:var(--grey);text-transform:uppercase;">${i.boja || ''}${i.pol ? ` · ${i.pol}` : ''}${i.velicina ? ` · ${i.velicina}` : ''}</span></span><span>${i.akcija ? `<span class="pprice-old">${money(i.cenaPuna * i.kolicina)}</span> <span class="pprice-new">${money(i.cena * i.kolicina)}</span>` : money(i.cena * i.kolicina)}</span></div>`).join("")}
            <div class="form-row" style="margin-top:14px;">
              <label>Kod za popust</label>
              <div style="display:flex; gap:8px;">
                <input id="ck_kod" placeholder="npr. CARLOSCRUZ" style="flex:1;" value="${appliedCode ? appliedCode.kod : ""}">
                <button class="btn-outline" id="applyCodeBtn" style="width:auto; margin-top:0; padding:0 18px; white-space:nowrap;">Primeni</button>
              </div>
              <div id="codeMsg" class="${appliedCode ? '' : ''}" style="font-size:11px; margin-top:6px; ${appliedCode ? 'color:#1a7a3c;' : 'color:var(--wine);'}">${appliedCode ? "Kod primenjen: " + appliedCode.kod : ""}</div>
            </div>
            <div class="checkout-summary-item"><span>Modeli</span><span>${money(subtotal)}</span></div>
            ${appliedCode ? `<div class="checkout-summary-item" style="color:#1a7a3c;"><span>Popust (${appliedCode.kod}${appliedCode.tip === "procenat" ? ` −${appliedCode.vrednost}%` : ""})</span><span>−${money(discount)}</span></div>` : ""}
            <div class="checkout-summary-item"><span>Dostava${besplatnaDostavaRazlog ? ` <span style="color:#1a7a3c;font-size:11px;">(besplatno — ${besplatnaDostavaRazlog})</span>` : ""}</span><span>${deliveryFee === 0 ? "BESPLATNO" : money(deliveryFee)}</span></div>
            <div class="checkout-total"><span>Ukupno za plaćanje</span><span>${money(finalTotal)}</span></div>
            <div class="trust-emojis-row"><span>${ICON_LOCK} Sigurna kupovina</span><span>${ICON_SPARKLE} Premium brend</span><span>${ICON_CASH} Plaćanje pouzećem</span></div>
          </div>
        </div>
        <div class="checkout-footer-row">
          <button class="btn-outline" id="backStep1">Nazad</button>
          <button class="btn-dark" id="confirmOrder">Potvrdi porudžbinu</button>
        </div>
      </div>
    `;
    document.getElementById("applyCodeBtn").addEventListener("click", () => {
      const res = validateCode(val("ck_kod"));
      const msgEl = document.getElementById("codeMsg");
      const inputEl = document.getElementById("ck_kod");
      if (res.ok) {
        appliedCode = res.code;
        drawCheckoutStep(saved);
      } else {
        appliedCode = null;
        inputEl.classList.add("err");
        msgEl.style.color = "var(--wine)";
        msgEl.textContent = res.msg;
      }
    });
    document.getElementById("backStep1").addEventListener("click", () => { checkoutStep = 1; drawCheckoutStep(saved); window.scrollTo(0, 0); });
    document.getElementById("confirmOrder").addEventListener("click", () => submitOrder(saved));
  }
}
function val(id) { return document.getElementById(id)?.value.trim() || ""; }

async function generateOrderCode() {
  const counterRef = ref(db, "poslednji_broj_porudzbine");
  const result = await runTransaction(counterRef, current => (current || 0) + 1);
  const brojFormatiran = String(result.snapshot.val()).padStart(4, "0");
  const d = new Date();
  const datumFormatiran = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `CC-${datumFormatiran}-${brojFormatiran}`;
}

async function submitOrder(customer) {
  const { subtotal, discount, finalTotal, deliveryFee } = computeTotals();
  const sifra = await generateOrderCode();
  const order = {
    sifra,
    ...customer,
    napomena: val("ck_napomena"),
    stavke: cart,
    proizvodi: subtotal,
    popustKod: appliedCode ? appliedCode.kod : null,
    popustIznos: discount,
    dostava: deliveryFee,
    ukupno: finalTotal,
    datum: Date.now(),
    status: "nova"
  };
  push(ref(db, "porudzbine"), order).then(() => {
    if (appliedCode && appliedCode.tip !== undefined) {
      const codeData = KODOVI[appliedCode.id];
      if (codeData && codeData.jednokratna) remove(ref(db, "kodovi/" + appliedCode.id));
    }
    sendOrderEmails(order);
    cart = []; saveCart(); renderCart();
    document.getElementById("view").innerHTML = `
      <div class="checkout-page">
        <div class="checkout-success">
          <div class="big-check">✓</div>
          <h3 class="serif">Hvala na porudžbini!</h3>
          <p class="success-text">Broj porudžbine: <strong>${sifra}</strong><br>Stigao vam je email sa potvrdom porudžbine.</p>
          <p class="success-subtext">Vraćamo vas na početnu za nekoliko sekundi...</p>
        </div>
      </div>
    `;
    setTimeout(() => goTo("#/"), 10000);
  }).catch(() => showToast("Greška — pokušajte ponovo.", "error"));
}

/* ============================================================
   SEARCH
   ============================================================ */
function doSearch(q) {
  q = q.trim();
  if (!q) return;
  closeDrawer();
  goTo(`#/pretraga/${encodeURIComponent(q)}`);
  const headerInput = document.getElementById("searchInput");
  const drawerInput = document.getElementById("drawerSearchInput");
  if (headerInput) headerInput.value = "";
  if (drawerInput) drawerInput.value = "";
}
window.doSearch = doSearch;

function renderSearchPage(q) {
  const view = document.getElementById("view");
  const qLower = q.toLowerCase();
  const list = Object.entries(PRODUCTS).filter(([id, p]) => (p.naziv || "").toLowerCase().includes(qLower));
  view.innerHTML = `
    <div class="breadcrumbs"><a href="#/" onclick="goTo('#/')">Početna</a> / <span>Rezultati pretrage</span></div>
    <section class="section">
      <div id="searchResultsHost"></div>
    </section>
  `;
  const host = document.getElementById("searchResultsHost");
  if (!list.length) {
    const suggestions = Object.entries(PRODUCTS).filter(([id, p]) => p.bestseler).slice(0, 4);
    const fallback = suggestions.length ? suggestions : Object.entries(PRODUCTS).slice(0, 4);
    host.innerHTML = `<p style="color:var(--grey);">Nema rezultata za "${q}".</p>`;
    if (fallback.length) {
      host.innerHTML += `<p style="font-style:italic;margin:20px 0 20px;">Možda vam se svidi:</p>`;
      const wrap = document.createElement("div");
      wrap.className = "grid-4";
      fallback.forEach(([id, p]) => wrap.appendChild(productCard(id, p)));
      host.appendChild(wrap);
    }
    return;
  }
  const wrap = document.createElement("div");
  wrap.className = "grid-4";
  list.forEach(([id, p]) => wrap.appendChild(productCard(id, p)));
  host.appendChild(wrap);
}

/* ============================================================
   INIT — header wiring
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  loadCart();
  document.getElementById("scrim").addEventListener("click", () => { closeDrawer(); closeCart(); });
  document.getElementById("searchInput")?.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(e.target.value); });
  document.getElementById("searchIcon")?.addEventListener("click", () => doSearch(document.getElementById("searchInput").value));
  router();
});
