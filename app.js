// --- Config ---
const CSV_URL = "https://raw.githubusercontent.com/mich59139/AHPV/main/data/articles.csv?" + Date.now();

// --- State ---
let articles = [];
let filtered = [];
let currentPage = 1;
let rowsPerPage = 'all';
let currentSort = { col: null, dir: 'asc' };

// --- Utils ---
const norm = s => (s ?? "").toString().replace(/\u00A0/g, " ").trim();
const uniqueSorted = arr => Array.from(new Set(arr.filter(Boolean).map(norm))).sort((a,b)=>a.localeCompare(b));

// --- Load CSV ---
Papa.parse(CSV_URL, {
  download: true,
  header: true,
  encoding: "UTF-8",
  skipEmptyLines: true,
  complete: (res) => {
    articles = (res.data || []).map(row => ({
      "Année": norm(row["Année"]),
      "Numéro": norm(row["Numéro"]),
      "Titre": norm(row["Titre"]),
      "Page(s)": norm(row["Page(s)"]),
      "Auteur(s)": norm(row["Auteur(s)"]),
      "Ville(s)": norm(row["Ville(s)"]),
      "Theme(s)": norm(row["Theme(s)"]),
      "Epoque": norm(row["Epoque"]),
    })).filter(r => Object.values(r).some(v => v));
    document.getElementById('count').textContent = `${articles.length} articles`;
    populateDatalists(articles);
    applyView();
  },
  error: (err) => {
    document.getElementById('articles').innerHTML = `<p style="color:red;">Erreur de lecture du CSV : ${err}</p>`;
  }
});

function populateDatalists(data){
  const setList = (id, vals) => {
    const el = document.getElementById(id);
    el.innerHTML = uniqueSorted(vals).map(v=>`<option value="${v}">`).join("");
  };
  setList("dl-auteurs", data.map(d=>d["Auteur(s)"]));
  setList("dl-villes", data.map(d=>d["Ville(s)"]));
  setList("dl-themes", data.map(d=>d["Theme(s)"]));
  setList("dl-epoques", data.map(d=>d["Epoque"]));
}

// --- Rendering ---
function applyView(){
  const term = norm(document.getElementById('search').value).toLowerCase();
  filtered = term ? articles.filter(r => Object.values(r).some(v => v.toLowerCase().includes(term))) : [...articles];

  // sort
  if (currentSort.col){
    filtered.sort((a,b)=>{
      const A = a[currentSort.col] || "", B = b[currentSort.col] || "";
      const cmp = isFinite(A) && isFinite(B) ? (Number(A)-Number(B)) : A.localeCompare(B);
      return currentSort.dir === 'asc' ? cmp : -cmp;
    });
  }

  renderTable();
}

function renderTable(){
  const container = document.getElementById('articles');
  if (!filtered.length){
    container.innerHTML = "<p>Aucun article trouvé.</p>";
    return;
  }
  const headers = ["Année","Numéro","Titre","Auteur(s)","Theme(s)","Epoque"];
  const start = rowsPerPage === 'all' ? 0 : (currentPage-1) * Number(rowsPerPage);
  const end = rowsPerPage === 'all' ? filtered.length : start + Number(rowsPerPage);
  const pageRows = filtered.slice(start, end);

  const th = h => `<th class="sortable" onclick="toggleSort('${h}')">${h === 'Epoque' ? 'Période' : h} ${currentSort.col === h ? (currentSort.dir==='asc'?'▲':'▼') : ''}</th>`;

  let html = `<table><thead><tr>${headers.map(th).join("")}</tr></thead><tbody>`;
  html += pageRows.map(r => `<tr>
    <td>${r["Année"]||""}</td>
    <td>${r["Numéro"]||""}</td>
    <td>${r["Titre"]||""}</td>
    <td>${r["Auteur(s)"]||""}</td>
    <td>${r["Theme(s)"]||""}</td>
    <td>${r["Epoque"]||""}</td>
  </tr>`).join("");
  html += "</tbody></table>";

  // pager
  const totalPages = rowsPerPage === 'all' ? 1 : Math.max(1, Math.ceil(filtered.length / Number(rowsPerPage)));
  const pager = rowsPerPage === 'all' ? "" : `<div class="pager">
      <button ${currentPage<=1?'disabled':''} onclick="gotoPage(${currentPage-1})">◀ Précédent</button>
      <span>Page ${currentPage} / ${totalPages}</span>
      <button ${currentPage>=totalPages?'disabled':''} onclick="gotoPage(${currentPage+1})">Suivant ▶</button>
    </div>`;

  container.innerHTML = html + pager;
}

function toggleSort(col){
  if (currentSort.col === col){
    currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.col = col;
    currentSort.dir = 'asc';
  }
  applyView();
}
function gotoPage(p){ currentPage = p; renderTable(); }

// --- Events ---
document.getElementById('search').addEventListener('input', () => { currentPage = 1; applyView(); });
document.getElementById('limit').addEventListener('change', (e)=>{ rowsPerPage = e.target.value; currentPage = 1; renderTable(); });

// --- Drawer ---
const drawer = document.getElementById('form-container');
document.getElementById('toggle-form').addEventListener('click', ()=>drawer.classList.remove('hidden'));
document.getElementById('close-form').addEventListener('click', ()=>drawer.classList.add('hidden'));

// --- Batch entry ---
const batch = [];
const headers = ["Année","Numéro","Titre","Page(s)","Auteur(s)","Ville(s)","Theme(s)","Epoque"];
const batchPreview = document.getElementById('batch-preview');
const batchCount = document.getElementById('batch-count');

document.getElementById('form-article').addEventListener('submit', (e)=>{
  e.preventDefault();
  const row = {};
  for (const el of e.target.elements) if (el.name) row[el.name] = norm(el.value);
  batch.push(row);
  e.target.reset();
  updateBatchPreview();
});

function updateBatchPreview(){
  const lines = [headers.join(",")].concat(batch.map(r => headers.map(h => (r[h]||"").replaceAll('"','""')).map(v => /[",\n]/.test(v)?`"${v}"`:v).join(",")));
  batchPreview.textContent = lines.join("\n");
  batchCount.textContent = `${batch.length} en attente`;
}

document.getElementById('download-batch').addEventListener('click', ()=>{
  if (!batch.length) return alert("Aucun enregistrement dans le lot.");
  const blob = new Blob([batchPreview.textContent], { type:"text/csv;charset=utf-8" });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = "nouveaux_articles.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('copy-batch').addEventListener('click', async()=>{
  if (!batch.length) return alert("Aucun enregistrement dans le lot.");
  await navigator.clipboard.writeText(batchPreview.textContent);
  alert("Lot copié dans le presse-papiers.");
});

document.getElementById('reset-batch').addEventListener('click', ()=>{
  batch.length = 0;
  updateBatchPreview();
});
