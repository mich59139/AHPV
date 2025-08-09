// Chargement CSV
const CSV_URL = "https://raw.githubusercontent.com/mich59139/AHPV/main/data/articles.csv?" + Date.now();

let articles = [];
let currentPage = 1;
let rowsPerPage = 50;
let currentSort = { col: null, dir: 'asc' };

const norm = s => (s ?? "").toString().replace(/\u00A0/g," ").replace(/\u200B/g,"").trim();
const deaccent = s => norm(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function normalizeKeys(row){
  const out = {};
  for(const k of Object.keys(row)){
    const nk0 = deaccent(k).replace(/\s+/g," ").replace(/[’']/g,"'");
    let nk = nk0;
    if(/^annee$/i.test(nk)) nk="Année";
    else if(/^numero$/i.test(nk)) nk="Numéro";
    else if(/^titre$/i.test(nk)) nk="Titre";
    else if(/^pages?$/i.test(nk) || /^page\(s\)$/i.test(nk)) nk="Page(s)";
    else if(/^auteurs?(\(s\))?$/i.test(nk)) nk="Auteur(s)";
    else if(/^villes?(\(s\))?$/i.test(nk)) nk="Ville(s)";
    else if(/^themes?(\(s\))?$/i.test(nk)) nk="Theme(s)";
    else if(/^epoque|periode$/i.test(nk)) nk="Epoque";
    out[nk] = norm(row[k]);
  }
  return out;
}

async function loadCsv(){
  const res = await fetch(CSV_URL,{cache:"no-store"});
  const text = await res.text();
  const {data,errors} = Papa.parse(text,{header:true,skipEmptyLines:true});
  if(errors?.length) console.warn("Papa errors:", errors.slice(0,5));
  articles = data.map(normalizeKeys).filter(r=>Object.values(r).some(v=>norm(v)!==""));
}

function uniqueSorted(list){
  return [...new Set(list.filter(v=>norm(v)!==""))].sort((a,b)=>((""+a).localeCompare(""+b,'fr')));
}

function populateFilters(){
  const aSel=document.getElementById("filter-annee");
  const nSel=document.getElementById("filter-numero");
  aSel.innerHTML = `<option value="">(toutes)</option>` + uniqueSorted(articles.map(a=>a["Année"])).map(v=>`<option>${v}</option>`).join("");
  nSel.innerHTML = `<option value="">(tous)</option>`   + uniqueSorted(articles.map(a=>a["Numéro"])).map(v=>`<option>${v}</option>`).join("");
}

function applyAllFilters(data){
  const term=(document.getElementById("search")?.value||"").toLowerCase();
  const annee=document.getElementById("filter-annee")?.value||"";
  const numero=document.getElementById("filter-numero")?.value||"";

  let out = data.filter(r=>{
    const okSearch = term ? Object.values(r).some(v=>norm(v).toLowerCase().includes(term)) : true;
    const okAnnee  = !annee  || r["Année"]==annee;
    const okNumero = !numero || r["Numéro"]==numero;
    return okSearch && okAnnee && okNumero;
  });

  if(currentSort.col){
    const c=currentSort.col, dir=currentSort.dir==='asc'?1:-1;
    out.sort((a,b)=> (""+a[c]).localeCompare(""+b[c],'fr')*dir );
  }
  return out;
}

function changePage(delta,total){
  const maxPage=Math.max(1, Math.ceil(total/rowsPerPage));
  currentPage=Math.min(maxPage, Math.max(1, currentPage+delta));
  render();
}

function sortBy(col){
  if(currentSort.col===col) currentSort.dir = currentSort.dir==='asc' ? 'desc' : 'asc';
  else currentSort={col,dir:'asc'};
  currentPage=1;
  render();
}

function render(){
  const container=document.getElementById("articles");
  const all=applyAllFilters(articles);
  document.getElementById("count").textContent = `${all.length} articles`;

  if(!all.length){ container.innerHTML="<p>Aucun article trouvé.</p>"; return; }

  // pagination
  const limit=document.getElementById("limit").value;
  rowsPerPage = (limit==="all") ? all.length : parseInt(limit,10);
  const start=(currentPage-1)*rowsPerPage;
  const page=all.slice(start, start+rowsPerPage);

  const arrow = col => currentSort.col===col ? (currentSort.dir==='asc'?'▲':'▼') : '';

  let html=`<table><thead><tr>
    <th onclick="sortBy('Année')">Année <span class="arrow">${arrow('Année')}</span></th>
    <th onclick="sortBy('Numéro')">Numéro <span class="arrow">${arrow('Numéro')}</span></th>
    <th onclick="sortBy('Titre')">Titre <span class="arrow">${arrow('Titre')}</span></th>
    <th onclick="sortBy('Auteur(s)')">Auteur(s) <span class="arrow">${arrow('Auteur(s)')}</span></th>
    <th onclick="sortBy('Theme(s)')">Thème(s) <span class="arrow">${arrow('Theme(s)')}</span></th>
    <th onclick="sortBy('Epoque')">Période <span class="arrow">${arrow('Epoque')}</span></th>
  </tr></thead><tbody>`;

  html += page.map(row=>`
    <tr>
      <td>${row["Année"]||""}</td>
      <td>${row["Numéro"]||""}</td>
      <td>${row["Titre"]||""}</td>
      <td>${row["Auteur(s)"]||""}</td>
      <td>${row["Theme(s)"]||""}</td>
      <td>${row["Epoque"]||""}</td>
    </tr>
  `).join("");

  const maxPage = Math.max(1, Math.ceil(all.length/rowsPerPage));
  html += `</tbody></table>
  <div id="pagination">
    <button ${currentPage<=1?'disabled':''} onclick="changePage(-1, ${all.length})">◀ Précédent</button>
    <span>Page ${currentPage} / ${maxPage} — ${all.length} résultats</span>
    <button ${(start+rowsPerPage)>=all.length?'disabled':''} onclick="changePage(1, ${all.length})">Suivant ▶</button>
  </div>`;

  container.innerHTML=html;
}

// --- Export de la vue filtrée ---
function exportFilteredToCsv(){
  const filtered = applyAllFilters(articles); // ignore la pagination
  const headers = ["Année","Numéro","Titre","Page(s)","Auteur(s)","Ville(s)","Theme(s)","Epoque"];
  const lines = [headers.join(",")].concat(
    filtered.map(r => headers
      .map(h => (r[h]||"").replaceAll('"','""'))
      .map(v => /[",\n]/.test(v) ? `"${v}"` : v)
      .join(",")
    )
  );
  const csv = lines.join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "vue_filtree_articles.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

// --- Drawer / lot ---
const batch=[];
const batchHeaders=["Année","Numéro","Titre","Page(s)","Auteur(s)","Ville(s)","Theme(s)","Epoque"];
function updateBatchPreview(){
  const lines=[batchHeaders.join(",")].concat(
    batch.map(r => batchHeaders
      .map(h => (r[h]||"").replaceAll('"','""'))
      .map(v => /[",\n]/.test(v) ? `"${v}"` : v)
      .join(",")
    )
  );
  document.getElementById("batch-preview").textContent = lines.join("\n");
  document.getElementById("batch-count").textContent = `${batch.length} en attente`;
}

document.addEventListener("DOMContentLoaded", async () => {
  // Drawer
  document.getElementById("toggle-add").addEventListener("click", () => {
    document.getElementById("form-container").classList.add("open");
  });
  document.getElementById("close-drawer").addEventListener("click", () => {
    document.getElementById("form-container").classList.remove("open");
  });

  // Filtres : exclusivité Année ↔ Numéro
  document.getElementById("filter-annee").addEventListener("change",(e)=>{
    if(e.target.value) document.getElementById("filter-numero").value="";
    currentPage=1; render();
  });
  document.getElementById("filter-numero").addEventListener("change",(e)=>{
    if(e.target.value) document.getElementById("filter-annee").value="";
    currentPage=1; render();
  });

  // Autres contrôles
  document.getElementById("limit").addEventListener("change", ()=>{ currentPage=1; render(); });
  document.getElementById("search").addEventListener("input", ()=>{ currentPage=1; render(); });
  document.getElementById("export-view").addEventListener("click", exportFilteredToCsv);

  // Form lot
  document.getElementById("form-article").addEventListener("submit",(e)=>{
    e.preventDefault();
    const row={};
    for(const el of e.target.elements) if(el.name) row[el.name]=el.value.trim();
    batch.push(row);
    e.target.reset();
    updateBatchPreview();
    alert("Ajouté au lot. Téléchargez ou copiez le lot quand vous avez fini.");
  });
  document.getElementById("download-batch").addEventListener("click", ()=>{
    if(!batch.length) return alert("Aucun enregistrement dans le lot.");
    const csv = document.getElementById("batch-preview").textContent || "";
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="nouveaux_articles.csv"; a.click(); URL.revokeObjectURL(a.href);
  });
  document.getElementById("copy-batch").addEventListener("click", async ()=>{
    if(!batch.length) return alert("Aucun enregistrement dans le lot.");
    await navigator.clipboard.writeText(document.getElementById("batch-preview").textContent || "");
    alert("Lot copié !");
  });
  document.getElementById("reset-batch").addEventListener("click", ()=>{ batch.length=0; updateBatchPreview(); });

  // Data
  await loadCsv();
  populateFilters();
  render();
});
