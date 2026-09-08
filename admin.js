import { db, ref, onValue, push, set, update, remove, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "./firebase-init.js";

let PRODUCTS = {}, COLLECTIONS = {}, PROMO = {}, ORDERS = {}, MESSAGES = {};
let editingId = null;
let pendingImages = []; // cloudinary URLs for product being edited/created
let pendingDesignUrl = null; // which image (url) is marked as the "design" closeup
let pendingImageColors = {}; // url -> "crna" | "bela"
let pendingCardImages = null; // array of urls included in card rotation, or null = all

/* ---------- TABS ---------- */
document.querySelectorAll(".a-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".a-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".a-panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("panel-" + tab.dataset.tab).classList.add("active");
    document.getElementById("pageTitle").textContent = tab.textContent;
    closeAdminDrawer();
  });
});

/* ---------- MOBILE DRAWER ---------- */
function openAdminDrawer() { document.getElementById("aSide").classList.add("open"); document.getElementById("aScrim").classList.add("show"); }
function closeAdminDrawer() { document.getElementById("aSide").classList.remove("open"); document.getElementById("aScrim").classList.remove("show"); }
document.getElementById("aHamburgerBtn").addEventListener("click", openAdminDrawer);
document.getElementById("aScrim").addEventListener("click", closeAdminDrawer);

/* ---------- CLOCK ---------- */
function tickClock() {
  document.getElementById("ahClock").textContent = new Date().toLocaleTimeString("sr-RS");
}
tickClock(); setInterval(tickClock, 1000);

/* ---------- TOAST ---------- */
window.showToast = function (msg, type = "success") {
  const c = document.getElementById("toast-container");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3500);
};
function money(n) { return Math.round(n || 0).toLocaleString("sr-RS") + " RSD"; }

/* ---------- LIVE NOTIF ---------- */
function showLiveNotif(msg) {
  const c = document.getElementById("liveNotifContainer");
  const el = document.createElement("div");
  el.className = "live-notif";
  el.innerHTML = `<span class="live-notif-dot"></span><span>${msg}</span>`;
  c.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 6000);
}
let knownOrderIds = null;
function detectNewOrders(data) {
  const ids = Object.keys(data);
  if (knownOrderIds === null) { knownOrderIds = new Set(ids); return; }
  ids.forEach(id => {
    if (!knownOrderIds.has(id)) {
      const o = data[id];
      showLiveNotif(`Nova porudžbina: ${o.ime || "Kupac"} — ${money(o.ukupno)}`);
    }
  });
  knownOrderIds = new Set(ids);
}

let knownMessageIds = null;
function detectNewMessages(data) {
  const ids = Object.keys(data);
  if (knownMessageIds === null) { knownMessageIds = new Set(ids); return; }
  ids.forEach(id => {
    if (!knownMessageIds.has(id)) {
      const m = data[id];
      showLiveNotif(`Nova poruka: ${m.ime || "Posetilac"}`);
    }
  });
  knownMessageIds = new Set(ids);
}
function renderMessagesTable() {
  const host = document.getElementById("messagesTable");
  if (!host) return;
  const sorted = Object.entries(MESSAGES).sort((a, b) => (b[1].datum || 0) - (a[1].datum || 0));
  host.innerHTML = sorted.map(([id, m]) => `
    <tr>
      <td>${m.ime || ''}</td>
      <td>${m.email || ''}</td>
      <td style="max-width:320px;">${m.poruka || ''}</td>
      <td>${new Date(m.datum).toLocaleString("sr-RS")}</td>
      <td><button class="btn danger" data-delmsg="${id}">Obriši</button></td>
    </tr>
  `).join("") || `<tr><td colspan="5" style="color:#999;">Nema poruka još.</td></tr>`;
  host.querySelectorAll("[data-delmsg]").forEach(btn => btn.addEventListener("click", () => {
    remove(ref(db, "poruke/" + btn.dataset.delmsg)).then(() => showToast("Poruka obrisana."));
  }));
}

/* ---------- FIREBASE LISTENERS ---------- */
onValue(ref(db, "proizvodi"), snap => { PRODUCTS = snap.val() || {}; renderProductsTable(); renderStats(); fillKolekcijaSelect(); renderBestsellerOrderList(); renderHeroPicker(); });
onValue(ref(db, "kolekcije"), snap => { COLLECTIONS = snap.val() || {}; renderCollectionsTable(); renderStats(); fillKolekcijaSelect(); });
onValue(ref(db, "promo"), snap => { PROMO = snap.val() || {}; renderPromoTable(); renderStats(); });
onValue(ref(db, "porudzbine"), snap => {
  ORDERS = snap.val() || {};
  detectNewOrders(ORDERS);
  renderOrdersTable(); renderRecentOrders(); renderStats();
});
onValue(ref(db, "poruke"), snap => {
  MESSAGES = snap.val() || {};
  detectNewMessages(MESSAGES);
  renderMessagesTable();
});
onValue(ref(db, "heroSlike"), snap => {
  const data = snap.val();
  heroProductIds = Array.isArray(data) ? data.filter(Boolean) : Object.keys(data || {});
  renderHeroPicker();
});

function renderStats() {
  document.getElementById("statProizvodi").textContent = Object.keys(PRODUCTS).length;
  document.getElementById("statKolekcije").textContent = Object.keys(COLLECTIONS).length;
  document.getElementById("statPorudzbine").textContent = Object.keys(ORDERS).length;
  document.getElementById("statPromo").textContent = Object.keys(PROMO).length;
}

/* ============================================================
   PROIZVODI
   ============================================================ */
function fillKolekcijaSelect() {
  const sel = document.getElementById("pf_kolekcija");
  const current = sel.value;
  sel.innerHTML = Object.values(COLLECTIONS).map(c => `<option value="${c.naziv || c}">${c.naziv || c}</option>`).join("") || `<option value="">Napravi prvo kolekciju</option>`;
  if (current) sel.value = current;
}

document.querySelectorAll("#pf_boje .chip, #pf_pol .chip, #pf_velicine .chip").forEach(chip => {
  chip.addEventListener("click", () => chip.classList.toggle("selected"));
});
document.getElementById("pf_akcija").addEventListener("input", (e) => {
  if (Number(e.target.value) > 50) e.target.value = 50;
  if (Number(e.target.value) < 0) e.target.value = 0;
});
document.getElementById("pf_ocena").addEventListener("input", (e) => {
  if (e.target.value !== "" && Number(e.target.value) < 4.6) e.target.value = 4.6;
  if (Number(e.target.value) > 5) e.target.value = 5;
});

const uploadDrop = document.getElementById("uploadDrop");
const fileInput = document.getElementById("fileInput");
uploadDrop.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", e => handleFiles(e.target.files));
uploadDrop.addEventListener("dragover", e => { e.preventDefault(); uploadDrop.style.borderColor = "#111"; });
uploadDrop.addEventListener("dragleave", () => uploadDrop.style.borderColor = "#ccc");
uploadDrop.addEventListener("drop", e => { e.preventDefault(); uploadDrop.style.borderColor = "#ccc"; handleFiles(e.dataTransfer.files); });

async function handleFiles(files) {
  const list = [...files];
  for (let idx = 0; idx < list.length; idx++) {
    uploadDrop.textContent = `Otpremanje ${idx + 1}/${list.length}...`;
    const url = await uploadToCloudinary(list[idx]);
    if (url) { pendingImages.push(url); renderImgThumbs(); }
  }
  uploadDrop.textContent = "Klikni ili prevuci slike ovde (šalje se na Cloudinary)";
  fileInput.value = "";
}

async function uploadToCloudinary(file) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (data.secure_url) return data.secure_url;
    console.error("Cloudinary error", data);
    showToast("Greška pri upload-u slike. Proveri CLOUD_NAME u firebase-init.js.", "error");
    return null;
  } catch (err) {
    console.error(err);
    showToast("Greška pri upload-u slike.", "error");
    return null;
  }
}

function renderImgThumbs() {
  const host = document.getElementById("imgThumbs");
  host.innerHTML = pendingImages.map((url, i) => {
    const boja = pendingImageColors[url] || "";
    const included = pendingCardImages === null || pendingCardImages.includes(url);
    return `
    <div class="img-thumb" draggable="true" data-i="${i}">
      <img src="${url}" draggable="false" style="${included ? '' : 'opacity:.35;'}">
      <button class="rm" data-i="${i}">✕</button>
      <button class="design-flag ${url === pendingDesignUrl ? "active" : ""}" data-design="${i}" title="Postavi kao dizajn sliku">★</button>
      <button class="color-flag" data-color="${i}" title="Boja slike: klikni da promeniš (ništa/crna/bela)">${boja === "crna" ? "⚫" : boja === "bela" ? "⚪" : "—"}</button>
      <button class="card-flag ${included ? "active" : ""}" data-card="${i}" title="Uključi/isključi iz rotacije na kartici">🔄</button>
    </div>
  `;
  }).join("");
  host.querySelectorAll(".rm").forEach(btn => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const removedUrl = pendingImages[Number(btn.dataset.i)];
    if (removedUrl === pendingDesignUrl) pendingDesignUrl = null;
    delete pendingImageColors[removedUrl];
    if (pendingCardImages) pendingCardImages = pendingCardImages.filter(u => u !== removedUrl);
    pendingImages.splice(Number(btn.dataset.i), 1); renderImgThumbs();
  }));
  host.querySelectorAll(".design-flag").forEach(btn => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const url = pendingImages[Number(btn.dataset.design)];
    pendingDesignUrl = pendingDesignUrl === url ? null : url;
    renderImgThumbs();
  }));
  host.querySelectorAll(".color-flag").forEach(btn => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const url = pendingImages[Number(btn.dataset.color)];
    const current = pendingImageColors[url] || "";
    const next = current === "" ? "crna" : current === "crna" ? "bela" : "";
    if (next === "") delete pendingImageColors[url]; else pendingImageColors[url] = next;
    renderImgThumbs();
  }));
  host.querySelectorAll(".card-flag").forEach(btn => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const url = pendingImages[Number(btn.dataset.card)];
    if (pendingCardImages === null) pendingCardImages = [...pendingImages];
    if (pendingCardImages.includes(url)) pendingCardImages = pendingCardImages.filter(u => u !== url);
    else pendingCardImages.push(url);
    renderImgThumbs();
  }));
  wireThumbDragReorder(host);
}

function wireThumbDragReorder(host) {
  let dragSrcIndex = null;
  host.querySelectorAll(".img-thumb").forEach(el => {
    el.addEventListener("dragstart", () => {
      dragSrcIndex = Number(el.dataset.i);
      el.style.opacity = "0.4";
    });
    el.addEventListener("dragend", () => { el.style.opacity = "1"; });
    el.addEventListener("dragover", (e) => e.preventDefault());
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      const targetIndex = Number(el.dataset.i);
      if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;
      const moved = pendingImages.splice(dragSrcIndex, 1)[0];
      pendingImages.splice(targetIndex, 0, moved);
      dragSrcIndex = null;
      renderImgThumbs();
    });
  });
}

function getSelectedChips(containerId) {
  return [...document.querySelectorAll(`#${containerId} .chip.selected`)].map(c => c.dataset.val);
}

document.getElementById("saveProductBtn").addEventListener("click", async () => {
  const naziv = document.getElementById("pf_naziv").value.trim();
  const cena = Number(document.getElementById("pf_cena").value);
  const kolekcija = document.getElementById("pf_kolekcija").value;
  const opis = document.getElementById("pf_opis").value.trim();
  if (!naziv || !cena || !kolekcija) { showToast("Popuni naziv, cenu i kolekciju.", "error"); return; }
  const payload = {
    naziv, cena, kolekcija, opis,
    boje: getSelectedChips("pf_boje"),
    polovi: getSelectedChips("pf_pol"),
    velicine: getSelectedChips("pf_velicine"),
    bestseler: document.getElementById("pf_bestseler").checked,
    novo: document.getElementById("pf_novo").checked,
    popularno: document.getElementById("pf_popularno").checked,
    akcija: Math.min(50, Math.max(0, Number(document.getElementById("pf_akcija").value) || 0)) || null,
    slike: pendingImages,
    dizajnSlika: pendingDesignUrl || null,
    slikeBoje: pendingImages.some(url => pendingImageColors[url]) ? pendingImages.map(url => pendingImageColors[url] || null) : null,
    karticaSlike: pendingCardImages,
    ocena: document.getElementById("pf_ocena").value ? Math.max(4.6, Math.min(5, Number(document.getElementById("pf_ocena").value))) : null,
    datumDodavanja: Date.now()
  };
  if (editingId) {
    await update(ref(db, "proizvodi/" + editingId), payload);
    showToast("Model izmenjen.");
  } else {
    await push(ref(db, "proizvodi"), payload);
    showToast("Model dodat.");
  }
  resetProductForm();
});

document.getElementById("cancelEditBtn").addEventListener("click", resetProductForm);

function resetProductForm() {
  editingId = null;
  pendingImages = [];
  pendingDesignUrl = null;
  pendingImageColors = {};
  pendingCardImages = null;
  document.getElementById("formTitle").textContent = "Dodaj model";
  document.getElementById("pf_naziv").value = "";
  document.getElementById("pf_cena").value = "";
  document.getElementById("pf_opis").value = "";
  document.getElementById("pf_bestseler").checked = false;
  document.getElementById("pf_novo").checked = false;
  document.getElementById("pf_popularno").checked = false;
  document.getElementById("pf_akcija").value = "";
  document.getElementById("pf_ocena").value = "";
  document.querySelectorAll("#pf_boje .chip, #pf_pol .chip, #pf_velicine .chip").forEach(c => c.classList.add("selected"));
  renderImgThumbs();
  document.getElementById("cancelEditBtn").style.display = "none";
}

function renderProductsTable() {
  const host = document.getElementById("productsTable");
  host.innerHTML = Object.entries(PRODUCTS).map(([id, p]) => `
    <tr class="${p.akcija ? 'row-akcija' : ''}">
      <td><img src="${(p.slike && p.slike[0]) || ''}" style="width:40px;height:50px;object-fit:cover;border-radius:3px;background:#eee;"></td>
      <td>${p.naziv}</td>
      <td>${p.kolekcija || ''}</td>
      <td>${p.akcija ? `<span style="text-decoration:line-through;color:#999;">${money(p.cena)}</span> <strong style="color:#8a1f1f;">${money(Math.round(p.cena * (1 - p.akcija/100)))}</strong> <span class="badge-small" style="background:#8a1f1f;color:#fff;">−${p.akcija}%</span>` : money(p.cena)}</td>
      <td class="row-actions">
        <button class="btn secondary" data-edit="${id}">Izmeni</button>
        <button class="btn danger" data-del="${id}">Obriši</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="5" style="color:#999;">Nema modela još.</td></tr>`;

  host.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => editProduct(btn.dataset.edit)));
  host.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", () => {
    showConfirmModal("Obriši ovaj model?", () => remove(ref(db, "proizvodi/" + btn.dataset.del)).then(() => showToast("Model obrisan.")));
  }));
}

function editProduct(id) {
  const p = PRODUCTS[id];
  if (!p) return;
  editingId = id;
  pendingImages = Array.isArray(p.slike) ? [...p.slike] : [];
  pendingDesignUrl = p.dizajnSlika || null;
  pendingImageColors = {};
  if (Array.isArray(p.slikeBoje) && Array.isArray(p.slike)) {
    p.slike.forEach((url, i) => { if (p.slikeBoje[i]) pendingImageColors[url] = p.slikeBoje[i]; });
  }
  pendingCardImages = p.karticaSlike ? [...p.karticaSlike] : null;
  document.getElementById("formTitle").textContent = "Izmeni model";
  document.getElementById("pf_naziv").value = p.naziv || "";
  document.getElementById("pf_cena").value = p.cena || "";
  document.getElementById("pf_kolekcija").value = p.kolekcija || "";
  document.getElementById("pf_opis").value = p.opis || "";
  document.getElementById("pf_bestseler").checked = !!p.bestseler;
  document.getElementById("pf_novo").checked = !!p.novo;
  document.getElementById("pf_popularno").checked = !!p.popularno;
  document.getElementById("pf_akcija").value = p.akcija || "";
  document.getElementById("pf_ocena").value = p.ocena || "";
  const setChips = (containerId, vals) => {
    document.querySelectorAll(`#${containerId} .chip`).forEach(c => c.classList.toggle("selected", (vals || []).includes(c.dataset.val)));
  };
  setChips("pf_boje", p.boje); setChips("pf_pol", p.polovi); setChips("pf_velicine", p.velicine);
  renderImgThumbs();
  document.getElementById("cancelEditBtn").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ============================================================
   KOLEKCIJE
   ============================================================ */
document.getElementById("addColBtn").addEventListener("click", async () => {
  const naziv = document.getElementById("colName").value.trim();
  const opis = document.getElementById("colOpis").value.trim();
  if (!naziv) return;
  await push(ref(db, "kolekcije"), { naziv, opis });
  document.getElementById("colName").value = "";
  document.getElementById("colOpis").value = "";
  showToast("Kolekcija dodata.");
});

function renderCollectionsTable() {
  const host = document.getElementById("colTable");
  host.innerHTML = Object.entries(COLLECTIONS).map(([id, c]) => {
    const naziv = c.naziv || c;
    const count = Object.values(PRODUCTS).filter(p => p.kolekcija === naziv).length;
    return `<tr><td>${naziv}</td><td>${count}</td><td><button class="btn danger" data-delcol="${id}">Obriši</button></td></tr>`;
  }).join("") || `<tr><td colspan="3" style="color:#999;">Nema kolekcija još.</td></tr>`;
  host.querySelectorAll("[data-delcol]").forEach(btn => btn.addEventListener("click", () => {
    showConfirmModal("Obriši ovu kolekciju? (Modeli ostaju, samo se uklanja iz menija)", () => remove(ref(db, "kolekcije/" + btn.dataset.delcol)).then(() => showToast("Kolekcija obrisana.")));
  }));
}

/* ============================================================
   PROMO
   ============================================================ */
document.getElementById("addPromoBtn").addEventListener("click", async () => {
  const tekst = document.getElementById("promoText").value.trim();
  if (!tekst) return;
  await push(ref(db, "promo"), { tekst });
  document.getElementById("promoText").value = "";
  showToast("Promo poruka dodata.");
});

function renderPromoTable() {
  const host = document.getElementById("promoTable");
  host.innerHTML = Object.entries(PROMO).map(([id, p]) => `
    <tr><td>${typeof p === "string" ? p : p.tekst}</td><td><button class="btn danger" data-delpromo="${id}">Obriši</button></td></tr>
  `).join("") || `<tr><td colspan="2" style="color:#999;">Nema promo poruka još.</td></tr>`;
  host.querySelectorAll("[data-delpromo]").forEach(btn => btn.addEventListener("click", () => {
    remove(ref(db, "promo/" + btn.dataset.delpromo)).then(() => showToast("Poruka obrisana."));
  }));
}

/* ============================================================
   PORUDŽBINE
   ============================================================ */
function ordersSorted() {
  return Object.entries(ORDERS).sort((a, b) => (b[1].datum || 0) - (a[1].datum || 0));
}
function renderRecentOrders() {
  const host = document.getElementById("recentOrders");
  host.innerHTML = ordersSorted().slice(0, 5).map(([id, o]) => `
    <tr><td>${o.sifra || '—'}</td><td>${o.ime || ''}</td><td>${money(o.ukupno)}</td><td>${new Date(o.datum).toLocaleString("sr-RS")}</td><td><span class="badge-small">${o.status || 'nova'}</span></td></tr>
  `).join("") || `<tr><td colspan="5" style="color:#999;">Nema porudžbina još.</td></tr>`;
}
function renderOrdersTable() {
  const host = document.getElementById("ordersTable");
  const statusClass = s => s === "nova" ? "row-nova" : s === "u obradi" ? "row-obradi" : s === "poslato" ? "row-poslato" : "";
  host.innerHTML = ordersSorted().map(([id, o]) => `
    <tr class="${statusClass(o.status || 'nova')}">
      <td style="font-weight:600;">${o.sifra || '—'}</td>
      <td>${o.ime || ''}<br><span style="color:#999;">${o.adresa || ''}, ${o.grad || ''}</span></td>
      <td>${o.telefon || ''}<br>${o.email || ''}</td>
      <td>${(o.stavke || []).map(s => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <img src="${s.slika || ''}" style="width:32px;height:40px;object-fit:cover;border-radius:3px;background:#eee;">
          <span>${s.naziv} ×${s.kolicina}${s.pol ? ` — ${s.pol}` : ''}${s.velicina ? `, ${s.velicina}` : ''}${s.boja ? `, ${s.boja}` : ''}</span>
        </div>
      `).join("")}</td>
      <td>${money(o.ukupno)}</td>
      <td>${o.popustKod ? `<span style="color:#1a7a3c;font-weight:600;">${o.popustKod}</span>` : '—'}</td>
      <td>${new Date(o.datum).toLocaleString("sr-RS")}</td>
      <td>
        <select data-status="${id}">
          <option value="nova" ${o.status === "nova" ? "selected" : ""}>Nova</option>
          <option value="u obradi" ${o.status === "u obradi" ? "selected" : ""}>U obradi</option>
          <option value="poslato" ${o.status === "poslato" ? "selected" : ""}>Poslato</option>
        </select>
      </td>
      <td><button class="btn danger" data-delorder="${id}">Obriši</button></td>
    </tr>
  `).join("") || `<tr><td colspan="9" style="color:#999;">Nema porudžbina još.</td></tr>`;
  host.querySelectorAll("[data-status]").forEach(sel => sel.addEventListener("change", () => {
    update(ref(db, "porudzbine/" + sel.dataset.status), { status: sel.value });
  }));
  host.querySelectorAll("[data-delorder]").forEach(btn => btn.addEventListener("click", () => {
    showConfirmModal("Obriši ovu porudžbinu?", () => remove(ref(db, "porudzbine/" + btn.dataset.delorder)).then(() => showToast("Porudžbina obrisana.")));
  }));
}

/* ============================================================
   HERO TRAKA (početna strana) — biramo proizvode sa ★ dizajn slikom
   ============================================================ */
let heroProductIds = []; // ordered array of selected product IDs, synced to db "heroSlike"

function saveHeroSelection() {
  return set(ref(db, "heroSlike"), heroProductIds);
}

function renderHeroPicker() {
  const host = document.getElementById("heroProductPicker");
  if (!host) return;
  const eligible = Object.entries(PRODUCTS).filter(([id, p]) => p.dizajnSlika);
  if (!eligible.length) {
    host.innerHTML = `<p style="color:#999;font-size:12.5px;">Nijedan model još nema označenu ★ dizajn sliku. Idi u tab "Modeli" i klikni ★ na jednoj od slika modela.</p>`;
    return;
  }
  // keep only still-eligible ids in the ordered selection, append newly-eligible unselected ones aren't auto-added
  heroProductIds = heroProductIds.filter(id => eligible.some(([eid]) => eid === id));
  const selected = heroProductIds.map(id => eligible.find(([eid]) => eid === id)).filter(Boolean);
  const unselected = eligible.filter(([id]) => !heroProductIds.includes(id));

  host.innerHTML = `
    ${selected.length ? `<p style="font-size:11.5px;color:#888;margin-bottom:8px;">Izabrano (prevuci da promeniš redosled):</p>` : ""}
    <div id="heroSelectedList">
      ${selected.map(([id, p]) => heroPickerRow(id, p, true)).join("")}
    </div>
    ${unselected.length ? `<p style="font-size:11.5px;color:#888;margin:14px 0 8px;">Dostupno za dodavanje:</p>` : ""}
    <div id="heroAvailableList">
      ${unselected.map(([id, p]) => heroPickerRow(id, p, false)).join("")}
    </div>
  `;
  host.querySelectorAll("[data-hero-toggle]").forEach(btn => btn.addEventListener("click", () => {
    const id = btn.dataset.heroToggle;
    if (heroProductIds.includes(id)) heroProductIds = heroProductIds.filter(x => x !== id);
    else heroProductIds.push(id);
    saveHeroSelection();
  }));
  wireHeroDragReorder(document.getElementById("heroSelectedList"));
}

function heroPickerRow(id, p, isSelected) {
  return `
    <div class="bs-order-item" draggable="${isSelected}" data-id="${id}">
      ${isSelected ? '<span class="bs-drag-handle">⠿</span>' : ''}
      <img src="${p.dizajnSlika}">
      <span class="bs-name" style="flex:1;">${p.naziv}</span>
      <button class="btn ${isSelected ? 'danger' : 'secondary'}" data-hero-toggle="${id}" style="margin-left:auto;">${isSelected ? "Ukloni" : "Dodaj"}</button>
    </div>
  `;
}

function wireHeroDragReorder(host) {
  if (!host) return;
  let dragSrcId = null;
  host.querySelectorAll(".bs-order-item").forEach(el => {
    el.addEventListener("dragstart", () => { dragSrcId = el.dataset.id; el.style.opacity = "0.4"; });
    el.addEventListener("dragend", () => { el.style.opacity = "1"; });
    el.addEventListener("dragover", e => e.preventDefault());
    el.addEventListener("drop", e => {
      e.preventDefault();
      const targetId = el.dataset.id;
      if (!dragSrcId || dragSrcId === targetId) return;
      const from = heroProductIds.indexOf(dragSrcId);
      const to = heroProductIds.indexOf(targetId);
      if (from === -1 || to === -1) return;
      heroProductIds.splice(from, 1);
      heroProductIds.splice(to, 0, dragSrcId);
      dragSrcId = null;
      saveHeroSelection();
    });
  });
}


/* ---------- TICKER TEXT (traka ispod hero sekcije) ---------- */
const tickerTextInput = document.getElementById("tickerTextInput");
const saveTickerBtn = document.getElementById("saveTickerBtn");
onValue(ref(db, "tickerTekst"), snap => {
  const val = snap.val();
  if (val && tickerTextInput && document.activeElement !== tickerTextInput) tickerTextInput.value = val;
});
saveTickerBtn?.addEventListener("click", () => {
  const val = tickerTextInput.value.trim();
  if (!val) return;
  set(ref(db, "tickerTekst"), val).then(() => showToast("Tekst trake sačuvan."));
});

/* ============================================================
   KODOVI ZA POPUST
   ============================================================ */
let CODES = {};
onValue(ref(db, "kodovi"), snap => { CODES = snap.val() || {}; renderCodesTable(); });

document.getElementById("addKodBtn").addEventListener("click", async () => {
  const kod = document.getElementById("kod_naziv").value.trim().toUpperCase();
  const tip = document.getElementById("kod_tip").value;
  const vrednost = Number(document.getElementById("kod_vrednost").value);
  const jednokratna = document.getElementById("kod_jednokratna").checked;
  const rokStr = document.getElementById("kod_rok").value;
  const rokIsteka = rokStr ? new Date(rokStr + "T23:59:59").getTime() : null;
  if (!kod || !vrednost) { showToast("Popuni kod i vrednost.", "error"); return; }
  await push(ref(db, "kodovi"), { kod, tip, vrednost, jednokratna, rokIsteka, iskorisceno: false });
  document.getElementById("kod_naziv").value = "";
  document.getElementById("kod_vrednost").value = "";
  document.getElementById("kod_rok").value = "";
  document.getElementById("kod_jednokratna").checked = false;
  showToast("Kod dodat.");
});

function renderCodesTable() {
  const host = document.getElementById("kodoviTable");
  host.innerHTML = Object.entries(CODES).map(([id, k]) => `
    <tr>
      <td style="font-weight:600;">${k.kod}</td>
      <td>${k.tip === "procenat" ? "Procenat" : "Fiksno"}</td>
      <td>${k.vrednost}${k.tip === "procenat" ? "%" : " RSD"}</td>
      <td>${k.jednokratna ? "Da" : "Ne"}</td>
      <td>${k.rokIsteka ? new Date(k.rokIsteka).toLocaleDateString("sr-RS") : "—"}</td>
      <td>${k.iskorisceno ? "Da" : "Ne"}</td>
      <td><button class="btn danger" data-delkod="${id}">Obriši</button></td>
    </tr>
  `).join("") || `<tr><td colspan="7" style="color:#999;">Nema kodova još.</td></tr>`;
  host.querySelectorAll("[data-delkod]").forEach(btn => btn.addEventListener("click", () => {
    remove(ref(db, "kodovi/" + btn.dataset.delkod)).then(() => showToast("Kod obrisan."));
  }));
}

/* ============================================================
   BESTSELLER REDOSLED
   ============================================================ */
let bestsellerOrder = [];
onValue(ref(db, "bestselerRedosled"), snap => {
  bestsellerOrder = snap.val() || [];
  renderBestsellerOrderList();
});

function getOrderedBestsellers() {
  const bestsellerIds = Object.entries(PRODUCTS).filter(([id, p]) => p.bestseler).map(([id]) => id);
  const ordered = bestsellerOrder.filter(id => bestsellerIds.includes(id));
  const missing = bestsellerIds.filter(id => !ordered.includes(id));
  return [...ordered, ...missing];
}

function renderBestsellerOrderList() {
  const host = document.getElementById("bestsellerOrderList");
  if (!host) return;
  const ids = getOrderedBestsellers();
  if (!ids.length) { host.innerHTML = `<p style="color:#999;font-size:12.5px;">Nema modela označenih kao Bestseler.</p>`; return; }
  host.innerHTML = ids.map(id => {
    const p = PRODUCTS[id];
    if (!p) return "";
    return `
      <div class="bs-order-item" draggable="true" data-id="${id}">
        <span class="bs-drag-handle">⠿</span>
        <img src="${(p.slike && p.slike[0]) || ''}">
        <span class="bs-name">${p.naziv}</span>
      </div>
    `;
  }).join("");
  wireBestsellerDrag(host);
}

function wireBestsellerDrag(host) {
  let dragSrcId = null;
  host.querySelectorAll(".bs-order-item").forEach(el => {
    el.addEventListener("dragstart", () => { dragSrcId = el.dataset.id; el.style.opacity = "0.4"; });
    el.addEventListener("dragend", () => { el.style.opacity = "1"; });
    el.addEventListener("dragover", e => e.preventDefault());
    el.addEventListener("drop", e => {
      e.preventDefault();
      const targetId = el.dataset.id;
      if (!dragSrcId || dragSrcId === targetId) return;
      let ids = getOrderedBestsellers();
      const from = ids.indexOf(dragSrcId);
      const to = ids.indexOf(targetId);
      ids.splice(from, 1);
      ids.splice(to, 0, dragSrcId);
      dragSrcId = null;
      set(ref(db, "bestselerRedosled"), ids);
    });
  });
}

/* ============================================================
   CUSTOM CONFIRM POPUP (zamena za native confirm())
   ============================================================ */
function showConfirmModal(message, onConfirm) {
  const scrim = document.getElementById("confirmScrim");
  document.getElementById("confirmMessage").textContent = message;
  scrim.classList.add("show");
  const okBtn = document.getElementById("confirmOkBtn");
  const cancelBtn = document.getElementById("confirmCancelBtn");
  const cleanup = () => {
    scrim.classList.remove("show");
    okBtn.removeEventListener("click", onOk);
    cancelBtn.removeEventListener("click", onCancel);
  };
  const onOk = () => { cleanup(); onConfirm(); };
  const onCancel = () => { cleanup(); };
  okBtn.addEventListener("click", onOk);
  cancelBtn.addEventListener("click", onCancel);
}

/* ============================================================
   O NAMA — slike za oba reda
   ============================================================ */
let onamaGore = [];
let onamaDole = [];

onValue(ref(db, "onamaSlikeGore"), snap => {
  const d = snap.val();
  onamaGore = Array.isArray(d) ? d.filter(Boolean) : Object.values(d || {});
  renderOnamaThumbs("gore");
});
onValue(ref(db, "onamaSlikeDole"), snap => {
  const d = snap.val();
  onamaDole = Array.isArray(d) ? d.filter(Boolean) : Object.values(d || {});
  renderOnamaThumbs("dole");
});

function setupOnamaUploader(which) {
  const drop = document.getElementById(`onama${which === "gore" ? "Gore" : "Dole"}Drop`);
  const input = document.getElementById(`onama${which === "gore" ? "Gore" : "Dole"}Input`);
  drop.addEventListener("click", () => input.click());
  input.addEventListener("change", e => handleOnamaFiles(which, e.target.files));
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.style.borderColor = "#111"; });
  drop.addEventListener("dragleave", () => drop.style.borderColor = "#ccc");
  drop.addEventListener("drop", e => { e.preventDefault(); drop.style.borderColor = "#ccc"; handleOnamaFiles(which, e.dataTransfer.files); });
}
setupOnamaUploader("gore");
setupOnamaUploader("dole");

async function handleOnamaFiles(which, files) {
  const list = [...files];
  const drop = document.getElementById(`onama${which === "gore" ? "Gore" : "Dole"}Drop`);
  const arr = which === "gore" ? onamaGore : onamaDole;
  for (let idx = 0; idx < list.length; idx++) {
    drop.textContent = `Otpremanje ${idx + 1}/${list.length}...`;
    const url = await uploadToCloudinary(list[idx]);
    if (url) arr.push(url);
  }
  drop.textContent = "Klikni ili prevuci slike ovde";
  input_reset(which);
  await set(ref(db, which === "gore" ? "onamaSlikeGore" : "onamaSlikeDole"), arr);
  showToast("Slike sačuvane.");
}
function input_reset(which) {
  document.getElementById(`onama${which === "gore" ? "Gore" : "Dole"}Input`).value = "";
}

function renderOnamaThumbs(which) {
  const host = document.getElementById(`onama${which === "gore" ? "Gore" : "Dole"}Thumbs`);
  const arr = which === "gore" ? onamaGore : onamaDole;
  if (!host) return;
  host.innerHTML = arr.map((url, i) => `
    <div class="img-thumb" draggable="true" data-i="${i}">
      <img src="${url}" draggable="false">
      <button class="rm" data-i="${i}" data-which="${which}">✕</button>
    </div>
  `).join("") || `<p style="color:#999;font-size:12.5px;">Nema slika još.</p>`;
  host.querySelectorAll(".rm").forEach(btn => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const w = btn.dataset.which;
    const a = w === "gore" ? onamaGore : onamaDole;
    a.splice(Number(btn.dataset.i), 1);
    set(ref(db, w === "gore" ? "onamaSlikeGore" : "onamaSlikeDole"), a);
  }));
  wireOnamaDrag(host, which);
}

function wireOnamaDrag(host, which) {
  let dragSrcIndex = null;
  const arr = which === "gore" ? onamaGore : onamaDole;
  host.querySelectorAll(".img-thumb").forEach(el => {
    el.addEventListener("dragstart", () => { dragSrcIndex = Number(el.dataset.i); el.style.opacity = "0.4"; });
    el.addEventListener("dragend", () => { el.style.opacity = "1"; });
    el.addEventListener("dragover", e => e.preventDefault());
    el.addEventListener("drop", e => {
      e.preventDefault();
      const targetIndex = Number(el.dataset.i);
      if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;
      const moved = arr.splice(dragSrcIndex, 1)[0];
      arr.splice(targetIndex, 0, moved);
      dragSrcIndex = null;
      set(ref(db, which === "gore" ? "onamaSlikeGore" : "onamaSlikeDole"), arr);
    });
  });
}

/* ============================================================
   CENA DOSTAVE
   ============================================================ */
onValue(ref(db, "cenaDostave"), snap => {
  const v = snap.val();
  const input = document.getElementById("dostavaCenaInput");
  if (input && document.activeElement !== input) input.value = v !== null && v !== undefined ? v : 600;
});
document.getElementById("saveDostavaBtn").addEventListener("click", () => {
  const val = Number(document.getElementById("dostavaCenaInput").value);
  if (isNaN(val) || val < 0) { showToast("Unesi ispravnu cenu.", "error"); return; }
  set(ref(db, "cenaDostave"), val).then(() => showToast("Cena dostave sačuvana."));
});
