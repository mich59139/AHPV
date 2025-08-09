// 👉 Mets CE chemin exact vers ton CSV (anti-cache inclus)
const CSV_URL = "https://raw.githubusercontent.com/mich59139/AHPV/main/data/articles.csv?" + Date.now();

let articles = [];

// Helpers
const norm = s => (s ?? "")
  .toString()
  .replace(/\u00A0/g, " ")     // NBSP
  .replace(/\u200B/g, "")      // zero-width
  .trim();

const deaccent = s => norm(s)
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Normalise les clés d’un objet (headers)
function normalizeKeys(row) {
  const map = {}; // oldKey->newKey
  Object.keys(row).forEach(k => {
    const nk = deaccent(k)
      .replace(/\s+/g, " ")
      .replace(/[’']/g, "'")
      .replace(/\(s\)/g, "(s)");
    // remap courants
    let final = nk;
    if (/^annee$/i.test(nk)) final = "Année";
    if (/^numero$/i.test(nk)) final = "Numéro";
    if (/^titre$/i.test(nk)) final = "Titre";
    if (/^pages?$/i.test(nk) || /^page\(s\)$/i.test(nk)) final = "Page(s)";
    if (/^auteurs?(\(s\))?$/i.test(nk)) final = "Auteur(s)";
    if (/^villes?(\(s\))?$/i.test(nk)) final = "Ville(s)";
    if (/^themes?(\(s\))?$/i.test(nk)) final = "Theme(s)";
    if (/^epoque|periode$/i.test(nk)) final = "Epoque";
    map[k] = final;
  });
  const out = {};
  for (const [ok, nk] of Object.entries(map)) out[nk] = norm(row[ok]);
  return out;
}

function parseCsvText(text) {
  return new Promise(resolve => {
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h, // on normalise après
    });
    resolve(result);
  });
}

async function loadCsv() {
  try {
    // fetch + parse (évite certains soucis download/CORS)
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();

    const { data, errors, meta } = await parseCsvText(text);
    console.log("Papa meta:", meta);
    if (errors && errors.length) console.warn("Papa errors:", errors.slice(0, 5));

    // normalise lignes + filtre vides
    const rows = data
      .map(normalizeKeys)
      .filter(r => Object.values(r).some(v => norm(v) !== ""));

    console.log("Parsed rows:", rows.length);
    articles = rows;
    render(articles);
    updateCount(articles.length);
  } catch (e) {
    console.error("CSV load error:", e);
    const c = document.getElementById("articles");
    c.innerHTML = `<p style="color:#b00;">Erreur de chargement du CSV : ${e}</p>`;
  }
}

function updateCount(n) {
  let el = document.getElementById("count");
  if (!el) {
    el = document.createElement("div");
    el.id = "count";
    el.style.margin = "8px 0";
    document.querySelector("h1").after(el);
  }
  el.textContent = `${n} articles`;
}

// Rendu du tableau (avec Epoque)
function render(data) {
  const container = document.getElementById("articles");
  const term = (document.getElementById("search")?.value || "").toLowerCase();
  const filtered = term
    ? data.filter(row => Object.values(row).some(v => norm(v).toLowerCase().includes(term)))
    : data;

  if (!filtered.length) {
    container.innerHTML = "<p>Aucun article trouvé.</p>";
    return;
  }

  let html = `<table><thead><tr>
    <th>Année</th>
    <th>Numéro</th>
    <th>Titre</th>
    <th>Auteur(s)</th>
    <th>Thème(s)</th>
    <th>Période</th>
  </tr></thead><tbody>`;

  html += filtered.map(row => `
    <tr>
      <td>${row["Année"] || ""}</td>
      <td>${row["Numéro"] || ""}</td>
      <td>${row["Titre"] || ""}</td>
      <td>${row["Auteur(s)"] || ""}</td>
      <td>${row["Theme(s)"] || ""}</td>
      <td>${row["Epoque"] || ""}</td>
    </tr>
  `).join("");

  html += "</tbody></table>";
  container.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => {
  // recherche live
  const s = document.getElementById("search");
  if (s) s.addEventListener("input", () => render(articles));
  loadCsv();
});
