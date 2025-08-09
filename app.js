// Charge le CSV depuis GitHub (anti-cache)
const CSV_URL = "https://raw.githubusercontent.com/mich59139/AHPV/main/data/articles.csv?" + Date.now();

let articles = [];

// Helpers de normalisation
const norm = s => (s ?? "").toString().replace(/\u00A0/g," ").replace(/\u200B/g,"").trim();
const deaccent = s => norm(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"");

function normalizeKeys(row){
  const out = {};
  for (const k of Object.keys(row)){
    const nk0 = deaccent(k).replace(/\s+/g," ").replace(/[’']/g,"'");
    let nk = nk0;
    if (/^annee$/i.test(nk)) nk = "Année";
    else if (/^numero$/i.test(nk)) nk = "Numéro";
    else if (/^titre$/i.test(nk)) nk = "Titre";
    else if (/^pages?$/i.test(nk) || /^page\(s\)$/i.test(nk)) nk = "Page(s)";
    else if (/^auteurs?(\(s\))?$/i.test(nk)) nk = "Auteur(s)";
    else if (/^villes?(\(s\))?$/i.test(nk)) nk = "Ville(s)";
    else if (/^themes?(\(s\))?$/i.test(nk)) nk = "Theme(s)";
    else if (/^epoque|periode$/i.test(nk)) nk = "Epoque";
    out[nk] = norm(row[k]);
  }
  return out;
}

function uniqueSorted(list){
  return [...new Set(list.filter(v => norm(v) !== ""))].sort((a,b)=> (""+a).localeCompare(""+b,'fr'));
}

async function loadCsv(){
  try{
    const res = await fetch(CSV_URL, {cache:"no-store"});
    if (!res.ok) throw new Error("HTTP "+res.status);
    const text = await res.text();
    const parsed = Papa.parse(text, {header:true, skipEmptyLines:true});
    const rows = parsed.data
      .map(normalizeKeys)
      .filter(r => Object.values(r).some(v => norm(v) !== ""));
    console.log("Parsed rows:", rows.length);
    articles = rows;
    populateFilters();
    render();
  }catch(e){
    console.error("CSV load error:", e);
    document.getElementById("articles").innerHTML = `<p style="color:#b00;">Erreur de chargement du CSV : ${e}</p>`;
  }
}

function populateFilters(){
  const anSel = document.getElementById("filter-annee");
  const nuSel = document.getElementById("filter-numero");
  const annees = uniqueSorted(articles.map(a => a["Année"]));
  const numeros = uniqueSorted(articles.map(a => a["Numéro"]));
  anSel.innerHTML = `<option value="">(toutes)</option>` + annees.map(v=>`<option>${v}</option>`).join("");
  nuSel.innerHTML = `<option value="">(tous)</option>` + numeros.map(v=>`<option>${v}</option>`).join("");
}

function applyFilters(data){
  const term = (document.getElementById("search")?.value || "").toLowerCase();
  const annee = document.getElementById("filter-annee")?.value || "";
  const numero = document.getElementById("filter-numero")?.value || "";
  return data.filter(row => {
    const okSearch = term ? Object.values(row).some(v => norm(v).toLowerCase().includes(term)) : true;
    const okAnnee = !annee || (row["Année"] || "") == annee;
    const okNumero = !numero || (row["Numéro"] || "") == numero;
    return okSearch && okAnnee && okNumero;
  });
}

function render(){
  const container = document.getElementById("articles");
  const filtered = applyFilters(articles);
  if (!filtered.length){
    container.innerHTML = "<p>Aucun article trouvé.</p>";
    return;
  }

  // Tableau SANS colonne de numérotation
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
  ["filter-annee","filter-numero"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", render);
  });
  const s = document.getElementById("search");
  if (s) s.addEventListener("input", render);
  loadCsv();
});
