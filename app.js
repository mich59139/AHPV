// AHPV — Catalogue des articles
// Version simplifiée et cohérente pour index.html v1.17
// Chargement CSV, filtres, tri, pagination, édition inline,
// ajout d'article, listes (auteurs/villes/thèmes/époques),
// sauvegarde sur GitHub via token personnel.
// v1.17 : Ajout du filtre par thème

// -----------------------------
// Configuration
// -----------------------------

const GITHUB_USER   = "mich59139";
const GITHUB_REPO   = "AHPV";
const GITHUB_BRANCH = "main";

const CSV_PATH      = "data/articles.csv";
const AUTHORS_PATH  = "data/auteurs.csv";
const CITIES_PATH   = "data/villes.csv";
const THEMES_PATH   = "data/themes.csv";
const EPOQUES_PATH  = "data/epoques.csv";    // peut ne pas exister

// -----------------------------
// État global
// -----------------------------

let ARTICLES = [];                // [{Année, Numéro, Titre, Page(s), Auteur(s), Ville(s), Theme(s), Epoque}, ...]
let LISTS = { auteurs: [], villes: [], themes: [], epoques: [] };

let FILTER_YEAR   = "";
let FILTER_NUMERO = "";
let FILTER_EPOQUE = "";
let FILTER_THEME  = "";
let QUERY         = "";

let sortCol = null;
let sortDir = "asc";

let currentPage = 1;
let pageSize    = 50;

let editingIndex = -1;

let GHTOKEN = null;

let pendingDeleteIndex = -1;

// -----------------------------
// Utilitaires
// -----------------------------

function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function uniqSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "fr", { sensitivity: "base" })
  );
}

function fetchText(url) {
  const bust = (url.includes("?") ? "&" : "?") + "_ts=" + Date.now();
  return fetch(url + bust).then(res => {
    if (!res.ok) throw new Error("HTTP " + res.status + " sur " + url);
    return res.text();
  });
}

// CSV très simple (avec guillemets et virgules gérés)
function parseCSV(text) {
  text = (text || "").replace(/^\uFEFF/, "");
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (!lines.length) return [];

  const headers = splitCSVLine(lines[0], ",").map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = splitCSVLine(lines[i], ",");
    const row  = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] || "";
    });
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line, sep) {
  const out = [];
  let cur   = "";
  let inQ   = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQ = true;
      } else if (c === sep) {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
}

function parseOneColCSV(text) {
  text = (text || "").replace(/^\uFEFF/, "");
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const head = lines[0].toLowerCase();
  const content = /auteur|ville|th[eè]me|epoqu/.test(head)
    ? lines.slice(1)
    : lines;

  return uniqSorted(content);
}

function toCSV(rows) {
  const COLS = [
    "Année",
    "Numéro",
    "Titre",
    "Page(s)",
    "Auteur(s)",
    "Ville(s)",
    "Theme(s)",
    "Epoque"
  ];

  const esc = s => {
    s = s == null ? "" : String(s);
    s = s.replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };

  const head = COLS.join(",");
  const body = rows
    .map(r => COLS.map(c => esc(r[c] || "")).join(","))
    .join("\n");

  return head + "\n" + body + "\n";
}

function toTSV(rows) {
  const COLS = [
    "Année",
    "Numéro",
    "Titre",
    "Page(s)",
    "Auteur(s)",
    "Ville(s)",
    "Theme(s)",
    "Epoque"
  ];
  const head = COLS.join("\t");
  const body = rows
    .map(r => COLS.map(c => r[c] || "").join("\t"))
    .join("\n");
  return head + "\n" + body + "\n";
}

function normalizeNumeroInput(v) {
  v = (v || "").trim();
  if (!v) return "";
  // Uniformiser "mémoire"
  v = v.replace(/^\s*m[ée]moire\s*/i, "Mémoire ");
  return v;
}

// -----------------------------
// Toasts & badges
// -----------------------------

function showToast(msg, type = "info") {
  const cont = document.getElementById("toast-container");
  if (!cont) {
    alert(msg);
    return;
  }
  const div = document.createElement("div");
  div.className = "toast toast-" + type;
  div.textContent = msg;
  cont.appendChild(div);
  setTimeout(() => {
    div.style.opacity = "0";
    setTimeout(() => div.remove(), 400);
  }, 3000);
}

function setSaveState(state) {
  const saveBadge    = document.getElementById("status-save");
  const unsavedBadge = document.getElementById("status-unsaved");
  if (!saveBadge || !unsavedBadge) return;

  if (state === "saved") {
    saveBadge.classList.remove("hidden");
    unsavedBadge.classList.add("hidden");
  } else if (state === "unsaved") {
    saveBadge.classList.add("hidden");
    unsavedBadge.classList.remove("hidden");
  } else {
    saveBadge.classList.add("hidden");
    unsavedBadge.classList.add("hidden");
  }
}

// -----------------------------
// Auth GitHub
// -----------------------------

function getStoredToken() {
  try {
    return localStorage.getItem("ahpv_token") || null;
  } catch {
    return null;
  }
}

function storeToken(token) {
  try {
    if (token) localStorage.setItem("ahpv_token", token);
    else localStorage.removeItem("ahpv_token");
  } catch {}
}

function updateAuthStatus() {
  const sa = document.getElementById("status-auth");
  if (sa) {
    sa.textContent = GHTOKEN ? "🔐 Connecté" : "🔓 Invité";
  }
}

async function githubRequest(path, opts = {}) {
  if (!GHTOKEN) throw new Error("Pas de token GitHub");
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/${path}`,
    {
      ...opts,
      headers: {
        "Authorization": "token " + GHTOKEN,
        "Accept": "application/vnd.github+json",
        ...(opts.headers || {})
      }
    }
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "?");
    throw new Error("GitHub " + res.status + " : " + txt);
  }
  return res.json();
}

async function saveArticlesToGitHub() {
  if (!GHTOKEN) {
    showToast("Aucun token GitHub : enregistrement local uniquement.", "error");
    return;
  }

  setSaveState("unsaved");

  // 1) Récupérer le SHA du fichier existant (si présent)
  let sha = undefined;
  try {
    const meta = await githubRequest("contents/" + CSV_PATH + "?ref=" + GITHUB_BRANCH, {
      method: "GET"
    });
    sha = meta.sha;
  } catch (err) {
    console.warn("Impossible de lire le fichier articles.csv sur GitHub (création ?)", err);
  }

  // 2) Construire le CSV et l'encoder en base64
  const csv = toCSV(ARTICLES);
  const content = btoa(unescape(encodeURIComponent(csv)));

  const body = {
    message: "Mise à jour du catalogue des articles",
    content,
    branch: GITHUB_BRANCH
  };
  if (sha) body.sha = sha;

  await githubRequest("contents/" + CSV_PATH, {
    method: "PUT",
    body: JSON.stringify(body)
  });

  setSaveState("saved");
  showToast("Catalogue sauvegardé sur GitHub.", "success");
}

// -----------------------------
// Chargement des données
// -----------------------------

async function fetchCSVArticles() {
  try {
    console.log("📋 Chargement des données...");
    const txt  = await fetchText(CSV_PATH);
    const rows = parseCSV(txt);
    ARTICLES   = rows || [];
    console.log(`✅ ${ARTICLES.length} articles chargés`);
  } catch (err) {
    console.error("Erreur chargement articles.csv", err);
    ARTICLES = [];
    showToast("Impossible de charger articles.csv", "error");
  }
}

async function fetchList(path, kind) {
  try {
    const txt  = await fetchText(path);
    const list = parseOneColCSV(txt);
    LISTS[kind] = list;
    console.log(`✅ ${list.length} ${kind} chargés`);
  } catch (err) {
    console.warn(`Liste ${kind} introuvable ou erreur (non bloquant)`, err);
    LISTS[kind] = [];
  }
}

async function loadLists() {
  console.log("📝 Chargement des listes (auteurs/villes/thèmes/époques)...");
  await Promise.all([
    fetchList(AUTHORS_PATH, "auteurs"),
    fetchList(CITIES_PATH,  "villes"),
    fetchList(THEMES_PATH,  "themes"),
    fetchList(EPOQUES_PATH, "epoques").catch(err => {
      console.warn("Pas d'epoques.csv (on dérivera depuis les articles)", err);
      LISTS.epoques = [];
    })
  ]);
}

// -----------------------------
// Filtres, tri, pagination
// -----------------------------

function applyFilters() {
  let rows = ARTICLES.map((r, idx) => ({ ...r, _idx: idx }));

  if (FILTER_YEAR) {
    rows = rows.filter(r => (r["Année"] || "") === FILTER_YEAR);
  }
  if (FILTER_NUMERO) {
    rows = rows.filter(
      r => (String(r["Numéro"] || "").trim() === String(FILTER_NUMERO).trim())
    );
  }
  if (FILTER_EPOQUE) {
    rows = rows.filter(r => (r["Epoque"] || "") === FILTER_EPOQUE);
  }
  if (FILTER_THEME) {
    rows = rows.filter(r => {
      const themes = (r["Theme(s)"] || "").split(/[,;]/).map(t => t.trim().toLowerCase());
      return themes.some(t => t.includes(FILTER_THEME.toLowerCase()));
    });
  }
  if (QUERY) {
    const q = QUERY.toLowerCase();
    rows = rows.filter(r =>
      Object.values(r).some(v =>
        (v || "").toString().toLowerCase().includes(q)
      )
    );
  }

  if (sortCol) {
    const factor = sortDir === "asc" ? 1 : -1;
    console.log("🔀 Tri en cours sur:", sortCol, "direction:", sortDir);
    console.log("   Exemple valeur 1:", rows[0]?.[sortCol]);
    console.log("   Exemple valeur 2:", rows[1]?.[sortCol]);
    rows.sort((a, b) =>
      (a[sortCol] || "").toString().localeCompare(
        (b[sortCol] || "").toString(),
        "fr",
        { numeric: true, sensitivity: "base" }
      ) * factor
    );
    console.log("   Après tri, 1er:", rows[0]?.[sortCol]);
  }
  return rows;
}

function render() {
  const rows  = applyFilters();
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (currentPage > pages) currentPage = pages;
  if (currentPage < 1)     currentPage = 1;

  const start = (currentPage - 1) * pageSize;
  const page  = rows.slice(start, start + pageSize);

  const tbody = document.getElementById("tbody");
  if (!tbody) return;

  if (!page.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding:20px; font-style:italic;">
          Aucun article ne correspond aux filtres.
          (Catalogue complet : ${ARTICLES.length} article(s)).
        </td>
      </tr>`;
  } else {
    tbody.innerHTML = page.map(r => {
      const i = r._idx;
      if (editingIndex !== i) {
        return `
        <tr class="row" ondblclick="window._inlineEdit(${i})">
          <td data-label="Année"  class="col-annee">${r["Année"]||""}</td>
          <td data-label="Numéro" class="col-numero">${r["Numéro"]||""}</td>
          <td data-label="Titre"  class="col-titre">${r["Titre"]||""}</td>
          <td data-label="Page(s)">${r["Page(s)"]||""}</td>
          <td data-label="Auteur(s)">${r["Auteur(s)"]||""}</td>
          <td data-label="Ville(s)">${r["Ville(s)"]||""}</td>
          <td data-label="Thème(s)">${r["Theme(s)"]||""}</td>
          <td data-label="Période">${r["Epoque"]||""}</td>
          <td class="actions">
            <button class="edit" onclick="window._inlineEdit(${i})" aria-label="Modifier">✎</button>
            <button class="del"  onclick="window._askDelete(${i})" aria-label="Supprimer">🗑</button>
          </td>
        </tr>`;
      } else {
        return `
        <tr class="row editing">
          <td><input id="ei-annee"   value="${r["Année"]||""}" /></td>
          <td><input id="ei-numero"  value="${r["Numéro"]||""}" /></td>
          <td><input id="ei-titre"   value="${r["Titre"]||""}" /></td>
          <td><input id="ei-pages"   value="${r["Page(s)"]||""}" /></td>
          <td><input id="ei-auteurs" value="${r["Auteur(s)"]||""}" /></td>
          <td><input id="ei-villes"  value="${r["Ville(s)"]||""}" /></td>
          <td><input id="ei-themes"  value="${r["Theme(s)"]||""}" /></td>
          <td><input id="ei-epoque"  value="${r["Epoque"]||""}" /></td>
          <td class="actions">
            <button onclick="window._inlineSave()"   aria-label="Enregistrer">💾</button>
            <button onclick="window._inlineCancel()" aria-label="Annuler">✖</button>
          </td>
        </tr>`;
      }
    }).join("");
  }

  // visuel tri
  document.querySelectorAll("th[data-col]").forEach(th => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.col === sortCol) {
      th.classList.add(sortDir === "asc" ? "sort-asc" : "sort-desc");
    }
  });

  // infos de pagination
  const pageInfo = document.getElementById("pageinfo");
  if (pageInfo) {
    pageInfo.textContent = `${currentPage} / ${pages} — ${total} ligne(s)`;
  }

  // boutons pager
  const prevBtn  = document.getElementById("prev");
  const nextBtn  = document.getElementById("next");
  const firstBtn = document.getElementById("first");
  const lastBtn  = document.getElementById("last");

  if (prevBtn)  prevBtn.disabled  = currentPage <= 1;
  if (firstBtn) firstBtn.disabled = currentPage <= 1;
  if (nextBtn)  nextBtn.disabled  = currentPage >= pages;
  if (lastBtn)  lastBtn.disabled  = currentPage >= pages;

  // numéros de pages
  const pn = document.getElementById("page-numbers");
  if (pn) {
    pn.innerHTML = "";
    const maxButtons = 7;
    let startP = Math.max(1, currentPage - 3);
    let endP   = Math.min(pages, startP + maxButtons - 1);
    if (endP - startP + 1 < maxButtons) {
      startP = Math.max(1, endP - maxButtons + 1);
    }
    for (let p = startP; p <= endP; p++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn ghost page-num" + (p === currentPage ? " active" : "");
      b.textContent = String(p);
      b.addEventListener("click", () => {
        currentPage = p;
        render();
      });
      pn.appendChild(b);
    }
  }

  // total global
  const totalLabel = document.getElementById("total-count");
  if (totalLabel) {
    totalLabel.textContent = `Total : ${ARTICLES.length} article(s)`;
  }

  const sc = document.getElementById("status-count");
  if (sc) sc.textContent = `Fichier : ✅ (${ARTICLES.length})`;
  updateAuthStatus();
}

function bindFilters() {
  const fy = document.getElementById("filter-annee");
  const fn = document.getElementById("filter-numero");
  const fe = document.getElementById("filter-epoque");
  const ft = document.getElementById("filter-theme");
  const q  = document.getElementById("search");

  if (fy) {
    fy.addEventListener("change", () => {
      FILTER_YEAR = fy.value;
      refreshNumeroOptions();
      currentPage = 1;
      render();
    });
  }
  if (fn) {
    fn.addEventListener("change", () => {
      FILTER_NUMERO = fn.value;
      currentPage = 1;
      render();
    });
  }
  if (fe) {
    fe.addEventListener("change", () => {
      FILTER_EPOQUE = fe.value;
      currentPage = 1;
      render();
    });
  }
  if (ft) {
    ft.addEventListener("change", () => {
      FILTER_THEME = ft.value;
      currentPage = 1;
      render();
    });
  }
  if (q) {
    const updateQ = debounce(() => {
      QUERY = q.value.trim();
      currentPage = 1;
      render();
    }, 200);
    q.addEventListener("input", updateQ);
  }

  const resetBtn = document.getElementById("reset-filters");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      FILTER_YEAR = "";
      FILTER_NUMERO = "";
      FILTER_EPOQUE = "";
      FILTER_THEME = "";
      QUERY = "";
      if (fy) fy.value = "";
      if (fn) fn.value = "";
      if (fe) fe.value = "";
      if (ft) ft.value = "";
      if (q)  q.value  = "";
      currentPage = 1;
      refreshNumeroOptions();
      render();
    });
  }
}

function bindSorting() {
  document.querySelectorAll("th[data-col]").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      console.log("🔄 Tri demandé sur colonne:", col);
      
      // DEBUG: alerte temporaire
      // alert("Tri sur: " + col);
      
      if (sortCol === col) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortCol = col;
        sortDir = "asc";
      }
      console.log("📊 sortCol =", sortCol, "| sortDir =", sortDir);
      
      // DEBUG: afficher dans le titre de la page
      document.title = "Tri: " + sortCol + " " + sortDir;
      
      currentPage = 1;
      render();
    });
    th.addEventListener("keypress", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        th.click();
      }
    });
  });
}

function bindPager() {
  const prevBtn  = document.getElementById("prev");
  const nextBtn  = document.getElementById("next");
  const firstBtn = document.getElementById("first");
  const lastBtn  = document.getElementById("last");
  const sizeSel  = document.getElementById("page-size");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        render();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      currentPage++;
      render();
    });
  }
  if (firstBtn) {
    firstBtn.addEventListener("click", () => {
      currentPage = 1;
      render();
    });
  }
  if (lastBtn) {
    lastBtn.addEventListener("click", () => {
      const total = applyFilters().length;
      const pages = Math.max(1, Math.ceil(total / pageSize));
      currentPage = pages;
      render();
    });
  }
  if (sizeSel) {
    const initial = parseInt(sizeSel.value, 10);
    if (!isNaN(initial) && initial > 0) {
      pageSize = initial;
    } else {
      sizeSel.value = String(pageSize);
    }
    sizeSel.addEventListener("change", e => {
      const v = parseInt(e.target.value, 10);
      if (!isNaN(v) && v > 0) {
        pageSize = v;
        currentPage = 1;
        render();
      }
    });
  }
}

// -----------------------------
// Options filtres (Année/Numéro/Époque)
// -----------------------------

function refreshYearOptions() {
  const fy = document.getElementById("filter-annee");
  if (!fy) return;

  const years = uniqSorted(ARTICLES.map(r => r["Année"]).filter(Boolean));
  const cur   = fy.value;

  fy.innerHTML =
    '<option value="">(toutes)</option>' +
    years.map(y => `<option value="${y}">${y}</option>`).join("");

  if (years.includes(cur)) fy.value = cur;
  else fy.value = "";
}

function getNumbersForYear(year) {
  const set = new Set();
  ARTICLES.forEach(r => {
    if (!year || (r["Année"] || "") === year) {
      const n = String(r["Numéro"] || "").trim();
      if (n) set.add(n);
    }
  });
  return Array.from(set).sort((a, b) =>
    String(a).localeCompare(String(b), "fr", { numeric: true })
  );
}

function refreshNumeroOptions() {
  const fn = document.getElementById("filter-numero");
  if (!fn) return;
  const fy   = document.getElementById("filter-annee");
  const year = fy ? fy.value : "";
  const nums = getNumbersForYear(year);
  const cur  = fn.value;

  fn.innerHTML =
    '<option value="">(tous)</option>' +
    nums.map(n => `<option value="${n}">${n}</option>`).join("");

  if (nums.includes(cur)) fn.value = cur;
  else fn.value = "";
}

function refreshEpoqueOptions() {
  const fe = document.getElementById("filter-epoque");
  if (!fe) return;

  let src = [];
  if (LISTS.epoques && LISTS.epoques.length) {
    src = LISTS.epoques;
  } else {
    src = Array.from(
      new Set(ARTICLES.map(r => r["Epoque"]).filter(Boolean))
    );
  }

  const options =
    '<option value="">(toutes)</option>' +
    uniqSorted(src).map(e => `<option value="${e}">${e}</option>`).join("");

  fe.innerHTML = options;
}

function refreshThemeOptions() {
  const ft = document.getElementById("filter-theme");
  if (!ft) return;

  // Collecter tous les thèmes uniques DIRECTEMENT depuis les articles
  const themesSet = new Set();
  ARTICLES.forEach(r => {
    const themes = (r["Theme(s)"] || "").split(/[,;]/).map(t => t.trim()).filter(Boolean);
    themes.forEach(t => {
      if (t && t !== "-") themesSet.add(t);
    });
  });

  // Trier les thèmes
  const src = Array.from(themesSet).sort((a, b) => 
    a.localeCompare(b, "fr", { sensitivity: "base" })
  );

  const cur = ft.value;
  const options =
    '<option value="">(tous)</option>' +
    src.map(t => `<option value="${t}">${t}</option>`).join("");

  ft.innerHTML = options;

  if (src.includes(cur)) ft.value = cur;
  else ft.value = "";
}

// -----------------------------
// Inline edit
// -----------------------------

window._inlineEdit = function (idx) {
  editingIndex = idx;
  render();
};

window._inlineCancel = function () {
  editingIndex = -1;
  render();
};

window._inlineSave = async function () {
  if (editingIndex < 0) return;
  const i = editingIndex;
  const get = id => (document.getElementById(id)?.value || "").trim();

  ARTICLES[i]["Année"]    = get("ei-annee");
  ARTICLES[i]["Numéro"]   = get("ei-numero");
  ARTICLES[i]["Titre"]    = get("ei-titre");
  ARTICLES[i]["Page(s)"]  = get("ei-pages");
  ARTICLES[i]["Auteur(s)"]= get("ei-auteurs");
  ARTICLES[i]["Ville(s)"] = get("ei-villes");
  ARTICLES[i]["Theme(s)"] = get("ei-themes");
  ARTICLES[i]["Epoque"]   = get("ei-epoque");

  editingIndex = -1;
  render();
  try {
    await saveArticlesToGitHub();
  } catch (err) {
    console.error("Erreur sauvegarde inline", err);
    showToast("Erreur de sauvegarde sur GitHub", "error");
  }
};

// -----------------------------
// Suppression
// -----------------------------

window._askDelete = function (idx) {
  pendingDeleteIndex = idx;
  const row = ARTICLES[idx];
  const dlg = document.getElementById("confirm-modal");
  if (!dlg) {
    if (confirm("Supprimer cet article ?")) {
      window._confirmDelete();
    }
    return;
  }
  const t = document.getElementById("confirm-title");
  if (t) t.textContent = row["Titre"] || "(sans titre)";
  dlg.showModal();

  const cancelBtn = document.getElementById("confirm-cancel");
  const delBtn    = document.getElementById("confirm-delete");

  const onCancel = () => {
    dlg.close();
    cancelBtn.removeEventListener("click", onCancel);
    delBtn.removeEventListener("click", onDelete);
  };
  const onDelete = async e => {
    e.preventDefault();
    dlg.close();
    cancelBtn.removeEventListener("click", onCancel);
    delBtn.removeEventListener("click", onDelete);
    window._confirmDelete();
  };

  cancelBtn.addEventListener("click", onCancel);
  delBtn.addEventListener("click", onDelete);
};

window._confirmDelete = async function () {
  if (pendingDeleteIndex < 0) return;
  ARTICLES.splice(pendingDeleteIndex, 1);
  pendingDeleteIndex = -1;
  render();
  try {
    await saveArticlesToGitHub();
    showToast("Article supprimé et sauvegardé sur GitHub", "success");
  } catch (err) {
    console.error("Erreur sauvegarde suppression", err);
    showToast("Erreur de sauvegarde sur GitHub", "error");
  }
};

// -----------------------------
// Ajout d'article (modale)
// -----------------------------

function refreshAddNumeroOptions() {
  const anneeInput = document.getElementById("a-annee");
  const select     = document.getElementById("a-numero");
  const newInput   = document.getElementById("a-numero-new");
  if (!select) return;

  const year = (anneeInput?.value || "").trim();
  const nums = getNumbersForYear(year);

  select.innerHTML =
    '<option value="">(choisir)</option>' +
    nums.map(n => `<option value="${n}">${n}</option>`).join("") +
    '<option value="__NEW__">Nouveau numéro…</option>';

  if (newInput) {
    newInput.classList.add("hidden");
    newInput.value = "";
  }
}

function refreshDatalists() {
  const dlA = document.getElementById("dl-auteurs");
  const dlV = document.getElementById("dl-villes");
  const dlT = document.getElementById("dl-themes");
  const dlE = document.getElementById("dl-epoques");

  if (dlA) {
    dlA.innerHTML = LISTS.auteurs.map(v => `<option value="${v}"></option>`).join("");
  }
  if (dlV) {
    dlV.innerHTML = LISTS.villes.map(v => `<option value="${v}"></option>`).join("");
  }
  if (dlT) {
    dlT.innerHTML = LISTS.themes.map(v => `<option value="${v}"></option>`).join("");
  }
  if (dlE) {
    const src = LISTS.epoques && LISTS.epoques.length
      ? LISTS.epoques
      : Array.from(new Set(ARTICLES.map(r => r["Epoque"]).filter(Boolean)));
    dlE.innerHTML = uniqSorted(src).map(v => `<option value="${v}"></option>`).join("");
  }
}

window._openAddModal = function () {
  console.log("🟢 _openAddModal");
  const dlg = document.getElementById("add-modal");
  const form = document.getElementById("add-form");

  if (dlg && typeof dlg.showModal === "function") {
    if (form) form.reset();
    refreshAddNumeroOptions();
    refreshDatalists();
    dlg.showModal();
    const y = document.getElementById("a-annee");
    if (y) y.focus();
  } else {
    // Fallback : ajout inline en dernière ligne
    const now = new Date().getFullYear().toString();
    const newRow = {
      "Année": now,
      "Numéro": "",
      "Titre": "",
      "Page(s)": "",
      "Auteur(s)": "",
      "Ville(s)": "",
      "Theme(s)": "",
      "Epoque": ""
    };
    ARTICLES.push(newRow);
    editingIndex = ARTICLES.length - 1;
    currentPage = Math.ceil(ARTICLES.length / pageSize);
    render();
  }
};

function bindAddModal() {
  const addBtn    = document.getElementById("add-article-btn");
  const addForm   = document.getElementById("add-form");
  const addCancel = document.getElementById("add-cancel");

  if (addBtn) {
    addBtn.addEventListener("click", () => window._openAddModal());
  }
  if (addCancel) {
    addCancel.addEventListener("click", () =>
      document.getElementById("add-modal")?.close()
    );
  }

  const anneeInput = document.getElementById("a-annee");
  if (anneeInput) {
    anneeInput.addEventListener("input",  refreshAddNumeroOptions);
    anneeInput.addEventListener("change", refreshAddNumeroOptions);
  }

  const numeroSelect = document.getElementById("a-numero");
  if (numeroSelect) {
    numeroSelect.addEventListener("change", () => {
      const sel = document.getElementById("a-numero");
      const ni  = document.getElementById("a-numero-new");
      if (!sel || !ni) return;
      if (sel.value === "__NEW__") {
        ni.classList.remove("hidden");
        ni.focus();
      } else {
        ni.classList.add("hidden");
        ni.value = "";
      }
    });
  }

  if (addForm) {
    addForm.addEventListener("submit", async e => {
      e.preventDefault();

      const anneeEl = document.getElementById("a-annee");
      const numSel  = document.getElementById("a-numero");
      const numNew  = document.getElementById("a-numero-new");
      const titreEl = document.getElementById("a-titre");

      const annee  = (anneeEl?.value || "").trim();
      let   numVal = "";
      if (numSel) {
        if (numSel.value === "__NEW__") {
          numVal = normalizeNumeroInput(numNew?.value || "");
        } else {
          numVal = normalizeNumeroInput(numSel.value || "");
        }
      }
      const titre = (titreEl?.value || "").trim();

      if (!annee || !numVal || !titre) {
        alert("Année, Numéro et Titre sont obligatoires.");
        return;
      }

      const row = {
        "Année":   annee,
        "Numéro":  numVal,
        "Titre":   titre,
        "Page(s)": (document.getElementById("a-pages")?.value || "").trim(),
        "Auteur(s)": (document.getElementById("a-auteurs")?.value || "").trim(),
        "Ville(s)" : (document.getElementById("a-villes")?.value || "").trim(),
        "Theme(s)" : (document.getElementById("a-themes")?.value || "").trim(),
        "Epoque"   : (document.getElementById("a-epoque")?.value || "").trim()
      };

      const dupExact = ARTICLES.find(a =>
        a["Année"] === row["Année"] &&
        a["Numéro"] === row["Numéro"] &&
        (a["Titre"] || "").toLowerCase().trim() === row["Titre"].toLowerCase().trim()
      );
      if (dupExact) {
        const ok = confirm(
          "Un article avec la même Année + Numéro + Titre existe déjà.\n" +
          "Voulez-vous quand même ajouter celui-ci ?"
        );
        if (!ok) return;
      }

      ARTICLES.push(row);
      document.getElementById("add-modal")?.close();

      refreshYearOptions();
      refreshNumeroOptions();
      refreshEpoqueOptions();
      refreshDatalists();

      currentPage = Math.ceil(ARTICLES.length / pageSize);
      render();

      try {
        await saveArticlesToGitHub();
        showToast("Nouvel article ajouté et sauvegardé sur GitHub", "success");
      } catch (err) {
        console.error("Erreur sauvegarde nouvel article", err);
        showToast("Erreur de sauvegarde sur GitHub", "error");
      }
    });
  }
}

// -----------------------------
// Listes (mini-éditeur) — version simple, sans sauvegarde GitHub
// -----------------------------

function bindListsEditor() {
  const dlg   = document.getElementById("lists-modal");
  const btn   = document.getElementById("lists-btn");
  if (!dlg || !btn) return;

  const tabs      = Array.from(dlg.querySelectorAll(".tab"));
  const countSpan = document.getElementById("list-count");
  const input     = document.getElementById("list-input");
  const addBtn    = document.getElementById("list-add");
  const sortBtn   = document.getElementById("list-sort");
  const dedupeBtn = document.getElementById("list-dedupe");
  const importBtn = document.getElementById("list-import");
  const exportBtn = document.getElementById("list-export");
  const fileInp   = document.getElementById("list-file");
  const itemsUL   = document.getElementById("list-items");
  const saveBtn   = document.getElementById("list-save");
  const closeBtn  = document.getElementById("list-close");

  let currentKind = "auteurs";
  let WORK = [];

  function refreshListUI() {
    itemsUL.innerHTML = WORK
      .map(
        (v, i) =>
          `<li data-i="${i}"><span>${v}</span><button class="edit" data-i="${i}">✎</button><button class="del" data-i="${i}">🗑</button></li>`
      )
      .join("");
    if (countSpan) countSpan.textContent = `${WORK.length} élément(s)`;
  }

  function setKind(kind) {
    currentKind = kind;
    tabs.forEach(t => t.classList.toggle("active", t.dataset.kind === kind));
    WORK = [...(LISTS[kind] || [])];
    refreshListUI();
  }

  btn.addEventListener("click", () => {
    setKind("auteurs");
    refreshListUI();
    dlg.showModal();
  });

  closeBtn.addEventListener("click", () => dlg.close());

  tabs.forEach(t => {
    t.addEventListener("click", () => setKind(t.dataset.kind));
  });

  addBtn.addEventListener("click", () => {
    const v = (input.value || "").trim();
    if (!v) return;
    if (!WORK.some(x => x.toLowerCase() === v.toLowerCase())) {
      WORK.push(v);
      WORK = uniqSorted(WORK);
      refreshListUI();
      refreshDatalists();
    }
    input.value = "";
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      addBtn.click();
    }
  });

  itemsUL.addEventListener("click", e => {
    const editBtn = e.target.closest(".edit");
    const delBtn  = e.target.closest(".del");
    if (editBtn) {
      const i = parseInt(editBtn.dataset.i, 10);
      const old = WORK[i];
      const nv  = prompt("Renommer :", old);
      if (!nv) return;
      WORK[i] = nv.trim();
      WORK = uniqSorted(WORK);
      refreshListUI();
      refreshDatalists();
    } else if (delBtn) {
      const i = parseInt(delBtn.dataset.i, 10);
      WORK.splice(i, 1);
      refreshListUI();
      refreshDatalists();
    }
  });

  sortBtn.addEventListener("click", () => {
    WORK = uniqSorted(WORK);
    refreshListUI();
    refreshDatalists();
  });

  dedupeBtn.addEventListener("click", () => {
    const seen = new Set();
    const out  = [];
    for (const v of WORK) {
      const k = v.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(v);
      }
    }
    WORK = out;
    refreshListUI();
    refreshDatalists();
  });

  importBtn.addEventListener("click", () => fileInp.click());

  fileInp.addEventListener("change", async () => {
    const f = fileInp.files?.[0];
    if (!f) return;
    const txt  = await f.text();
    const list = parseOneColCSV(txt);
    WORK = uniqSorted(list);
    refreshListUI();
    refreshDatalists();
    fileInp.value = "";
  });

  exportBtn.addEventListener("click", () => {
    const txt = WORK.join("\n") + "\n";
    const blob = new Blob([txt], { type: "text/csv;charset=utf-8" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `liste_${currentKind}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  saveBtn.addEventListener("click", () => {
    LISTS[currentKind] = uniqSorted(WORK);
    refreshDatalists();
    dlg.close();
    showToast(
      "Listes mises à jour côté navigateur. Exportez en CSV si besoin.",
      "info"
    );
  });
}

// -----------------------------
// Exports
// -----------------------------

function getFilteredRows() {
  return applyFilters();
}

function getAllRows() {
  return ARTICLES.slice();
}

async function ensureXLSX() {
  if (window.XLSX) return;
  await new Promise((resolve, reject) => {
    const s   = document.createElement("script");
    s.src     = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.onload  = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function bindExports() {
  const btnCopy    = document.getElementById("export-copy");
  const btnCsv     = document.getElementById("export-csv");
  const btnXlsx    = document.getElementById("export-xlsx");
  const btnPrint   = document.getElementById("export-print");
  const btnCsvAll  = document.getElementById("export-csv-all");
  const btnXlsxAll = document.getElementById("export-xlsx-all");

  btnCopy?.addEventListener("click", async () => {
    const tsv = toTSV(getFilteredRows());
    try {
      await navigator.clipboard.writeText(tsv);
      showToast("Données copiées dans le presse-papiers (TSV)", "success");
    } catch {
      const blob = new Blob([tsv], {
        type: "text/tab-separated-values;charset=utf-8"
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "articles_filtrés.tsv";
      a.click();
      URL.revokeObjectURL(a.href);
    }
  });

  btnCsv?.addEventListener("click", () => {
    const csv = toCSV(getFilteredRows());
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = "articles_filtrés.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  btnXlsx?.addEventListener("click", async () => {
    await ensureXLSX();
    const COLS = [
      "Année",
      "Numéro",
      "Titre",
      "Page(s)",
      "Auteur(s)",
      "Ville(s)",
      "Theme(s)",
      "Epoque"
    ];
    const data = getFilteredRows().map(r => {
      const o = {};
      COLS.forEach(c => {
        o[c] = r[c] || "";
      });
      return o;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Articles");
    XLSX.writeFile(wb, "articles_filtrés.xlsx");
  });

  btnPrint?.addEventListener("click", () => window.print());

  btnCsvAll?.addEventListener("click", () => {
    const csv = toCSV(getAllRows());
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = "articles_tous.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  btnXlsxAll?.addEventListener("click", async () => {
    await ensureXLSX();
    const COLS = [
      "Année",
      "Numéro",
      "Titre",
      "Page(s)",
      "Auteur(s)",
      "Ville(s)",
      "Theme(s)",
      "Epoque"
    ];
    const data = getAllRows().map(r => {
      const o = {};
      COLS.forEach(c => {
        o[c] = r[c] || "";
      });
      return o;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Articles");
    XLSX.writeFile(wb, "articles_tous.xlsx");
  });
}

// -----------------------------
// Aide & Auth
// -----------------------------

function bindHelp() {
  const dlg  = document.getElementById("help-modal");
  const btn  = document.getElementById("help-btn");
  const close= document.getElementById("help-close");
  if (!dlg || !btn || !close) return;
  btn.addEventListener("click", () => dlg.showModal());
  close.addEventListener("click", () => dlg.close());
}

function bindAuth() {
  const loginBtn  = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");

  loginBtn?.addEventListener("click", () => {
    const token = prompt(
      "Collez ici un token GitHub (scope: repo). Il sera stocké en local."
    );
    if (!token) return;
    GHTOKEN = token.trim();
    storeToken(GHTOKEN);
    updateAuthStatus();
    showToast("Token GitHub enregistré localement.", "success");
  });

  logoutBtn?.addEventListener("click", () => {
    if (!confirm("Supprimer le token GitHub local ?")) return;
    GHTOKEN = null;
    storeToken(null);
    updateAuthStatus();
    showToast("Token GitHub supprimé.", "info");
  });

  GHTOKEN = getStoredToken();
  updateAuthStatus();
}

// -----------------------------
// Loading overlay
// -----------------------------

function showLoading(show) {
  const overlay = document.getElementById("loading");
  if (!overlay) return;
  overlay.classList.toggle("hidden", !show);
}

// -----------------------------
// Initialisation
// -----------------------------

async function init() {
  try {
    showLoading(true);

    await fetchCSVArticles();
    await loadLists();

    refreshYearOptions();
    refreshNumeroOptions();
    refreshEpoqueOptions();
    refreshThemeOptions();
    refreshDatalists();

    bindFilters();
    bindSorting();
    bindPager();
    bindExports();
    bindHelp();
    bindAuth();
    bindAddModal();
    bindListsEditor();

    render();

    console.log("✅ Application initialisée avec succès");
  } catch (err) {
    console.error("Erreur init catalogue", err);
    showToast("Erreur de chargement de la page.", "error");
  } finally {
    showLoading(false);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
