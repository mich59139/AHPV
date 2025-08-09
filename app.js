// --- Config ---
const CSV_URL = "https://raw.githubusercontent.com/mich59139/AHPV/main/data/articles.csv";

// --- State ---
let allRows = [];
let filtered = [];
let page = 1;
let pageSize = Infinity; // "Tous" par défaut
let sort = { col: null, dir: 'asc' };
const cols = ["Année","Numéro","Titre","Auteur(s)","Theme(s)"];

// --- Utils ---
const norm = (s) => String(s ?? "")
  .replace(/\u00A0/g, ' ')         // nbsp -> space
  .replace(/\s+/g, ' ')            // collapse spaces
  .trim();

function normalizeHeaders(h){
  const map = {
    "annee":"Année","année":"Année","année":"Année",
    "numero":"Numéro","numéro":"Numéro","num":"Numéro",
    "titre":"Titre",
    "page(s)":"Page(s)","pages":"Page(s)",
    "auteur(s)":"Auteur(s)","auteurs":"Auteur(s)",
    "ville(s)":"Ville(s)","villes":"Ville(s)",
    "theme(s)":"Theme(s)","thème(s)":"Theme(s)","themes":"Theme(s)","thèmes":"Theme(s)",
    "epoque":"Epoque","époque":"Epoque","epoques":"Epoque"
  };
  return map[h.toLowerCase()] ?? h;
}

// --- Load CSV ---
Papa.parse(CSV_URL, {
  download: true,
  header: true,
  skipEmptyLines: true,
  transformHeader: normalizeHeaders,
  complete: (res) => {
    const rows = res.data.map(r => {
      const o = {};
      for (const k in r) o[normalizeHeaders(k)] = norm(r[k]);
      return o;
    }).filter(r => Object.values(r).some(v => v !== "")); // drop empty lines
    allRows = rows;
    filtered = rows;
    page = 1;
    render();
    console.log("Parsed rows:", rows.length);
  },
  error: (err, file, inputElem, reason) => {
    console.error("PapaParse error:", err, reason);
    document.getElementById("table-view").innerHTML = `<p style="color:#c00">Erreur de lecture CSV: ${reason || err}</p>`;
  }
});

// --- Rendering ---
function getSortedRows(rows){
  if (!sort.col) return rows;
  return [...rows].sort((a,b) => {
    const A = a[sort.col] ?? "";
    const B = b[sort.col] ?? "";
    const numA = Number(A), numB = Number(B);
    const bothNums = !Number.isNaN(numA) && !Number.isNaN(numB);
    const cmp = bothNums ? (numA - numB) : A.localeCompare(B, 'fr', {sensitivity:'base'});
    return sort.dir === 'asc' ? cmp : -cmp;
  });
}

function render(){
  // search filter
  const q = norm(document.getElementById("search").value).toLowerCase();
  filtered = !q ? allRows : allRows.filter(r =>
    Object.values(r).some(v => v.toLowerCase().includes(q))
  );

  const sorted = getSortedRows(filtered);

  // pagination
  const size = pageSize === Infinity ? sorted.length : pageSize;
  const total = sorted.length;
  const start = (page-1)*size;
  const view = sorted.slice(start, start+size);

  // table
  const head = `<thead><tr>${cols.map(c=>`<th data-col="${c}">${c}${sort.col===c? (sort.dir==='asc'?' ▲':' ▼'):''}</th>`).join('')}</tr></thead>`;
  const body = `<tbody>${
    view.map(r => `<tr>
      <td>${r["Année"]||""}</td>
      <td>${r["Numéro"]||""}</td>
      <td>${r["Titre"]||""}</td>
      <td>${r["Auteur(s)"]||""}</td>
      <td>${r["Theme(s)"]||""}</td>
    </tr>`).join('')
  }</tbody>`;
  document.getElementById("table-view").innerHTML = `<table>${head}${body}</table>`;

  // sorter binding
  document.querySelectorAll("th[data-col]").forEach(th => {
    th.onclick = () => {
      const c = th.dataset.col;
      sort = (sort.col===c) ? {col:c, dir: (sort.dir==='asc'?'desc':'asc')} : {col:c, dir:'asc'};
      render();
    };
  });

  // pager
  const pager = document.getElementById("pager");
  if (pageSize === Infinity || total <= size){
    pager.innerHTML = "";
  } else {
    const pages = Math.ceil(total/size);
    pager.innerHTML = `<button ${page<=1?'disabled':''} id="prev">◀</button>
      <span>Page ${page}/${pages} — ${total} articles</span>
      <button ${page>=pages?'disabled':''} id="next">▶</button>`;
    document.getElementById("prev").onclick = ()=>{ if(page>1){page--; render();}};
    document.getElementById("next").onclick = ()=>{ const pages=Math.ceil(total/size); if(page<pages){page++; render();}};
  }
}

// --- UI events ---
document.getElementById("search").addEventListener("input", () => { page=1; render(); });
document.getElementById("limit").addEventListener("change", (e)=>{
  const v = e.target.value;
  pageSize = (v === "all") ? Infinity : parseInt(v,10);
  page = 1;
  render();
});

// Drawer
const drawer = document.getElementById("drawer");
document.getElementById("openDrawer").onclick = ()=> drawer.classList.add("open");
document.getElementById("closeDrawer").onclick = ()=> drawer.classList.remove("open");

// Add form -> CSV line
document.getElementById("addForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  const form = new FormData(e.target);
  const obj = Object.fromEntries(form.entries());
  // show CSV
  const headers = Object.keys(obj).join(",");
  const row = Object.values(obj).join(",");
  const csv = `${headers}\n${row}`;
  document.getElementById("preview").textContent = csv;
  // update view locally (does not push to GitHub)
  allRows.unshift(obj);
  page = 1;
  render();
});
document.getElementById("copyBtn").onclick = ()=>{
  const txt = document.getElementById("preview").textContent || "";
  navigator.clipboard.writeText(txt).then(()=> alert("Ligne CSV copiée — colle-la dans data/articles.csv sur GitHub."));
};
