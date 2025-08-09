
let articles = [];
let currentSort = { col: null, dir: 'asc' };
let rowsPerPage = 'all';
let currentPage = 1;

// Helpers
const norm = s => (s ?? "").toString().replace(/\u00A0/g, " ").replace(/\u200B/g, "").trim();
const deaccent = s => norm(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function normalizeKeys(row) {
  const out = {};
  for (const k of Object.keys(row)) {
    const nk = deaccent(k).replace(/\s+/g," ");
    let final = nk;
    if (/^annee$/i.test(nk)) final = "Année";
    else if (/^numero$/i.test(nk)) final = "Numéro";
    else if (/^titre$/i.test(nk)) final = "Titre";
    else if (/^pages?$/i.test(nk) || /^page\(s\)$/i.test(nk)) final = "Page(s)";
    else if (/^auteurs?(\(s\))?$/i.test(nk)) final = "Auteur(s)";
    else if (/^villes?(\(s\))?$/i.test(nk)) final = "Ville(s)";
    else if (/^themes?(\(s\))?$/i.test(nk)) final = "Theme(s)";
    else if (/^epoque|periode$/i.test(nk)) final = "Epoque";
    out[final] = norm(row[k]);
  }
  return out;
}

function uniqueSorted(list) {
  return [...new Set(list.filter(v => norm(v) !== ""))].sort((a,b)=> (""+a).localeCompare(""+b, 'fr'));
}

async function loadCsv() {
  try {
    const res = await fetch(CSV_URL, { cache:"no-store" });
    if (!res.ok) throw new Error("HTTP "+res.status);
    const text = await res.text();
    const { data, errors } = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (errors && errors.length) console.warn("Papa errors:", errors.slice(0,5));
    const rows = data.map(normalizeKeys).filter(r => Object.values(r).some(v => norm(v) !== ""));
    articles = rows;
    populateFilters();
    render();
    updateCount(articles.length);
  } catch (e) {
    console.error("CSV load error:", e);
    document.getElementById("articles").innerHTML = `<p style="color:#b00;">Erreur chargement CSV : ${e}</p>`;
  }
}

function populateFilters() {
  const anneeSel  = document.getElementById("filter-annee");
  const numeroSel = document.getElementById("filter-numero");
  if (!anneeSel || !numeroSel) return;
  const annees  = uniqueSorted(articles.map(a => a["Année"]));
  const numeros = uniqueSorted(articles.map(a => a["Numéro"]));
  anneeSel.innerHTML  = `<option value="">(toutes)</option>` + annees.map(v => `<option>${v}</option>`).join("");
  numeroSel.innerHTML = `<option value="">(tous)</option>`   + numeros.map(v => `<option>${v}</option>`).join("");
}

function applyAllFilters() {
  const term   = (document.getElementById("search")?.value || "").toLowerCase();
  const annee  = document.getElementById("filter-annee")?.value || "";
  const numero = document.getElementById("filter-numero")?.value || "";
  let out = articles.filter(row => {
    const okSearch = term ? Object.values(row).some(v => norm(v).toLowerCase().includes(term)) : true;
    const okAnnee  = !annee  || (row["Année"]  || "") == annee;
    const okNumero = !numero || (row["Numéro"] || "") == numero;
    return okSearch && okAnnee && okNumero;
  });
  // sort
  if (currentSort.col) {
    out.sort((a,b) => {
      const A = norm(a[currentSort.col]).toLowerCase();
      const B = norm(b[currentSort.col]).toLowerCase();
      if (A === B) return 0;
      const cmp = A < B ? -1 : 1;
      return currentSort.dir === 'asc' ? cmp : -cmp;
    });
  }
  return out;
}

function paginate(list) {
  if (rowsPerPage === 'all') return { page: list, total: list.length };
  const n = parseInt(rowsPerPage, 10) || list.length;
  const start = (currentPage - 1) * n;
  return { page: list.slice(start, start + n), total: list.length };
}

function render() {
  const container = document.getElementById("articles");
  const filtered = applyAllFilters();
  const { page, total } = paginate(filtered);
  if (!page.length) {
    container.innerHTML = "<p>Aucun article trouvé.</p>";
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  const headers = [
    { key: "Année",     label: "Année" },
    { key: "Numéro",    label: "Numéro" },
    { key: "Titre",     label: "Titre" },
    { key: "Auteur(s)", label: "Auteur(s)" },
    { key: "Theme(s)",  label: "Thème(s)" },
    { key: "Epoque",    label: "Période" },
  ];

  let html = `<table><thead><tr>`;
  for (const h of headers) {
    const cls = currentSort.col === h.key ? (currentSort.dir === 'asc' ? 'sort-asc' : 'sort-desc') : '';
    html += `<th class="${cls}" data-col="${h.key}">${h.label}</th>`;
  }
  html += `</tr></thead><tbody>`;

  html += page.map(row => `
    <tr>
      <td>${row["Année"] || ""}</td>
      <td>${row["Numéro"] || ""}</td>
      <td>${row["Titre"] || ""}</td>
      <td>${row["Auteur(s)"] || ""}</td>
      <td>${row["Theme(s)"] || ""}</td>
      <td>${row["Epoque"] || ""}</td>
    </tr>
  `).join("");

  html += `</tbody></table>`;
  container.innerHTML = html;

  // bind sort
  container.querySelectorAll("th").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.getAttribute("data-col");
      if (currentSort.col === col) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.col = col; currentSort.dir = 'asc';
      }
      render();
    });
  });

  // pagination controls
  const pag = document.getElementById("pagination");
  if (rowsPerPage === 'all') {
    pag.innerHTML = "";
  } else {
    const n = parseInt(rowsPerPage, 10);
    const maxPage = Math.max(1, Math.ceil(total / n));
    if (currentPage > maxPage) currentPage = maxPage;
    pag.innerHTML = `
      <button ${currentPage<=1?'disabled':''} id="prev">◀ Précédent</button>
      <span>Page ${currentPage} / ${maxPage}</span>
      <button ${currentPage>=maxPage?'disabled':''} id="next">Suivant ▶</button>
    `;
    pag.querySelector("#prev").addEventListener("click", () => { currentPage--; render(); });
    pag.querySelector("#next").addEventListener("click", () => { currentPage++; render(); });
  }
}

function updateCount(n) {
  const el = document.getElementById("count");
  if (el) el.textContent = `${n} articles`;
}

// Drawer / Add form (batch)
const batch = [];
const batchHeaders = ["Année","Numéro","Titre","Page(s)","Auteur(s)","Ville(s)","Theme(s)","Epoque"];

function openDrawer() {
  const d = document.getElementById("form-container");
  d.classList.remove("hidden");
  requestAnimationFrame(()=> d.classList.add("open"));
}
function closeDrawer() {
  const d = document.getElementById("form-container");
  d.classList.remove("open");
  setTimeout(()=> d.classList.add("hidden"), 200);
}

function updateBatchPreview() {
  const lines = [batchHeaders.join(",")].concat(
    batch.map(r => batchHeaders.map(h => (r[h] || "").replaceAll('"','""')).map(v => /[",\n]/.test(v) ? `"${v}"` : v).join(","))
  );
  document.getElementById("batch-preview").textContent = lines.join("\n");
  document.getElementById("batch-count").textContent = `${batch.length} en attente`;
}

document.addEventListener("DOMContentLoaded", () => {
  // Bind UI
  document.getElementById("toggle-add")?.addEventListener("click", openDrawer);
  document.getElementById("close-drawer")?.addEventListener("click", closeDrawer);

  document.getElementById("form-article")?.addEventListener("submit", e => {
    e.preventDefault();
    const row = {};
    for (const el of e.target.elements) if (el.name) row[el.name] = norm(el.value);
    batch.push(row);
    e.target.reset();
    updateBatchPreview();

    // Ajout visuel immédiat (en haut)
    articles.unshift(row);
    currentPage = 1;
    render();
  });

  document.getElementById("download-batch")?.addEventListener("click", () => {
    if (!batch.length) return alert("Aucun enregistrement dans le lot.");
    const csv = document.getElementById("batch-preview").textContent || "";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "nouveaux_articles.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("copy-batch")?.addEventListener("click", async () => {
    if (!batch.length) return alert("Aucun enregistrement dans le lot.");
    await navigator.clipboard.writeText(document.getElementById("batch-preview").textContent || "");
    alert("Lot copié !");
  });

  document.getElementById("reset-batch")?.addEventListener("click", () => {
    batch.length = 0;
    updateBatchPreview();
  });

  // Filters & search
  document.getElementById("search")?.addEventListener("input", () => { currentPage = 1; render(); });
  document.getElementById("filter-annee")?.addEventListener("change", () => { currentPage = 1; render(); });
  document.getElementById("filter-numero")?.addEventListener("change", () => { currentPage = 1; render(); });
  document.getElementById("limit")?.addEventListener("change", (e) => {
    rowsPerPage = e.target.value;
    currentPage = 1;
    render();
  });

  // init rowsPerPage
  rowsPerPage = document.getElementById("limit")?.value || 'all';

  // Load CSV
  loadCsv();
});
