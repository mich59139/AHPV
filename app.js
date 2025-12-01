// AHPV — Catalogue + mini-éditeur des listes + exports "Tout"
// Ajouts : Époques (datalist + filtre) • "Nouveau numéro…" + pré-rempli "Mémoire n°"
//          Anti-cache sur fetch • Datalists mises à jour en direct depuis "Listes"
//          Sauvegarde fluide (file d'attente) + badge d'état
//          FIX suppression/modif : on utilise l'index source (_i) même avec filtre/tri/pagination
//          fetchCSVArticles() affiche un diagnostic si le CSV est introuvable
// v2.0 : Support des nouveaux IDs HTML (add-article-btn, reset-filters, etc.)

/* ==== Config à adapter si besoin ==== */
const GITHUB_USER   = "mich59139";
const GITHUB_REPO   = "AHPV";
const GITHUB_BRANCH = "main";                 // ← mets "gh-pages" si besoin
const CSV_PATH      = "data/articles.csv";    // ← nom EXACT du fichier CSV
const AUTHORS_PATH  = "data/auteurs.csv";
const CITIES_PATH   = "data/villes.csv";
const THEMES_PATH   = "data/themes.csv";
const EPOQUES_PATH  = "data/epoques.csv";     // peut ne pas exister, on gère l'erreur

/* ==== Variables globales ==== */
let ARTICLES   = [];
let FILTER_YEAR   = "";
let FILTER_NUM    = "";
let FILTER_EPOQUE = "";
let QUERY  = "";
let sortCol = null;
let sortDir = "asc";
let currentPage=1, pageSize=50;
let editingIndex=-1;
let GHTOKEN = null;
let IS_SAVING = false;
let SAVE_QUEUE = [];
let LAST_SAVE_TIME = 0;
let AUTO_SAVE_SILENT = false;

let LISTS = { auteurs:[], villes:[], themes:[], epoques:[] };
let CANON   = { auteurs:new Map(), villes:new Map(), themes:new Map(), epoques:new Map() };

/* ==== Utilitaires ==== */
function debounce(fn, delay=300){
  let t;
  return (...args)=>{
    clearTimeout(t);
    t=setTimeout(()=>fn(...args),delay);
  };
}
function uniqSorted(arr){
  return Array.from(new Set(arr.filter(Boolean))).sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));
}
function fetchText(url){
  const bust = (url.includes("?") ? "&" : "?") + "_ts="+Date.now();
  return fetch(url + bust).then(r=>{
    if(!r.ok) throw new Error("HTTP "+r.status+" sur "+url);
    return r.text();
  });
}
function parseCSV(text){
  text=(text||"").replace(/^\uFEFF/,"");                       // BOM
  const lines=text.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n");
  if(!lines.length) return [];
  const head=lines[0].split(",").map(s=>s.trim());
  return lines.slice(1).filter(Boolean).map(line=>{
    const cols = splitCSVLine(line);
    const row={};
    head.forEach((h,i)=> row[h]=cols[i]??"");
    return row;
  });
}
function splitCSVLine(line){
  const out=[]; let cur=""; let q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(q){
      if(c==='"'){
        if(line[i+1]==='"'){ cur+='"'; i++; }
        else q=false;
      }else cur+=c;
    }else{
      if(c==='"') q=true;
      else if(c===","){ out.push(cur); cur=""; }
      else cur+=c;
    }
  }
  out.push(cur);
  return out;
}
function parseOneColCSV(text){
  text=(text||"").replace(/^\uFEFF/,"");
  const lines = text.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n").map(x=>x.trim()).filter(Boolean);
  if(!lines.length) return [];
  const head = (lines[0]||"").toLowerCase();
  const content = (/auteur|ville|th[eè]me|epoqu/.test(head)) ? lines.slice(1) : lines;
  return Array.from(new Set(content)).sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));
}
function toCSV(rows){
  const COLS=["Année","Numéro","Titre","Page(s)","Auteur(s)","Ville(s)","Theme(s)","Epoque"];
  const esc=s=>{ s=(s==null?"":(""+s)).replaceAll('"','""'); return /[",\n]/.test(s) ? `"${s}"` : s; };
  const head=COLS.join(",");
  const body=rows.map(r=>COLS.map(h=>esc(r[h])).join(",")).join("\n");
  return head+"\n"+body+"\n";
}
function toTSV(rows){
  const COLS=["Année","Numéro","Titre","Page(s)","Auteur(s)","Ville(s)","Theme(s)","Epoque"];
  const head=COLS.join("\t");
  const body=rows.map(r=>COLS.map(h=>r[h]??"").join("\t")).join("\n");
  return head+"\n"+body+"\n";
}
function normalizeNumeroInput(v){
  v=(v||"").trim();
  if(!v) return "";
  // Nettoie un peu les variantes "Memoire", "mémoire", etc.
  v=v.replace(/^\s*m[ée]moire\s*/i,"Mémoire ");
  return v;
}

/* ==== Badge de sauvegarde ==== */
function setupSaveBadge(){
  const saveBadge   = document.getElementById("status-save");
  const unsavedBadge= document.getElementById("status-unsaved");
  function setState(state){
    if(!saveBadge||!unsavedBadge) return;
    if(state==="saved"){
      saveBadge.classList.remove("hidden");
      unsavedBadge.classList.add("hidden");
    }else if(state==="unsaved"){
      saveBadge.classList.add("hidden");
      unsavedBadge.classList.remove("hidden");
    }else{
      saveBadge.classList.add("hidden");
      unsavedBadge.classList.add("hidden");
    }
  }
  window._setSaveState=setState;
}

/* ==== Auth GitHub + API ==== */
function getStoredToken(){ try{ return localStorage.getItem("ahpv_token")||null; }catch{ return null; } }
function storeToken(t){ try{ if(t) localStorage.setItem("ahpv_token", t); else localStorage.removeItem("ahpv_token"); }catch{} }

async function githubRequest(path, opts={}){
  if(!GHTOKEN) throw new Error("Pas de token GitHub");
  const res=await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/${path}`,{
    headers:{
      "Authorization":"token "+GHTOKEN,
      "Accept":"application/vnd.github+json"
    },
    ...opts
  });
  if(!res.ok){
    const txt=await res.text().catch(()=>"?");
    throw new Error("GitHub API "+res.status+" : "+txt);
  }
  return res.json();
}

async function fetchCSVArticles(){
  try{
    console.log("📋 Chargement des données...");
    const txt = await fetchText(CSV_PATH);
    const rows= parseCSV(txt);
    if(!rows || !rows.length){
      console.warn("⚠ CSV articles vide !");
    }
    ARTICLES = rows;
    console.log(`✅ ${ARTICLES.length} articles chargés`);
  }catch(err){
    console.error("❌ Erreur chargement CSV articles", err);
    alert("Impossible de charger le fichier des articles. Vérifiez le nom et le chemin.");
    ARTICLES = [];
  }
}

async function fetchList(path, kind){
  try{
    const txt=await fetchText(path);
    const list=parseOneColCSV(txt);
    LISTS[kind]=list;
    console.log(`✅ ${list.length} ${kind} chargés`);
  }catch(err){
    console.warn(`⚠ Impossible de charger ${kind} :`, err);
    LISTS[kind]=[];
  }
}

async function loadLists(){
  console.log("📝 Chargement des listes secondaires (non critique)...");
  await Promise.all([
    fetchList(AUTHORS_PATH,"auteurs"),
    fetchList(CITIES_PATH,"villes"),
    fetchList(THEMES_PATH,"themes"),
    fetchList(EPOQUES_PATH,"epoques").catch(err=>{
      console.warn("⚠ Impossible de charger époques :–", err);
      LISTS.epoques=[];
    })
  ]);
}

/* ==== Application des filtres et tri ==== */
function showLoading(b){ document.getElementById("loading")?.classList.toggle("hidden", !b); }

/* IMPORTANT: on renvoie les lignes + l'index source _i */
function applyFilters(){
  let rows = ARTICLES.map((r, idx) => ({ ...r, _i: idx }));
  if(FILTER_YEAR)   rows = rows.filter(r=>(r["Année"]||"")===FILTER_YEAR);
  if(FILTER_NUM)    rows = rows.filter(r=>((""+(r["Numéro"]||"")).trim()===((""+FILTER_NUM).trim())));
  if(FILTER_EPOQUE) rows = rows.filter(r=>(r["Epoque"]||"")===FILTER_EPOQUE);
  if(QUERY){
    const q=QUERY.toLowerCase();
    rows=rows.filter(r=>Object.values(r).some(v=>(v??"").toString().toLowerCase().includes(q)));
  }
  if(sortCol){
    const factor=sortDir==="desc"?-1:1;
    rows.sort((a,b)=> (""+(a[sortCol]??"")).localeCompare(""+(b[sortCol]??""),"fr",{numeric:true,sensitivity:"base"})*factor);
  }
  return rows;
}

/* ==== Rendu du tableau + pagination ==== */
function render(){
  const rows = applyFilters();
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  // Si la page courante dépasse le max (ex: après changement de pageSize)
  if (currentPage > pages) currentPage = pages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * pageSize;
  const page = rows.slice(start, start + pageSize);

  const tbody = document.getElementById("tbody");
  if (!tbody) return;

  if (!page.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding:20px; font-style:italic;">
          Aucun article ne correspond aux filtres actuels
          (catalogue complet : ${ARTICLES.length} article(s)).
        </td>
      </tr>`;
  } else {
    tbody.innerHTML = page.map((r) => {
      const i = r._i; // index réel dans ARTICLES
      if (editingIndex !== i) {
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
          <button class="edit" onclick="window._inlineEdit?.(${i})" aria-label="Modifier">✎</button>
          <button class="del"  onclick="window._askDelete?.(${i})" aria-label="Supprimer">🗑</button>
        </td>
      </tr>`;
      } else {
        return `
      <tr class="row editing">
        <td><input id="ei-annee"   autocomplete="off" value="${r["Année"]||""}" /></td>
        <td><input id="ei-numero"  autocomplete="off" value="${r["Numéro"]||""}" /></td>
        <td><input id="ei-titre"   autocomplete="off" value="${r["Titre"]||""}" /></td>
        <td><input id="ei-pages"   autocomplete="off" value="${r["Page(s)"]||""}" /></td>
        <td><input id="ei-auteurs" autocomplete="off" value="${r["Auteur(s)"]||""}" /></td>
        <td><input id="ei-villes"  autocomplete="off" value="${r["Ville(s)"]||""}" /></td>
        <td><input id="ei-themes"  autocomplete="off" value="${r["Theme(s)"]||""}" /></td>
        <td><input id="ei-epoque"  autocomplete="off" value="${r["Epoque"]||""}" /></td>
        <td class="actions">
          <button class="save"   onclick="window._inlineSave?.()"   aria-label="Enregistrer">💾</button>
          <button class="cancel" onclick="window._inlineCancel?.()" aria-label="Annuler">✖</button>
        </td>
      </tr>`;
      }
    }).join("");
  }

  // Tri visuel des en-têtes
  document.querySelectorAll("th[data-col]").forEach(th => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.col === sortCol) {
      th.classList.add(sortDir === "asc" ? "sort-asc" : "sort-desc");
    }
  });

  // Infos de pagination
  const pageInfo = document.getElementById("pageinfo");
  if (pageInfo) {
    pageInfo.textContent = `${currentPage} / ${pages} — ${total} article(s)`;
  }

  // Boutons précédent / suivant / première / dernière
  const prevBtn  = document.getElementById("prev");
  const nextBtn  = document.getElementById("next");
  const firstBtn = document.getElementById("first");
  const lastBtn  = document.getElementById("last");

  if (prevBtn)  prevBtn.disabled  = currentPage <= 1;
  if (firstBtn) firstBtn.disabled = currentPage <= 1;
  if (nextBtn)  nextBtn.disabled  = currentPage >= pages;
  if (lastBtn)  lastBtn.disabled  = currentPage >= pages;

  // Petits numéros de pages (au centre)
  const pn = document.getElementById("page-numbers");
  if (pn) {
    pn.innerHTML = "";
    const maxButtons = 7;
    let startPage = Math.max(1, currentPage - 3);
    let endPage   = Math.min(pages, startPage + maxButtons - 1);
    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }
    for (let p = startPage; p <= endPage; p++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn ghost page-num" + (p === currentPage ? " active" : "");
      btn.textContent = String(p);
      btn.dataset.page = String(p);
      btn.addEventListener("click", () => {
        currentPage = p;
        render();
      });
      pn.appendChild(btn);
    }
  }

  // Total global
  const totalLabel = document.getElementById("total-count");
  if (totalLabel) {
    totalLabel.textContent = `Total : ${ARTICLES.length} article(s)`;
  }

  const sc=document.getElementById("status-count"); if(sc) sc.textContent=`Fichier: ✅ (${ARTICLES.length})`;
  const sa=document.getElementById("status-auth");  if(sa) sa.textContent= GHTOKEN ? "🔐 Connecté" : "🔓 Invité";
}

/* ==== Inline edit ==== */
window._editRow=(idx)=>{ try{ if(matchMedia("(max-width:800px)").matches) _inlineEdit(idx); }catch{ _inlineEdit(idx); } };
window._inlineEdit=(idx)=>{
  editingIndex=idx; render();
  setTimeout(()=>document.getElementById("ei-titre")?.focus(),0);
  const ids=["ei-annee","ei-numero","ei-titre","ei-pages","ei-auteurs","ei-villes","ei-themes","ei-epoque"];
  const scheduleSave=debounce(()=>{ try{ AUTO_SAVE_SILENT=true; window._inlineSave?.(); } finally { AUTO_SAVE_SILENT=false; } }, 800);
  ids.forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    el.addEventListener("change", scheduleSave,{passive:true});
    el.addEventListener("input",  scheduleSave,{passive:true});
  });
};
window._inlineCancel=()=>{ editingIndex=-1; render(); };
window._inlineSave=async ()=>{
  if(editingIndex<0) return;
  const row=ARTICLES[editingIndex];
  const g=id=>document.getElementById(id)?.value?.trim()||"";
  row["Année"]  = g("ei-annee");
  row["Numéro"] = g("ei-numero");
  row["Titre"]  = g("ei-titre");
  row["Page(s)"]= g("ei-pages");
  row["Auteur(s)"]=g("ei-auteurs");
  row["Ville(s)"]  =g("ei-villes");
  row["Theme(s)"]  =g("ei-themes");
  row["Epoque"]    =g("ei-epoque");
  editingIndex=-1;
  window._setSaveState?.("unsaved");
  render();
  if(!AUTO_SAVE_SILENT){
    try{
      await queueSave();
      showToast("Modifications enregistrées sur GitHub","success");
    }catch(err){
      console.error("Erreur de sauvegarde inline", err);
      showToast("Erreur de sauvegarde sur GitHub","error");
    }
  }
};

/* ==== Filtres & tri ==== */
function refreshYearOptions(){
  const ya=document.getElementById("filter-annee");
  if(!ya) return;
  const years=uniqSorted(ARTICLES.map(r=>r["Année"]).filter(Boolean));
  const cur=ya.value;
  ya.innerHTML='<option value="">(toutes)</option>'+years.map(y=>`<option value="${y}">${y}</option>`).join("");
  if(years.includes(cur)) ya.value=cur; else ya.value="";
}
function getNumbersForYear(year){
  const set=new Set();
  for(const r of ARTICLES){
    if(!year || (r["Année"]||"")===year){
      const n=(""+(r["Numéro"]||"")).trim();
      if(n) set.add(n);
    }
  }
  const nums=Array.from(set);
  nums.sort((a,b)=>(""+a).localeCompare(""+b,"fr",{numeric:true}));
  return nums;
}
function refreshNumeroOptions(){
  const fn=document.getElementById("filter-numero");
  if(!fn) return;
  const year=document.getElementById("filter-annee")?.value||"";
  const nums=getNumbersForYear(year);
  const cur=fn.value;
  fn.innerHTML='<option value="">(tous)</option>'+nums.map(n=>`<option value="${n}">${n}</option>`).join("");
  if(nums.includes(cur)) fn.value=cur; else fn.value="";
}
function refreshEpoqueOptions(){
  const fe=document.getElementById("filter-epoque");
  if(!fe) return;
  const src = LISTS.epoques.length ? LISTS.epoques : Array.from(new Set((ARTICLES||[]).map(r=>r["Epoque"]).filter(Boolean)));
  fe.innerHTML = '<option value="">(toutes)</option>' + uniqSorted(src).map(e=>`<option value="${e}">${e}</option>`).join("");
}
function resetAllFilters(){
  document.getElementById("filter-annee").value="";
  document.getElementById("filter-numero").value="";
  document.getElementById("filter-epoque").value="";
  document.getElementById("search").value="";
  FILTER_YEAR=""; FILTER_NUM=""; FILTER_EPOQUE=""; QUERY="";
  sortCol=null; sortDir="asc"; currentPage=1;
  refreshNumeroOptions(); render();
}
function bindFilters(){
  const fy=document.getElementById("filter-annee");
  const fn=document.getElementById("filter-numero");
  const fe=document.getElementById("filter-epoque");
  const q =document.getElementById("search");
  fy?.addEventListener("change", ()=>{
    FILTER_YEAR=fy.value;
    if(!FILTER_YEAR){ fn.value=""; FILTER_NUM=""; }
    refreshNumeroOptions(); currentPage=1; render();
  });
  fn?.addEventListener("change", ()=>{ FILTER_NUM=fn.value; currentPage=1; render(); });
  fe?.addEventListener("change", ()=>{ FILTER_EPOQUE=fe.value; currentPage=1; render(); });
  if(q){
    const updateQ=debounce(()=>{
      QUERY=q.value.trim();
      currentPage=1; render();
    },200);
    q.addEventListener("input", updateQ);
  }
  document.getElementById("reset-filters")?.addEventListener("click", resetAllFilters);
}
function bindSorting(){
  document.querySelectorAll("th[data-col]").forEach(th=>{
    th.addEventListener("click", ()=>{
      const col=th.dataset.col;
      if(sortCol===col) sortDir=(sortDir==="asc"?"desc":"asc");
      else{ sortCol=col; sortDir="asc"; }
      currentPage=1;
      render();
    });
    th.addEventListener("keypress",(e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); th.click(); } });
  });
}

/* ==== Pagination : boutons + select "page-size" ==== */
function bindPager(){
  // boutons précédent / suivant
  const prevBtn = document.getElementById("prev");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        render();
      }
    });
  }

  const nextBtn = document.getElementById("next");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      currentPage++;
      render();
    });
  }

  // bouton première page
  const firstBtn = document.getElementById("first");
  if (firstBtn) {
    firstBtn.addEventListener("click", () => {
      currentPage = 1;
      render();
    });
  }

  // bouton dernière page
  const lastBtn = document.getElementById("last");
  if (lastBtn) {
    lastBtn.addEventListener("click", () => {
      const total = applyFilters().length;
      const pages = Math.max(1, Math.ceil(total / pageSize));
      currentPage = pages;
      render();
    });
  }

  // sélecteur "articles par page"
  const sizeSelect = document.getElementById("page-size");
  if (sizeSelect) {
    // valeur initiale depuis le HTML
    const initial = parseInt(sizeSelect.value, 10);
    if (!isNaN(initial) && initial > 0) {
      pageSize = initial;
    } else {
      sizeSelect.value = String(pageSize);
    }

    sizeSelect.addEventListener("change", (e) => {
      const v = parseInt(e.target.value, 10);
      if (!isNaN(v) && v > 0) {
        pageSize = v;
        currentPage = 1; // on repart du début
        render();
      }
    });
  }
}

/* ==== Exports ==== */
async function ensureXLSX(){ if(window.XLSX) return; await new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
function download(name, text, mime="text/csv;charset=utf-8"){
  const blob=new Blob([text],{type:mime}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href);
}
function getFilteredRows(){ return applyFilters(); }
function getAllRows(){ return ARTICLES.slice(); }
function bindExports(){
  document.getElementById("export-copy")?.addEventListener("click", async ()=>{
    const tsv=toTSV(getFilteredRows());
    try{ await navigator.clipboard.writeText(tsv); alert("Copié !"); }
    catch{ download("articles_filtrés.tsv", tsv, "text/tab-separated-values;charset=utf-8"); }
  });
  document.getElementById("export-csv")?.addEventListener("click", ()=> download("articles_filtrés.csv", toCSV(getFilteredRows())));
  document.getElementById("export-xlsx")?.addEventListener("click", async ()=>{
    await ensureXLSX();
    const COLS=["Année","Numéro","Titre","Page(s)","Auteur(s)","Ville(s)","Theme(s)","Epoque"];
    const data=getFilteredRows().map(r=>{ const o={}; COLS.forEach(h=>o[h]=r[h]??""); return o; });
    const wb=XLSX.utils.book_new(); const ws=XLSX.utils.json_to_sheet(data,{cellDates:false});
    XLSX.utils.book_append_sheet(wb, ws, "Articles"); XLSX.writeFile(wb, "articles_filtrés.xlsx");
  });
  document.getElementById("export-print")?.addEventListener("click", ()=>window.print());
  document.getElementById("export-csv-all")?.addEventListener("click", ()=> download("articles_tous.csv", toCSV(getAllRows())));
  document.getElementById("export-xlsx-all")?.addEventListener("click", async ()=>{
    await ensureXLSX();
    const COLS=["Année","Numéro","Titre","Page(s)","Auteur(s)","Ville(s)","Theme(s)","Epoque"];
    const data=getAllRows().map(r=>{ const o={}; COLS.forEach(h=>o[h]=r[h]??""); return o; });
    const wb=XLSX.utils.book_new(); const ws=XLSX.utils.json_to_sheet(data,{cellDates:false});
    XLSX.utils.book_append_sheet(wb, ws, "Articles"); XLSX.writeFile(wb, "articles_tous.xlsx");
  });
}

/* ==== Toast ==== */
function showToast(msg, type="info"){
  const cont=document.getElementById("toast-container");
  if(!cont) return alert(msg);
  const div=document.createElement("div");
  div.className="toast toast-"+type;
  div.textContent=msg;
  cont.appendChild(div);
  setTimeout(()=>{ div.style.opacity="0"; setTimeout(()=>div.remove(),400); }, 3000);
}

/* ==== Auth UI ==== */
function bindAuth(){
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn= document.getElementById("logout-btn");
  function refreshStatus(){
    const sa=document.getElementById("status-auth");
    if(sa) sa.textContent = GHTOKEN ? "🔐 Connecté" : "🔓 Invité";
  }
  loginBtn?.addEventListener("click", ()=>{
    const t=prompt("Collez ici un token GitHub (scope: repo). Il sera stocké dans localStorage.");
    if(!t) return;
    GHTOKEN=t.trim(); storeToken(GHTOKEN); refreshStatus();
    showToast("Token enregistré localement.","success");
  });
  logoutBtn?.addEventListener("click", ()=>{
    if(!confirm("Supprimer le token GitHub local ?")) return;
    GHTOKEN=null; storeToken(null); refreshStatus();
  });
  GHTOKEN=getStoredToken();
  refreshStatus();
}

/* ==== Sauvegarde sur GitHub (queue) ==== */
async function queueSave(){
  return new Promise((resolve,reject)=>{
    SAVE_QUEUE.push({resolve,reject});
    processQueue();
  });
}
async function processQueue(){
  if(IS_SAVING || !SAVE_QUEUE.length) return;
  IS_SAVING=true;
  const job=SAVE_QUEUE[0];
  try{
    const now=Date.now();
    if(now-LAST_SAVE_TIME<1000) await new Promise(r=>setTimeout(r,1000-(now-LAST_SAVE_TIME)));
    await saveToGitHub();
    LAST_SAVE_TIME=Date.now();
    window._setSaveState?.("saved");
    job.resolve();
  }catch(err){
    job.reject(err);
  }finally{
    SAVE_QUEUE.shift();
    IS_SAVING=false;
    if(SAVE_QUEUE.length) processQueue();
  }
}
async function saveToGitHub(){
  if(!GHTOKEN) throw new Error("Pas de token GitHub");
  const path=`contents/${CSV_PATH}`;
  const meta=await githubRequest(path, {method:"GET"});
  const sha=meta.sha;
  const content=btoa(unescape(encodeURIComponent(toCSV(ARTICLES))));
  const body={message:"Maj catalogue articles", content, sha, branch:GITHUB_BRANCH};
  await githubRequest(path, {method:"PUT", body:JSON.stringify(body)});
}

/* ==== Gestion suppression ==== */
window._askDelete=(idx)=>{
  const row=ARTICLES[idx];
  const dlg=document.getElementById("confirm-modal");
  if(!dlg) return;
  document.getElementById("confirm-title").textContent=row["Titre"]||"(sans titre)";
  dlg.returnValue="cancel";
  dlg.showModal();
  const confirmBtn=document.getElementById("confirm-delete");
  const cancelBtn =document.getElementById("confirm-cancel");
  const onConfirm=(e)=>{
    e.preventDefault();
    dlg.close("delete");
    confirmBtn.removeEventListener("click",onConfirm);
    cancelBtn.removeEventListener("click",onCancel);
    doDelete(idx);
  };
  const onCancel=()=>{
    dlg.close("cancel");
    confirmBtn.removeEventListener("click",onConfirm);
    cancelBtn.removeEventListener("click",onCancel);
  };
  confirmBtn.addEventListener("click",onConfirm);
  cancelBtn.addEventListener("click",onCancel);
};
async function doDelete(idx){
  ARTICLES.splice(idx,1);
  window._setSaveState?.("unsaved");
  render();
  try{
    await queueSave();
    showToast("Article supprimé et sauvegardé sur GitHub","success");
  }catch(err){
    console.error("Erreur suppression",err);
    showToast("Erreur de sauvegarde après suppression","error");
  }
}

/* ==== Modale ajout + listes (datalists) ==== */
function refreshDatalists(){
  const dlA=document.getElementById("dl-auteurs");
  const dlV=document.getElementById("dl-villes");
  const dlT=document.getElementById("dl-themes");
  const dlE=document.getElementById("dl-epoques");
  if(dlA) dlA.innerHTML = LISTS.auteurs.map(v=>`<option value="${v}"></option>`).join("");
  if(dlV) dlV.innerHTML = LISTS.villes.map(v=>`<option value="${v}"></option>`).join("");
  if(dlT) dlT.innerHTML = LISTS.themes.map(v=>`<option value="${v}"></option>`).join("");
  if(dlE) dlE.innerHTML = LISTS.epoques.map(v=>`<option value="${v}"></option>`).join("");
}
window._openAddModal=()=>{
  const dlg=document.getElementById("add-modal");
  if(!dlg) return;
  document.getElementById("a-annee").value="";
  document.getElementById("a-numero").value="";
  document.getElementById("a-numero-new").value="";
  document.getElementById("a-titre").value="";
  document.getElementById("a-pages").value="";
  document.getElementById("a-auteurs").value="";
  document.getElementById("a-villes").value="";
  document.getElementById("a-themes").value="";
  document.getElementById("a-epoque").value="";
  refreshAddNumeroOptions();
  dlg.showModal();
};

function findPotentialDuplicate(newArticle){
  const titre=(newArticle["Titre"]||"").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"");
  if(!titre) return null;
  let best=null;
  ARTICLES.forEach((a,idx)=>{
    const t=(a["Titre"]||"").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"");
    const dist=levenshtein(titre,t);
    if(dist<=5){
      if(!best || dist<best.dist) best={idx, dist};
    }
  });
  return best;
}
function levenshtein(a,b){
  const m=a.length, n=b.length;
  const dp=Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++) dp[i][0]=i;
  for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++){
    for(let j=1;j<=n;j++){
      const cost=(a[i-1]===b[j-1])?0:1;
      dp[i][j]=Math.min(
        dp[i-1][j]+1,
        dp[i][j-1]+1,
        dp[i-1][j-1]+cost
      );
    }
  }
  return dp[m][n];
}
function shouldWarnDuplicate(newArticle){
  const best=findPotentialDuplicate(newArticle);
  if(best && best.dist>0){
    const msg = `⚠ Un article très proche existe déjà (distance=${best.dist}).\n\n`+
                `Titre nouveau :\n- ${newArticle["Titre"]}\n\n`+
                `Titre existant :\n- ${ARTICLES[best.idx]["Titre"]}\n\n`+
                `Voulez-vous quand même créer un nouvel article ?\n`+
                `(OK = créer, Annuler = revenir au formulaire)`;
    return confirm(msg);
  }
  return true;
}

/* ==== Listes (mini-éditeur) ==== */
function ensureCanonMaps(){
  for(const kind of ["auteurs","villes","themes","epoques"]){
    const canon=CANON[kind];
    for(const v of LISTS[kind]){
      const key=v.toLowerCase();
      if(!canon.has(key)) canon.set(key, v);
    }
  }
}
function updateCanonWithNew(kind, value){
  const key=value.toLowerCase();
  const canon=CANON[kind];
  if(!canon.has(key)) canon.set(key,value);
}
function bindListsEditor(){
  const dlg=document.getElementById("lists-modal");
  if(!dlg) return;
  const btn=document.getElementById("lists-btn");
  const tabs=[...dlg.querySelectorAll(".tab")];
  const countSpan=document.getElementById("list-count");
  const input=document.getElementById("list-input");
  const addBtn=document.getElementById("list-add");
  const sortBtn=document.getElementById("list-sort");
  const dedupeBtn=document.getElementById("list-dedupe");
  const importBtn=document.getElementById("list-import");
  const exportBtn=document.getElementById("list-export");
  const fileInp=document.getElementById("list-file");
  const itemsUL=document.getElementById("list-items");
  const saveBtn=document.getElementById("list-save");
  const closeBtn=document.getElementById("list-close");
  let currentKind="auteurs";
  let WORK=[];
  function refresh(){
    itemsUL.innerHTML=WORK.map((v,i)=>`<li data-i="${i}"><span>${v}</span><button class="edit" data-i="${i}">✎</button><button class="del" data-i="${i}">🗑</button></li>`).join("");
    if(countSpan) countSpan.textContent=`${WORK.length} élément(s)`;
  }
  function setKind(kind){
    currentKind=kind;
    tabs.forEach(t=>t.classList.toggle("active", t.dataset.kind===kind));
    WORK=[...LISTS[kind]];
    refresh();
  }
  function previewListsToUI(){
    refreshDatalists();
    refreshEpoqueOptions();
  }
  function renameAt(i){
    const old=WORK[i];
    const v=prompt("Renommer :", old);
    if(!v) return;
    WORK[i]=v.trim();
    refresh();
    previewListsToUI();
  }

  btn.addEventListener("click", ()=>{
    ensureCanonMaps();
    setKind("auteurs");
    previewListsToUI();
    dlg.showModal();
  });
  closeBtn.addEventListener("click", ()=> dlg.close());
  tabs.forEach(t=> t.addEventListener("click", ()=> setKind(t.dataset.kind)));

  addBtn.addEventListener("click", ()=>{
    const v=(input.value||"").trim(); if(!v) return;
    if(!WORK.some(x=>x.toLowerCase()===v.toLowerCase())) WORK.push(v);
    input.value=""; refresh(); previewListsToUI();
  });
  input.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); addBtn.click(); } });

  itemsUL.addEventListener("click",(e)=>{
    const ed=e.target.closest(".edit"); if(ed){ renameAt(+ed.dataset.i); return; }
    const del=e.target.closest(".del"); if(del){ const i=+del.dataset.i; WORK.splice(i,1); refresh(); previewListsToUI(); }
  });
  itemsUL.addEventListener("dblclick",(e)=>{
    const li=e.target.closest("li[data-i]"); if(!li) return; renameAt(+li.dataset.i);
  });

  sortBtn.addEventListener("click", ()=>{
    WORK.sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"})); 
    refresh(); previewListsToUI();
  });
  dedupeBtn.addEventListener("click", ()=>{
    const seen=new Set(); const out=[]; 
    for(const v of WORK){ 
      const k=v.toLowerCase(); 
      if(!seen.has(k)){ seen.add(k); out.push(v); } 
    }
    WORK=out; refresh(); previewListsToUI();
  });

  importBtn.addEventListener("click", ()=> fileInp.click());
  fileInp.addEventListener("change", async ()=>{
    const f=fileInp.files?.[0]; if(!f) return;
    const txt=await f.text(); const list=parseOneColCSV(txt);
    WORK=uniqSorted(list);
    refresh(); previewListsToUI();
    fileInp.value="";
  });
  exportBtn.addEventListener("click", ()=>{
    const txt=WORK.join("\n")+"\n";
    download(`liste_${currentKind}.csv`, txt, "text/csv;charset=utf-8");
  });
  saveBtn.addEventListener("click", async ()=>{
    LISTS[currentKind]=uniqSorted(WORK);
    previewListsToUI();
    dlg.close();
    showToast("Listes mises à jour côté navigateur. (À sauvegarder manuellement en CSV si besoin)", "info");
  });
}

/* ==== Nouveaux IDs HTML (boutons etc.) ==== */
function bindNewButtons(){
  // Bouton "Ajouter un article"
  const addBtn = document.getElementById("add-article-btn");
  if(addBtn) addBtn.addEventListener("click", window._openAddModal);
  
  // Bouton "Réinitialiser les filtres"
  const resetBtn = document.getElementById("reset-filters");
  if(resetBtn) resetBtn.addEventListener("click", resetAllFilters);
  
  // Listeners pour le formulaire d'ajout
  const addCancel = document.getElementById("add-cancel");
  if(addCancel) addCancel.addEventListener("click",()=>document.getElementById("add-modal")?.close());
  
  const addForm = document.getElementById("add-form");
  if(addForm){
    addForm.addEventListener("submit", async (e)=>{
      e.preventDefault();
      const selEl=document.getElementById("a-numero");
      let numVal="";
      if(selEl && selEl.tagName==="SELECT"){
        const selVal=selEl.value;
        numVal = (selVal==="__NEW__") ? normalizeNumeroInput(document.getElementById("a-numero-new")?.value || "") : selVal;
      }else{
        numVal = normalizeNumeroInput(document.getElementById("a-numero")?.value || "");
      }

      const newArticle={
        "Année":  document.getElementById("a-annee").value.trim(),
        "Numéro": numVal,
        "Titre":  document.getElementById("a-titre").value.trim(),
        "Page(s)":document.getElementById("a-pages").value.trim(),
        "Auteur(s)":document.getElementById("a-auteurs").value.trim(),
        "Ville(s)": document.getElementById("a-villes").value.trim(),
        "Theme(s)": document.getElementById("a-themes").value.trim(),
        "Epoque":   document.getElementById("a-epoque").value.trim()
      };

      if(!newArticle["Année"] || !newArticle["Numéro"] || !newArticle["Titre"]){
        alert("Année, Numéro et Titre sont obligatoires.");
        return;
      }

      if(!shouldWarnDuplicate(newArticle)) return;

      ARTICLES.push(newArticle);
      window._setSaveState?.("unsaved");
      document.getElementById("add-modal").close();
      refreshYearOptions();
      refreshNumeroOptions();
      refreshEpoqueOptions();
      render();
      try{
        await queueSave();
        showToast("Nouvel article ajouté et sauvegardé sur GitHub","success");
      }catch(err){
        console.error("Erreur sauvegarde nouvel article", err);
        showToast("Erreur de sauvegarde sur GitHub","error");
      }
    });
  }
}

/* ==== Aide ==== */
function bindHelp(){
  const dlg=document.getElementById("help-modal");
  if(!dlg) return;
  const btn=document.getElementById("help-btn");
  const closeBtn=document.getElementById("help-close");
  btn?.addEventListener("click", ()=> dlg.showModal());
  closeBtn?.addEventListener("click", ()=> dlg.close());
}

/* ==== Initialisation ==== */
async function init(){
  try{
    showLoading(true);
    await fetchCSVArticles();
    await loadLists();

    ensureCanonMaps();
    refreshDatalists();
    refreshYearOptions();
    refreshNumeroOptions();
    refreshEpoqueOptions();

    bindFilters(); 
    bindSorting(); 
    bindPager(); 
    bindExports(); 
    bindHelp(); 
    bindAuth(); 
    bindListsEditor();
    bindNewButtons(); // ← NOUVEAU : gère les nouveaux IDs HTML
    setupSaveBadge();
    render();
    
    console.log("✅ Application initialisée avec succès");
  }catch(err){
    console.error("INIT FAILED", err);
    alert("Erreur de chargement de la page. Voir la console pour les détails.");
  }finally{
    showLoading(false);
  }
}
if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded", init); } else { init(); }
