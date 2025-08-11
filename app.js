// Full app (AHPV) — exports, filters, autosuggest/normalisation, dup-check

/* ========= Config ========= */
const GITHUB_USER   = "mich59139";   // ← ton user/org
const GITHUB_REPO   = "AHPV";        // ← nom du dépôt
const GITHUB_BRANCH = "main";
const CSV_PATH      = "data/articles.csv";

const RAW_URL       = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${CSV_PATH}`;
const API_URL       = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${CSV_PATH}`;

// Utils
const sleep = ms => new Promise(res => setTimeout(res, ms));
const debounce = (fn, ms=180) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms) } };

/* ========= State ========= */
let ARTICLES = [];
let FILTER_YEAR = "", FILTER_NUM = "", QUERY = "";
let sortCol = null, sortDir = "asc";
let currentPage = 1, pageSize = 50;
let editingIndex = -1;
let GHTOKEN = localStorage.getItem("ghtoken") || "";

/* ========= CSV utils ========= */
function parseCSV(text){
  const lines = text.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n");
  if (!lines.length) return [];
  const header = lines.shift().split(",");
  const out = [];
  for (const ln of lines){
    if (!ln.trim()) continue;
    const row=[]; let cur=""; let q=false;
    for (let i=0;i<ln.length;i++){
      const c=ln[i];
      if (q){
        if (c === '"' && ln[i+1] === '"'){ cur+='"'; i++; }
        else if (c === '"'){ q=false; }
        else cur+=c;
      }else{
        if (c === '"'){ q=true; }
        else if (c === ","){ row.push(cur); cur=""; }
        else cur+=c;
      }
    }
    row.push(cur);
    const o={}; header.forEach((h,i)=>o[h]=row[i]??"");
    out.push(o);
  }
  return out;
}
function toCSV(rows){
  const COLS = ["Année","Numéro","Titre","Page(s)","Auteur(s)","Ville(s)","Theme(s)","Epoque"];
  const esc = s => {
    s = (s==null ? "" : (""+s)).replaceAll('"','""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const head = COLS.join(",");
  const body = rows.map(r => COLS.map(h => esc(r[h])).join(",")).join("\n");
  return head + "\n" + body + "\n";
}

/* ========= GitHub save/load ========= */
async function fetchCSV(){
  showLoading(true);
  const res = await fetch(RAW_URL, { cache:"no-store" });
  if (!res.ok){ showLoading(false); throw new Error("CSV introuvable"); }
  const text = await res.text();
  showLoading(false);
  return parseCSV(text);
}
async function getContentSha(){
  const res = await fetch(API_URL, { headers: { Authorization: `token ${GHTOKEN}` }});
  if (!res.ok) throw new Error("Impossible de récupérer le SHA (auth?)");
  const json = await res.json();
  return json.sha;
}
async function saveToGitHubMerged(newRows, message="Mise à jour catalogue"){
  if (!GHTOKEN){ alert("Modifié localement. Cliquez 🔐 pour enregistrer ensuite."); return; }
  const sha = await getContentSha();
  const content = btoa(unescape(encodeURIComponent(toCSV(newRows))));
  const body = { message, content, sha, branch: GITHUB_BRANCH, committer: { name: "AHPV Bot", email: "noreply@example.com" } };
  const res = await fetch(API_URL, {
    method:"PUT",
    headers:{ "Content-Type":"application/json", Authorization:`token ${GHTOKEN}` },
    body: JSON.stringify(body)
  });
  if (!res.ok){ throw new Error("Échec commit"); }
}

/* ========= Rendering ========= */
function uniqSorted(arr){ return Array.from(new Set(arr)).sort((a,b)=>(""+a).localeCompare(""+b,"fr",{numeric:true})) }
function applyFilters(){
  let rows = ARTICLES.slice();
  if (FILTER_YEAR) rows = rows.filter(r => (r["Année"]||"")===FILTER_YEAR);
  if (FILTER_NUM)  rows = rows.filter(r => ((""+(r["Numéro"]||"")).trim()===(""+FILTER_NUM).trim()));
  if (QUERY){ const q=QUERY.toLowerCase(); rows = rows.filter(r => Object.values(r).some(v => (v??"").toString().toLowerCase().includes(q))) }
  if (sortCol){
    const factor = sortDir==="desc" ? -1 : 1;
    rows.sort((a,b)=> (""+(a[sortCol]??"")).localeCompare(""+(b[sortCol]??""),"fr",{numeric:true,sensitivity:"base"})*factor);
  }
  return rows;
}
function render(){
  const rows = applyFilters();
  const total = rows.length;
  const start = (currentPage-1)*pageSize;
  const page = rows.slice(start, start+pageSize);

  const tbody = document.getElementById("tbody");
  tbody.innerHTML = page.map((r, iOnPage) => {
    const i = start + iOnPage;
    if (editingIndex !== i){
      return `
      <tr class="row" ondblclick="window._inlineEdit?.(${i})" onclick="window._editRow?.(${i})">
        <td data-label="Année"  class="col-annee">${r["Année"]||""}</td>
        <td data-label="Numéro" class="col-numero">${r["Numéro"]||""}</td>
        <td data-label="Titre"  class="col-titre">${r["Titre"]||""}</td>
        <td data-label="Page(s)">${r["Page(s)"]||""}</td>
        <td data-label="Auteur(s)">${r["Auteur(s)"]||""}</td>
        <td data-label="Ville(s)">${r["Ville(s)"]||""}</td>
        <td data-label="Thème(s)">${r["Theme(s)"]||""}</td>
        <td data-label="Période">${r["Epoque"]||""}</td>
        <td class="actions">
          <button class="edit" onclick="window._inlineEdit?.(${i})" aria-label="Modifier la ligne">✎</button>
          <button class="del"  onclick="window._deleteRow?.(${i})" aria-label="Supprimer la ligne">🗑</button>
        </td>
      </tr>`;
    } else {
      return `
      <tr class="row editing">
        <td><input id="ei-annee"   value="${r["Année"]||""}"   /></td>
        <td><input id="ei-numero"  value="${r["Numéro"]||""}"  /></td>
        <td><input id="ei-titre"   value="${r["Titre"]||""}"   /></td>
        <td><input id="ei-pages"   value="${r["Page(s)"]||""}" /></td>
        <td><input id="ei-auteurs" value="${r["Auteur(s)"]||""}" /></td>
        <td><input id="ei-villes"  value="${r["Ville(s)"]||""}" /></td>
        <td><input id="ei-themes"  value="${r["Theme(s)"]||""}" /></td>
        <td><input id="ei-epoque"  value="${r["Epoque"]||""}" /></td>
        <td class="actions">
          <button onclick="window._inlineSave?.()" aria-label="Enregistrer">💾</button>
          <button onclick="window._inlineCancel?.()" aria-label="Annuler">✖</button>
        </td>
      </tr>`;
    }
  }).join("");

  document.querySelectorAll("th[data-col]").forEach(th=>{
    th.classList.remove("sort-asc","sort-desc");
    if (th.dataset.col === sortCol) th.classList.add(sortDir==="asc"?"sort-asc":"sort-desc");
  });

  const pages = Math.max(1, Math.ceil(total / pageSize));
  document.getElementById("pageinfo").textContent = `${Math.min(currentPage,pages)} / ${pages} — ${total} ligne(s)`;
  document.getElementById("prev").disabled = currentPage<=1;
  document.getElementById("next").disabled = currentPage>=pages;

  document.getElementById("status-count").textContent = `Fichier: ✅ (${ARTICLES.length})`;
  document.getElementById("status-auth").textContent = GHTOKEN ? "🔐 Connecté" : "🔓 Invité";
}
function showLoading(b){ document.getElementById("loading").classList.toggle("hidden", !b) }

/* ========= Inline edit ========= */
let AUTO_SAVE_SILENT = false;
window._editRow = (idx)=>{ try{ if (matchMedia("(max-width:800px)").matches) _inlineEdit(idx); } catch{ _inlineEdit(idx); } };
window._inlineEdit = (idx)=>{
  editingIndex = idx; render();
  setTimeout(()=> document.getElementById("ei-titre")?.focus(), 0);
  const ids = ["ei-annee","ei-numero","ei-titre","ei-pages","ei-auteurs","ei-villes","ei-themes","ei-epoque"];
  const scheduleSave = debounce(()=>{ try{ AUTO_SAVE_SILENT=true; window._inlineSave?.(); } finally { AUTO_SAVE_SILENT=false; } }, 800);
  ids.forEach(id=>{
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener("change", scheduleSave, {passive:true});
    el.addEventListener("blur", scheduleSave, {passive:true});
    el.addEventListener("keydown", (e)=>{
      if (e.key==="Enter"){ e.preventDefault(); scheduleSave(); }
      if (e.key==="Escape"){ e.preventDefault(); window._inlineCancel?.(); }
    });
  });
};
window._inlineCancel = ()=>{ editingIndex = -1; render(); };
window._inlineSave = async ()=>{
  const i = editingIndex; if (i<0) return;
  const r = ARTICLES[i];
  const v = id => document.getElementById(id)?.value ?? "";
  const updatedRaw = {
    "Année":   v("ei-annee"),
    "Numéro":  v("ei-numero"),
    "Titre":   v("ei-titre"),
    "Page(s)": v("ei-pages"),
    "Auteur(s)": v("ei-auteurs"),
    "Ville(s)":  v("ei-villes"),
    "Theme(s)":  v("ei-themes"),
    "Epoque":    v("ei-epoque"),
  };
  const updated = normaliseRowFields(updatedRaw);
  ARTICLES[i] = updated;
  editingIndex = -1; render();
  if (!GHTOKEN){ if (!AUTO_SAVE_SILENT) alert("Modifié localement. Cliquez 🔐 pour enregistrer ensuite."); return; }
  try{
    await saveToGitHubMerged(ARTICLES, "Édition ligne");
  }catch(e){ console.error(e); alert("Échec de l'enregistrement GitHub"); }
};

/* ========= Add / Delete ========= */
window._openAddModal = ()=>{
  const d = document.getElementById("add-modal");
  document.getElementById("add-form").reset();
  d.showModal();
  document.getElementById("a-annee")?.focus();
  document.body.classList.add("no-scroll");
};
document.addEventListener("keydown", (e)=>{
  const d = document.getElementById("add-modal");
  if (e.key === "Escape" && d?.open) d.close();
});
document.getElementById("add-modal")?.addEventListener("close", ()=>{
  document.body.classList.remove("no-scroll");
});
document.getElementById("add-cancel")?.addEventListener("click", () => {
  document.getElementById("add-modal")?.close();
});

document.getElementById("add-form")?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const rowRaw = {
    "Année":   document.getElementById("a-annee").value.trim(),
    "Numéro":  document.getElementById("a-numero").value.trim(),
    "Titre":   document.getElementById("a-titre").value.trim(),
    "Page(s)": document.getElementById("a-pages").value.trim(),
    "Auteur(s)": document.getElementById("a-auteurs").value.trim(),
    "Ville(s)":  document.getElementById("a-villes").value.trim(),
    "Theme(s)":  document.getElementById("a-themes").value.trim(),
    "Epoque":    document.getElementById("a-epoque").value.trim(),
  };
  const row = normaliseRowFields(rowRaw);

  const dupExact = ARTICLES.find(r => (r["Année"]===row["Année"] && r["Numéro"]===row["Numéro"] && r["Titre"]===row["Titre"]));
  if (dupExact){ alert("Doublon exact (Année + Numéro + Titre)"); return; }

  if (!checkDuplicateBeforeAdd(row)) return;

  ARTICLES.push(row);
  document.getElementById("add-modal").close();
  currentPage = Math.ceil(ARTICLES.length / pageSize);
  render();
  if (!GHTOKEN){ alert("Ajout local. Cliquez 🔐 pour enregistrer ensuite."); return; }
  try{
    await saveToGitHubMerged(ARTICLES, "Ajout d'article");
  }catch(e){ console.error(e); alert("Échec du commit GitHub"); }
});
window._deleteRow = async (idx)=>{
  if (!confirm("Supprimer cette ligne ?")) return;
  ARTICLES.splice(idx,1);
  render();
  if (!GHTOKEN){ alert("Suppression locale. Cliquez 🔐 pour enregistrer ensuite."); return; }
  try{ await saveToGitHubMerged(ARTICLES, "Suppression"); }catch(e){ console.error(e); alert("Échec commit"); }
};

/* ========= Filters, sorting, pager ========= */
function refreshNumeroOptions(){
  const selYear=document.getElementById("filter-annee");
  const selNum=document.getElementById("filter-numero");
  if (!selYear || !selNum) return;
  const year=selYear.value;
  let nums=ARTICLES
    .filter(r => !year || (r["Année"]||"")==year)
    .map(r => (r["Numéro"]==null?"":(""+r["Numéro"]).trim()))
    .filter(Boolean);
  nums = uniqSorted(nums);
  const cur=selNum.value;
  selNum.innerHTML = '<option value="">(tous)</option>' + nums.map(n=>`<option value="${n}">${n}</option>`).join("");
  if (nums.includes(cur)) selNum.value=cur; else selNum.value="";
}
function resetAllFilters(){
  document.getElementById("filter-annee").value="";
  document.getElementById("filter-numero").value="";
  document.getElementById("search").value="";
  FILTER_YEAR=""; FILTER_NUM=""; QUERY="";
  sortCol=null; sortDir="asc"; currentPage=1;
  refreshNumeroOptions(); render();
}
function bindFilters(){
  const fy = document.getElementById("filter-annee");
  const fn = document.getElementById("filter-numero");
  const q  = document.getElementById("search");
  fy?.addEventListener("change", ()=>{
    FILTER_YEAR = fy.value;
    if (!FILTER_YEAR){ fn.value=""; q.value=""; FILTER_NUM=""; QUERY=""; sortCol=null; sortDir="asc"; currentPage=1; }
    refreshNumeroOptions();
    currentPage=1; render();
  });
  fn?.addEventListener("change", ()=>{ FILTER_NUM = fn.value; currentPage=1; render(); });
  q?.addEventListener("input", debounce(()=>{ QUERY=q.value; currentPage=1; render(); }, 180));
}
function bindSorting(){
  document.querySelectorAll("th[data-col]").forEach(th=>{
    const col = th.dataset.col;
    const act = ()=>{
      if (sortCol===col) sortDir = (sortDir==="asc"?"desc":"asc");
      else { sortCol=col; sortDir="asc"; }
      currentPage=1; render();
    };
    th.addEventListener("click", act);
    th.addEventListener("keydown", (e)=>{ if (e.key==="Enter"||e.key===" "){ e.preventDefault(); act(); } });
  });
}
function bindPager(){
  document.getElementById("prev")?.addEventListener("click", ()=>{ if (currentPage>1){ currentPage--; render(); } });
  document.getElementById("next")?.addEventListener("click", ()=>{ currentPage++; render(); });
}

/* ========= Exports ========= */
const CSV_HEADERS = ["Année","Numéro","Titre","Page(s)","Auteur(s)","Ville(s)","Theme(s)","Epoque"];
function getFilteredRows(){ return applyFilters(); }
function getAllRows(){ return ARTICLES.slice(); }
function download(name, text, mime="text/csv;charset=utf-8"){
  const blob = new Blob([text], {type: mime});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}
function toTSV(rows){ const head=CSV_HEADERS.join("\t"); const body=rows.map(r=>CSV_HEADERS.map(h=>r[h]??"").join("\t")).join("\n"); return head+"\n"+body+"\n"; }
async function ensureXLSX(){ if (window.XLSX) return; await new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
function bindExports(){
  document.getElementById("export-copy")?.addEventListener("click", async ()=>{
    const tsv = toTSV(getFilteredRows());
    try{ await navigator.clipboard.writeText(tsv); alert("Copié !"); }
    catch{ download("articles_filtrés.tsv", tsv, "text/tab-separated-values;charset=utf-8"); }
  });
  document.getElementById("export-csv")?.addEventListener("click", ()=>{
    download("articles_filtrés.csv", toCSV(getFilteredRows()));
  });
  document.getElementById("export-xlsx")?.addEventListener("click", async ()=>{
    await ensureXLSX();
    const data = getFilteredRows().map(r=>{ const o={}; CSV_HEADERS.forEach(h=>o[h]=r[h]??""); return o; });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, {cellDates:false});
    XLSX.utils.book_append_sheet(wb, ws, "Articles");
    XLSX.writeFile(wb, "articles_filtrés.xlsx");
  });
  document.getElementById("export-print")?.addEventListener("click", ()=> window.print());

  document.getElementById("export-csv-all")?.addEventListener("click", ()=>{
    download("articles_tout.csv", toCSV(getAllRows()));
  });
  document.getElementById("export-xlsx-all")?.addEventListener("click", async ()=>{
    await ensureXLSX();
    const data = getAllRows().map(r=>{ const o={}; CSV_HEADERS.forEach(h=>o[h]=r[h]??""); return o; });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, {cellDates:false});
    XLSX.utils.book_append_sheet(wb, ws, "Catalogue");
    XLSX.writeFile(wb, "articles_tout.xlsx");
  });
}

/* ========= Help ========= */
function bindHelp(){
  const d = document.getElementById("help-modal");
  document.getElementById("help-btn")?.addEventListener("click", ()=> d.showModal());
  document.getElementById("help-close")?.addEventListener("click", ()=> d.close());
}

/* ========= Auth ========= */
async function githubLoginInline(){
  const token = prompt("Collez votre token GitHub (scope: repo, contenu)");
  if (!token) return;
  localStorage.setItem("ghtoken", token); GHTOKEN = token;
  alert("Connecté à GitHub ✅");
  try{
    await saveToGitHubMerged(ARTICLES, "commit auto après connexion");
    alert("Modifications locales enregistrées.");
  }catch(e){ console.warn(e); }
}
function githubLogout(){ localStorage.removeItem("ghtoken"); GHTOKEN=""; render(); alert("Déconnecté."); }
function bindAuth(){
  document.getElementById("login-btn")?.addEventListener("click", githubLoginInline);
  document.getElementById("logout-btn")?.addEventListener("click", githubLogout);
}

/* ========= Phase 1: Normalisation + Duplicates ========= */
(function(){
  const deburr = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[.\u00B7·]/g," ").replace(/\s+/g," ").trim();
  const splitNames = s => (s||"").split(/;|,|\/|&| et |•|\u00B7/gi).map(x=>x.trim()).filter(Boolean);

  let CANON = { auteurs:new Map(), villes:new Map(), auteursList:[], villesList:[] };

  function buildCatalogs(){
    const countMap = (field) => {
      const freq = new Map();
      for (const r of (window.ARTICLES||[])){
        for (const name of splitNames(r[field])){
          if (!name) continue;
          const key = deburr(name);
          const prev = freq.get(key) || {forms:new Map(), total:0};
          prev.total++;
          prev.forms.set(name, (prev.forms.get(name)||0)+1);
          freq.set(key, prev);
        }
      }
      const canon = new Map();
      const list = [];
      for (const [key,info] of freq){
        let bestForm = "", bestCount = -1;
        for (const [form,c] of info.forms){
          if (c>bestCount || (c===bestCount && form.length>bestForm.length)){
            bestCount=c; bestForm=form;
          }
        }
        canon.set(key, bestForm);
        list.push(bestForm);
      }
      list.sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));
      return {canon, list};
    };

    const a = countMap("Auteur(s)");
    const v = countMap("Ville(s)");
    CANON = { auteurs:a.canon, villes:v.canon, auteursList:a.list, villesList:v.list };
    populateDatalists();
  }

  function populateDatalists(){
    const dlA = document.getElementById("dl-auteurs");
    const dlV = document.getElementById("dl-villes");
    if (dlA) dlA.innerHTML = CANON.auteursList.slice(0,1500).map(x=>`<option value="${x}">`).join("");
    if (dlV) dlV.innerHTML = CANON.villesList.slice(0,1500).map(x=>`<option value="${x}">`).join("");
  }

  function normaliseMulti(s, kind){
    const map = (kind==="auteurs") ? CANON.auteurs : CANON.villes;
    const parts = splitNames(s).map(x=>{
      const key = deburr(x);
      return map.get(key) || x;
    });
    const seen = new Set(); const out=[];
    for (const p of parts){ const k=deburr(p); if (!seen.has(k)){ seen.add(k); out.push(p); } }
    return out.join("; ");
  }

  function titleSimilarity(a,b){
    const ta = deburr(a).split(/\s+/).filter(Boolean);
    const tb = deburr(b).split(/\s+/).filter(Boolean);
    if (!ta.length || !tb.length) return 0;
    const setA=new Set(ta), setB=new Set(tb);
    let inter=0; for (const w of setA) if (setB.has(w)) inter++;
    const union = setA.size + setB.size - inter;
    const jacc = inter / union;
    const lenBonus = Math.min(ta.length,tb.length)/Math.max(ta.length,tb.length);
    return 0.7*jacc + 0.3*lenBonus;
  }
  function findSimilarTitle(row, excludeIndex=-1){
    let best = {idx:-1, score:0};
    const tNew = row["Titre"]||"";
    (window.ARTICLES||[]).forEach((r, i)=>{
      if (i===excludeIndex) return;
      let s = titleSimilarity(tNew, r["Titre"]||"");
      if (row["Année"] && r["Année"]===row["Année"]) s += 0.05;
      if (row["Numéro"] && (""+r["Numéro"]).trim()===((""+row["Numéro"]).trim())) s += 0.05;
      if (s>best.score) best={idx:i, score:s};
    });
    return best;
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    try{ buildCatalogs(); }catch(e){ console.warn("catalogs",e); }
    document.getElementById("a-auteurs")?.setAttribute("list","dl-auteurs");
    document.getElementById("a-villes")?.setAttribute("list","dl-villes");

    const form = document.getElementById("add-form");
    if (form){
      form.addEventListener("submit", (e)=>{
        const submitter = e.submitter?.id || "";
        if (submitter==="add-cancel") return;
        const a = document.getElementById("a-auteurs");
        const v = document.getElementById("a-villes");
        if (a) a.value = normaliseMulti(a.value, "auteurs");
        if (v) v.value = normaliseMulti(v.value, "villes");
      }, {capture:true});
    }
  });

  window.checkDuplicateBeforeAdd = function(row){
    const best = findSimilarTitle(row, -1);
    if (best.score >= 0.85){
      const msg = `Doublon probable (${Math.round(best.score*100)}%).\n`+
                  `Titre existant:\n- ${ARTICLES[best.idx]["Titre"]}\n\n`+
                  `Voulez-vous quand même créer un nouvel article ?\n`+
                  `(OK = créer, Annuler = revenir au formulaire)`;
      return confirm(msg);
    }
    return true;
  };

  window.normaliseRowFields = function(row){
    return {
      ...row,
      "Auteur(s)": normaliseMulti(row["Auteur(s)"], "auteurs"),
      "Ville(s)":  normaliseMulti(row["Ville(s)"],  "villes"),
    };
  };
})();

/* ========= Help & Auth & Init ========= */
function bindHelp(){
  const d = document.getElementById("help-modal");
  document.getElementById("help-btn")?.addEventListener("click", ()=> d.showModal());
  document.getElementById("help-close")?.addEventListener("click", ()=> d.close());
}
async function githubLoginInline(){
  const token = prompt("Collez votre token GitHub (scope: repo, contenu)");
  if (!token) return;
  localStorage.setItem("ghtoken", token); GHTOKEN = token;
  alert("Connecté à GitHub ✅");
  try{
    await saveToGitHubMerged(ARTICLES, "commit auto après connexion");
    alert("Modifications locales enregistrées.");
  }catch(e){ console.warn(e); }
}
function githubLogout(){ localStorage.removeItem("ghtoken"); GHTOKEN=""; render(); alert("Déconnecté."); }
function bindAuth(){
  document.getElementById("login-btn")?.addEventListener("click", githubLoginInline);
  document.getElementById("logout-btn")?.addEventListener("click", githubLogout);
}

async function init(){
  try{ ARTICLES = await fetchCSV(); }catch(e){ console.error(e); ARTICLES = []; }
  const years = uniqSorted(ARTICLES.map(r=>r["Année"]).filter(Boolean));
  document.getElementById("filter-annee").innerHTML = '<option value="">(toutes)</option>'+ years.map(y=>`<option value="${y}">${y}</option>`).join("");
  refreshNumeroOptions();
  bindFilters(); bindSorting(); bindPager(); bindExports(); bindHelp(); bindAuth();
  render();
}
document.addEventListener("DOMContentLoaded", init);
