// AHPV — Catalogue (+ listes) — Ajout : datalist Époque + "Mémoire n°" pour nouveaux numéros
// Inclut anti-cache léger pour éviter les versions en cache côté navigateur.

/* Config */
const GITHUB_USER   = "mich59139";
const GITHUB_REPO   = "AHPV";
const GITHUB_BRANCH = "main";
const CSV_PATH      = "data/articles.csv";
const AUTHORS_PATH  = "data/auteurs.csv";
const CITIES_PATH   = "data/villes.csv";
const THEMES_PATH   = "data/themes.csv";

/* URLs */
const RAW_ART = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${CSV_PATH}`;
const RAW_AUT = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${AUTHORS_PATH}`;
const RAW_VIL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${CITIES_PATH}`;
const RAW_THE = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${THEMES_PATH}`;
const API_ART = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${CSV_PATH}`;
const API_AUT = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${AUTHORS_PATH}`;
const API_VIL = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${CITIES_PATH}`;
const API_THE = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${THEMES_PATH}`;

/* Utils */
const debounce = (fn, ms=180)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); } };
const deburr   = s=>(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[.\u00B7·]/g," ").replace(/\s+/g," ").trim();
function splitMulti(s){ if(!s) return []; let x=String(s); x=x.replace(/\bet\b/gi,";"); [";",",","/","&","•","·"].forEach(sep=>{ x=x.split(sep).join(";"); }); return x.split(";").map(v=>v.trim()).filter(Boolean); }
const uniqSorted = arr => Array.from(new Set(arr)).sort((a,b)=>(""+a).localeCompare(""+b,"fr",{numeric:true}));
const withNoCache = url => url + (url.includes("?") ? "&" : "?") + "_=" + Date.now();

/* State */
let ARTICLES=[];
let FILTER_YEAR="", FILTER_NUM="", QUERY="";
let sortCol=null, sortDir="asc";
let currentPage=1, pageSize=50;
let editingIndex=-1;
let GHTOKEN = localStorage.getItem("ghtoken") || "";
let LISTS   = { auteurs:[], villes:[], themes:[] };
let CANON   = { auteurs:new Map(), villes:new Map() };

/* CSV helpers */
function parseCSV(text){
  text=(text||"").replace(/^\uFEFF/,"");
  const first=text.split(/\r?\n/,1)[0]||"";
  const d=(first.includes(";") && !first.includes(","))?";":",";
  const lines=text.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n");
  if(!lines.length) return [];
  const header=splitCSVLine(lines.shift(), d);
  const out=[];
  for(const ln of lines){
    if(!ln.trim()) continue;
    const row=splitCSVLine(ln, d);
    const o={}; header.forEach((h,i)=>o[h]=row[i]??"");
    out.push(o);
  }
  return out;
  function splitCSVLine(ln, d){
    const row=[]; let cur=""; let q=false;
    for(let i=0;i<ln.length;i++){
      const c=ln[i];
      if(q){
        if(c==='"' && ln[i+1]==='"'){ cur+='"'; i++; }
        else if(c==='"'){ q=false; }
        else cur+=c;
      }else{
        if(c==='"') q=true;
        else if(c===d){ row.push(cur); cur=""; }
        else cur+=c;
      }
    }
    row.push(cur);
    return row;
  }
}
function parseOneColCSV(text){
  text=(text||"").replace(/^\uFEFF/,"");
  const lines=text.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n").map(x=>x.trim()).filter(Boolean);
  if(!lines.length) return [];
  const head=(lines[0]||"").toLowerCase();
  const content=(/auteur|ville|th[eè]me/.test(head)) ? lines.slice(1) : lines;
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
function listToCSV(items, header){ return [header, ...items].join("\n")+"\n"; }

/* Fetch (anti-cache) */
async function fetchText(url){
  const r=await fetch(withNoCache(url), {cache:"no-store"});
  if(!r.ok) throw new Error("fetch "+url+" -> "+r.status);
  return r.text();
}
async function fetchCSVArticles(){
  const tries=[RAW_ART, CSV_PATH, API_ART+"#api"];
  for(const u of tries){
    try{
      if(u.endsWith("#api")){
        const res=await fetch(withNoCache(API_ART), {cache:"no-store"});
        if(!res.ok) throw new Error("api "+res.status);
        const j=await res.json();
        const content=atob((j.content||"").replace(/\n/g,""));
        return parseCSV(content);
      }else{
        const t=await fetchText(u);
        return parseCSV(t);
      }
    }catch(e){}
  }
  return [];
}
async function fetchCSVList(rawUrl, relPath){
  const API=`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${relPath}`;
  const tries=[rawUrl, relPath, API+"#api"];
  for(const u of tries){
    try{
      if(u.endsWith("#api")){
        const res=await fetch(withNoCache(API), {cache:"no-store"});
        if(!res.ok) throw new Error("api "+res.status);
        const j=await res.json();
        const content=atob((j.content||"").replace(/\n/g,""));
        return parseOneColCSV(content);
      }else{
        const t=await fetchText(u);
        return parseOneColCSV(t);
      }
    }catch(e){}
  }
  return [];
}

/* GitHub save */
async function getShaFor(apiUrl){
  const r=await fetch(apiUrl,{headers:{Authorization:`token ${GHTOKEN}` }});
  if(!r.ok) throw new Error("SHA introuvable "+apiUrl);
  const j=await r.json(); return j.sha;
}
async function saveToGitHubMerged(newRows, message="Mise à jour catalogue"){
  if(!GHTOKEN){ alert("Modifié localement. Cliquez 🔐 pour enregistrer ensuite."); return; }
  let sha; try{ sha=await getShaFor(API_ART);}catch{ sha=null; }
  const content=btoa(unescape(encodeURIComponent(toCSV(newRows))));
  const body={message, content, branch:GITHUB_BRANCH}; if(sha) body.sha=sha;
  const res=await fetch(API_ART,{method:"PUT",headers:{ "Content-Type":"application/json", Authorization:`token ${GHTOKEN}`}, body:JSON.stringify(body)});
  if(!res.ok) throw new Error("Échec commit");
}
async function saveListToGitHub(apiUrl, pathLabel, items, header){
  if(!GHTOKEN){ alert("Modifié localement. Cliquez 🔐 pour enregistrer ensuite."); return false; }
  let sha; try{ sha=await getShaFor(apiUrl);}catch{ sha=null; }
  const content=btoa(unescape(encodeURIComponent(listToCSV(items, header))));
  const body={message:`Mise à jour ${pathLabel}`, content, branch:GITHUB_BRANCH}; if(sha) body.sha=sha;
  const r=await fetch(apiUrl,{method:"PUT",headers:{ "Content-Type":"application/json", Authorization:`token ${GHTOKEN}`}, body:JSON.stringify(body)});
  if(!r.ok) throw new Error("Échec commit "+pathLabel);
  return true;
}

/* Canon & suggestions */
function buildCanonFromLists(){
  CANON.auteurs=new Map(LISTS.auteurs.map(x=>[deburr(x),x]));
  CANON.villes =new Map(LISTS.villes.map(x =>[deburr(x),x]));
}
function buildCanonFromArticles(){
  const countMap=(field)=>{
    const freq=new Map();
    for(const r of (ARTICLES||[])){
      for(const name of splitMulti(r[field]||"")){
        const key=deburr(name); const prev=freq.get(key)||{forms:new Map(), total:0};
        prev.total++; prev.forms.set(name,(prev.forms.get(name)||0)+1); freq.set(key,prev);
      }
    }
    const canon=new Map();
    for(const [key,info] of freq){
      let bestForm="", bestCount=-1;
      for(const [form,c] of info.forms){ if(c>bestCount || (c===bestCount && form.length>bestForm.length)){ bestCount=c; bestForm=form; } }
      canon.set(key,bestForm);
    }
    return canon;
  };
  CANON.auteurs=countMap("Auteur(s)");
  CANON.villes =countMap("Ville(s)");
}
function populateDatalists(){
  const dlA=document.getElementById("dl-auteurs");
  const dlV=document.getElementById("dl-villes");
  const dlT=document.getElementById("dl-themes");
  const dlE=document.getElementById("dl-epoques");
  if(dlA) dlA.innerHTML=(LISTS.auteurs.length?LISTS.auteurs:Array.from(CANON.auteurs.values())).slice(0,2000).map(x=>`<option value="${x}">`).join("");
  if(dlV) dlV.innerHTML=(LISTS.villes.length ?LISTS.villes :Array.from(CANON.villes.values())).slice(0,2000).map(x=>`<option value="${x}">`).join("");
  if(dlT) dlT.innerHTML=(LISTS.themes.length ?LISTS.themes :Array.from(new Set((ARTICLES||[]).flatMap(r=>splitMulti(r["Theme(s)"]||""))))).slice(0,2000).map(x=>`<option value="${x}">`).join("");
  if(dlE){
    const base = ["XXIe siècle","XXe siècle","XIXe siècle","XVIIIe siècle","XVIIe siècle","XVIe siècle","XVe siècle","XIVe siècle","XIIIe siècle","XIIe siècle","XIe siècle","Xe siècle","Moyen Âge","Antiquité","Préhistoire"];
    const fromData = Array.from(new Set((ARTICLES||[]).map(r=>(r["Epoque"]||"").trim()).filter(Boolean)));
    const all = uniqSorted(Array.from(new Set([...base, ...fromData])));
    dlE.innerHTML = all.map(x=>`<option value="${x}">`).join("");
  }
}
function normaliseMulti(s, kind){
  const map=(kind==="auteurs")?CANON.auteurs:CANON.villes;
  const parts=splitMulti(s).map(x=>map.get(deburr(x))||x);
  const seen=new Set(), out=[]; for(const p of parts){ const k=deburr(p); if(!seen.has(k)){ seen.add(k); out.push(p);} }
  return out.join("; ");
}
function normaliseRowFields(row){
  return { ...row,
    "Auteur(s)": normaliseMulti(row["Auteur(s)"], "auteurs"),
    "Ville(s)" : normaliseMulti(row["Ville(s)"],  "villes")
  };
}

/* Numéro → format "Mémoire n°XX" */
function formatNumero(v){
  v = (v||"").trim();
  if(!v) return v;
  // déjà "Mémoire n°"
  if(/^m[ée]moire\s*n[°º]?\s*/i.test(v)){
    v = v.replace(/^m[ée]moire\s*n[°º]?\s*/i, "").trim();
    return v ? `Mémoire n°${v}` : "Mémoire n°";
  }
  // "n° 12" → "Mémoire n°12"
  if(/^n[°º]\s*\d+$/i.test(v)) return `Mémoire n°${v.replace(/^n[°º]\s*/i,"")}`;
  // juste chiffres → "Mémoire n°XX"
  if(/^\d+$/.test(v)) return `Mémoire n°${v}`;
  // fallback
  return `Mémoire n°${v}`;
}

/* Doublons titre (simple) */
function titleSimilarity(a,b){
  const ta=deburr(a).split(/\s+/).filter(Boolean);
  const tb=deburr(b).split(/\s+/).filter(Boolean);
  if(!ta.length || !tb.length) return 0;
  const setA=new Set(ta), setB=new Set(tb);
  let inter=0; for(const w of setA) if(setB.has(w)) inter++;
  const union=setA.size+setB.size-inter;
  const jacc=inter/union;
  const lenBonus=Math.min(ta.length,tb.length)/Math.max(ta.length,tb.length);
  return 0.7*jacc+0.3*lenBonus;
}
function findSimilarTitle(row, excludeIndex=-1){
  let best={idx:-1, score:0}; const tNew=row["Titre"]||"";
  (ARTICLES||[]).forEach((r,i)=>{
    if(i===excludeIndex) return;
    let s=titleSimilarity(tNew, r["Titre"]||"");
    if(row["Année"] && r["Année"]===row["Année"]) s+=0.05;
    if(row["Numéro"] && (""+row["Numéro"]).trim()===((""+(r["Numéro"]||"")).trim())) s+=0.05;
    if(s>best.score) best={idx:i, score:s};
  });
  return best;
}
function checkDuplicateBeforeAdd(row){
  const best=findSimilarTitle(row, -1);
  if(best.score>=0.85){
    const msg=`Doublon probable (${Math.round(best.score*100)}%).\n`+
              `Titre existant :\n- ${ARTICLES[best.idx]["Titre"]}\n\n`+
              `Voulez-vous quand même créer un nouvel article ?\n`+
              `(OK = créer, Annuler = revenir au formulaire)`;
    return confirm(msg);
  }
  return true;
}

/* Rendu & filtre */
function showLoading(b){ document.getElementById("loading")?.classList.toggle("hidden", !b); }
function applyFilters(){
  let rows=ARTICLES.slice();
  if(FILTER_YEAR) rows=rows.filter(r=>(r["Année"]||"")===FILTER_YEAR);
  if(FILTER_NUM)  rows=rows.filter(r=>((""+(r["Numéro"]||"")).trim()===((""+FILTER_NUM).trim())));
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
function render(){
  const rows=applyFilters();
  const total=rows.length;
  const start=(currentPage-1)*pageSize;
  const page=rows.slice(start, start+pageSize);

  const tbody=document.getElementById("tbody");
  tbody.innerHTML=page.map((r,iOnPage)=>{
    const i=start+iOnPage;
    if(editingIndex!==i){
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
          <button class="del"  onclick="window._deleteRow?.(${i})" aria-label="Supprimer">🗑</button>
        </td>
      </tr>`;
    }else{
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
          <button onclick="window._inlineSave?.()"   aria-label="Enregistrer">💾</button>
          <button onclick="window._inlineCancel?.()" aria-label="Annuler">✖</button>
        </td>
      </tr>`;
    }
  }).join("");

  document.querySelectorAll("th[data-col]").forEach(th=>{
    th.classList.remove("sort-asc","sort-desc");
    if(th.dataset.col===sortCol) th.classList.add(sortDir==="asc"?"sort-asc":"sort-desc");
  });

  const pages=Math.max(1, Math.ceil
