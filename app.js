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
const CSV_PATH      = "data/articles.csv";    // ← nom EXACT du fichier articles
const AUTHORS_PATH  = "data/auteurs.csv";
const CITIES_PATH   = "data/villes.csv";
const THEMES_PATH   = "data/themes.csv";
const EPOCHS_PATH   = "data/epoques.csv";

/* URLs */
const RAW_ART   = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${CSV_PATH}`;
const RAW_AUTH  = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${AUTHORS_PATH}`;
const RAW_CITY  = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${CITIES_PATH}`;
const RAW_THEME = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${THEMES_PATH}`;
const RAW_EPOCH = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${EPOCHS_PATH}`;
const API_ART   = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${CSV_PATH}`;
const API_AUTH  = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${AUTHORS_PATH}`;
const API_CITY  = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${CITIES_PATH}`;
const API_THEME = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${THEMES_PATH}`;
const API_EPOCH = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${EPOCHS_PATH}`;

/* Auth */
let GHTOKEN = localStorage.getItem("ghtoken") || "";

/* État global */
let ARTICLES = [];          // catalogue complet
let FILTERS  = {            // filtres actifs
  text: "",
  annee: "",
  numero: "",
  ville: "",
  theme: "",
  epoque: ""
};
let pageSize     = 25;
let currentPage  = 1;
let editingIndex = -1;      // index source (_i) en édition inline
let SORT         = { col: "annee", dir: 1 }; // tri simple

// Listes (auteurs, villes, thèmes, époques)
const LISTS = {
  auteurs: [],
  villes:  [],
  themes:  [],
  epoques: []
};

// Formes canoniques pour normaliser
const CANON = {
  auteurs: new Map(), // deburr(nom) → forme canonique
  villes:  new Map()
};

// File d'attente de sauvegarde
let SAVE_QUEUE = [];
let IS_SAVING  = false;
let AUTO_SAVE_SILENT = false;

/* ==== Utilitaires ==== */
function deburr(str){
  if(!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase();
}
function uniq(arr){
  return Array.from(new Set(arr.filter(Boolean)));
}
function debounce(fn, delay=400){
  let t;
  return (...args)=>{
    clearTimeout(t);
    t=setTimeout(()=>fn(...args), delay);
  };
}
function toast(msg){
  const el=document.getElementById("toast");
  if(!el){ alert(msg); return; }
  el.textContent=msg;
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),3500);
}

/* ==== CSV helpers ==== */
function parseCSV(text){
  // CSV simple, séparateur ";", guillemets "
  const lines=text.replace(/\r\n/g,"\n").split(/\n+/).filter(Boolean);
  if(!lines.length) return [];
  const headers=lines[0].split(";").map(h=>h.trim());
  return lines.slice(1).map(line=>{
    const cols=line.split(";"); // simple
    const obj={};
    headers.forEach((h,i)=>obj[h]=cols[i]!==undefined ? cols[i].trim(): "");
    return obj;
  });
}
function toCSV(rows){
  const headers=[
    "Année","Numéro","Titre","Page(s)",
    "Auteur(s)","Ville(s)","Theme(s)","Epoque"
  ];
  const lines=[headers.join(";")];
  rows.forEach(r=>{
    const row=headers.map(h=>{
      let v=r[h] ?? "";
      v=(""+v).replace(/"/g,'""');
      if(v.includes(";") || v.includes('"')) v=`"${v}"`;
      return v;
    }).join(";");
    lines.push(row);
  });
  return lines.join("\n");
}

/* ==== fetch CSV (avec anti-cache) ==== */
async function fetchText(url){
  const cacheBuster = `_=${Date.now()}`;
  const sep = url.includes("?") ? "&" : "?";
  const full = `${url}${sep}${cacheBuster}`;
  const res = await fetch(full, { cache:"no-store" });
  if(!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return await res.text();
}

async function fetchCSVArticles(){
  try{
    console.log("📋 Chargement des données...");
    const txt=await fetchText(RAW_ART);
    const rows=parseCSV(txt);
    if(!rows.length){
      toast("⚠ Fichier CSV vide ou entêtes manquantes");
    }
    console.log(`✅ ${rows.length} articles chargés`);
    return rows;
  }catch(e){
    console.error(e);
    toast("❌ Impossible de charger le catalogue (articles.csv). Vérifiez le dépôt / chemin.");
    return [];
  }
}

async function fetchCSVList(url, labelForLog){
  try{
    console.log(`📝 Chargement des listes secondaires (non critique)...`);
    const txt=await fetchText(url);
    const lines=txt.replace(/\r\n/g,"\n").split(/\n+/).map(l=>l.trim()).filter(Boolean);
    // on suppose une 1ère ligne d'entête facultative : "Nom" / "Valeur"
    const data = (lines.length && /;/.test(lines[0]))
      ? lines.slice(1).map(l=>l.split(";")[0].trim()).filter(Boolean)
      : lines;
    console.log(`✅ ${data.length} ${labelForLog} chargés`);
    return uniq(data);
  }catch(e){
    console.warn(`⚠ Impossible de charger ${labelForLog} :`, e);
    toast(`ℹ ${labelForLog} non disponibles (fichier manquant ?).`);
    return [];
  }
}

/* ==== Normalisation des champs auteurs / villes / thèmes / époques ==== */
function normaliseMulti(str, canonMap){
  if(!str) return "";
  const parts = str
    .split(/[;,]/)
    .map(s=>s.trim())
    .filter(Boolean);

  const norm = parts.map(p=>{
    const key=deburr(p);
    if(canonMap.has(key)) return canonMap.get(key);
    return p;
  });

  return uniq(norm).join("; ");
}

function normaliseRowFields(row){
  const r={...row};
  r["Auteur(s)"] = normaliseMulti(r["Auteur(s)"], CANON.auteurs);
  r["Ville(s)"]  = normaliseMulti(r["Ville(s)"],  CANON.villes);
  // Theme(s) + Epoque : pour l'instant texte libre
  return r;
}

/* ==== Tri & filtres ==== */
function rowMatchesFilters(r){
  // Recherche texte (titre/auteurs/villes/thèmes)
  const q=(FILTERS.text||"").trim().toLowerCase();
  if(q){
    const hay=[
      r["Titre"], r["Auteur(s)"], r["Ville(s)"], r["Theme(s)"]
    ].join(" ").toLowerCase();
    if(!hay.includes(q)) return false;
  }
  if(FILTERS.annee && (r["Année"]||"")!==FILTERS.annee) return false;
  if(FILTERS.numero && (r["Numéro"]||"")!==FILTERS.numero) return false;

  if(FILTERS.ville){
    const vs=(r["Ville(s)"]||"").toLowerCase();
    if(!vs.includes(FILTERS.ville.toLowerCase())) return false;
  }
  if(FILTERS.theme){
    const ts=(r["Theme(s)"]||"").toLowerCase();
    if(!ts.includes(FILTERS.theme.toLowerCase())) return false;
  }
  if(FILTERS.epoque){
    const es=(r["Epoque"]||"").toLowerCase();
    if(!es.includes(FILTERS.epoque.toLowerCase())) return false;
  }
  return true;
}

function applyFilters(){
  let rows = ARTICLES.map((r,idx)=>({...r,_i:idx})); // on garde l'index source
  rows = rows.filter(rowMatchesFilters);

  // tri
  rows.sort((a,b)=>{
    let av,bv;
    switch(SORT.col){
      case "annee": av=a["Année"]||"";  bv=b["Année"]||""; break;
      case "numero":av=a["Numéro"]||""; bv=b["Numéro"]||""; break;
      case "titre": av=a["Titre"]||"";  bv=b["Titre"]||""; break;
      default: av=""; bv="";
    }
    return SORT.dir * ((""+av).localeCompare(""+bv,"fr",{numeric:true}));
  });

  return rows;
}

/* ==== Rendu principal ==== */
function render(){
  const rows=applyFilters();
  const total=rows.length;
  const start=(currentPage-1)*pageSize;
  const page=rows.slice(start, start+pageSize);

  const tbody=document.getElementById("tbody");
  tbody.innerHTML=page.map((r)=>{
    const i=r._i; // index réel dans ARTICLES
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
        <td><input id="ei-annee"   autocomplete="off" value="${r["Année"]||""}" /></td>
        <td><input id="ei-numero"  autocomplete="off" value="${r["Numéro"]||""}" /></td>
        <td><input id="ei-titre"   autocomplete="off" value="${r["Titre"]||""}" /></td>
        <td><input id="ei-pages"   autocomplete="off" value="${r["Page(s)"]||""}" /></td>
        <td><input id="ei-auteurs" autocomplete="off" value="${r["Auteur(s)"]||""}" /></td>
        <td><input id="ei-villes"  autocomplete="off" value="${r["Ville(s)"]||""}" /></td>
        <td><input id="ei-themes"  autocomplete="off" value="${r["Theme(s)"]||""}" /></td>
        <td><input id="ei-epoque"  autocomplete="off" value="${r["Epoque"]||""}" /></td>
        <td class="actions">
          <button class="save" onclick="window._inlineSave?.()" aria-label="Enregistrer">💾</button>
          <button class="cancel" onclick="window._inlineCancel?.()" aria-label="Annuler">✖</button>
        </td>
      </tr>`;
    }
  }).join("");

  const pages=Math.max(1, Math.ceil(total/pageSize));
  document.getElementById("pageinfo").textContent = `${Math.min(currentPage,pages)} / ${pages} — ${total} ligne(s)`;
  document.getElementById("prev").disabled = currentPage<=1;
  document.getElementById("next").disabled = currentPage>=pages;

  if (currentPage > pages){ currentPage = pages; return render(); }

  const sc=document.getElementById("status-count"); if(sc) sc.textContent=`Fichier: ✅ (${ARTICLES.length})`;
  const sa=document.getElementById("status-auth");  if(sa) sa.textContent= GHTOKEN ? "🔐 Connecté" : "🔓 Invité";
}

/* ==== Inline edit ==== */

// Sur mobile : un simple tap sur la ligne déclenche l'édition inline.
// Sur desktop : double-clic ouvre aussi l'édition.
window._editRow = (idx) => {
  try {
    if (matchMedia("(max-width:800px)").matches) {
      _inlineEdit(idx);
    }
  } catch {
    _inlineEdit(idx);
  }
};

window._inlineEdit = (idx) => {
  editingIndex = idx;
  render();

  // focus sur le titre par défaut
  setTimeout(() => document.getElementById("ei-titre")?.focus(), 0);

  const ids = [
    "ei-annee",
    "ei-numero",
    "ei-titre",
    "ei-pages",
    "ei-auteurs",
    "ei-villes",
    "ei-themes",
    "ei-epoque"
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    // Plus d'auto-enregistrement silencieux sur blur/change :
    // on valide seulement avec Entrée ou le bouton 💾
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        window._inlineSave?.();
      } else if (e.key === "Escape") {
        e.preventDefault();
        window._inlineCancel?.();
      }
    });
  });
};

window._inlineCancel = () => {
  editingIndex = -1;
  render();
};

window._inlineSave = async () => {
  const i = editingIndex;
  if (i < 0) return;

  const v = (id) => document.getElementById(id)?.value ?? "";

  const updatedRaw = {
    "Année":     v("ei-annee"),
    "Numéro":    v("ei-numero"),
    "Titre":     v("ei-titre"),
    "Page(s)":   v("ei-pages"),
    "Auteur(s)": v("ei-auteurs"),
    "Ville(s)":  v("ei-villes"),
    "Theme(s)":  v("ei-themes"),
    "Epoque":    v("ei-epoque")
  };

  const updated = normaliseRowFields(updatedRaw);

  // On met à jour la ligne dans ARTICLES puis on déclenche la même
  // chaîne de sauvegarde que pour les autres actions
  ARTICLES[i] = updated;
  editingIndex = -1;
  render();
  enqueueSave("Édition ligne");
};

/* ==== Ajout / Suppression ==== */
function getNumbersForYear(year){
  let nums=ARTICLES
    .filter(r=>!year || (r["Année"]||"")==year)
    .map(r=> (r["Numéro"]==null?"":(""+r["Numéro"]).trim()))
    .filter(Boolean);
  nums=Array.from(new Set(nums));
  nums.sort((a,b)=>(""+a).localeCompare(""+b,"fr",{numeric:true}));
  return nums;
}
function refreshAddNumeroOptions(){
  const year=document.getElementById("a-annee")?.value?.trim()||"";
  const sel=document.getElementById("a-numero");
  if(!sel || sel.tagName!=="SELECT") return;
  const base = sel.getAttribute("data-base-label") || "Mémoire n°";
  const span=document.getElementById("numero-suggestion");
  const nums=getNumbersForYear(year);
  let suggestion = "";
  if(!year || !nums.length){
    suggestion = "";
  }else{
    // on propose le plus grand + 1
    const last = nums[nums.length-1];
    const n = parseInt(last,10);
    if(!isNaN(n)) suggestion = `${base} ${n+1}`;
  }
  if(span) span.textContent = suggestion || "";
}

/* Ajout complet */
function addRowFromForm(form){
  const getVal=(id)=>form.querySelector("#"+id)?.value?.trim() || "";
  const raw={
    "Année":     getVal("a-annee"),
    "Numéro":    getVal("a-numero") || document.getElementById("numero-suggestion")?.textContent || "",
    "Titre":     getVal("a-titre"),
    "Page(s)":   getVal("a-pages"),
    "Auteur(s)": getVal("a-auteurs"),
    "Ville(s)":  getVal("a-villes"),
    "Theme(s)":  getVal("a-themes"),
    "Epoque":    getVal("a-epoque")
  };
  const row=normaliseRowFields(raw);
  ARTICLES.push(row);
  document.getElementById("add-modal")?.close();
  currentPage=Math.ceil(ARTICLES.length/pageSize);
  render();
  enqueueSave("Ajout d'article");
}

/* Suppression */
window._deleteRow=(idx)=>{
  if(!confirm("Supprimer cet article ?")) return;
  if(idx<0 || idx>=ARTICLES.length) return;
  ARTICLES.splice(idx,1);
  render();
  enqueueSave("Suppression");
};

/* ==== Export CSV ==== */
function downloadCSV(name, text){
  const blob=new Blob([text],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCurrent(){
  const rows=applyFilters().map(r=>{
    const { _i, ...rest } = r;
    return rest;
  });
  const csv=toCSV(rows);
  downloadCSV("articles_filtre.csv", csv);
}
function exportAll(){
  const csv=toCSV(ARTICLES);
  downloadCSV("articles_tout.csv", csv);
}

/* ==== Sauvegarde GitHub (file d'attente) ==== */
function setSaveBadge(state){
  const elOk=document.getElementById("status-save");
  const elKo=document.getElementById("status-unsaved");
  if(!elOk || !elKo) return;
  if(state==="ok"){
    elOk.classList.remove("hidden");
    elKo.classList.add("hidden");
    elOk.textContent="✓ Sauvegardé";
  }else if(state==="pending"){
    elOk.classList.remove("hidden");
    elKo.classList.add("hidden");
    elOk.textContent="💾 Enregistrement…";
  }else if(state==="error"){
    elOk.classList.add("hidden");
    elKo.classList.remove("hidden");
    elKo.textContent="⚠ Échec";
  }else{
    elOk.classList.add("hidden");
    elKo.classList.add("hidden");
  }
}

async function getShaFor(apiUrl){
  const res=await fetch(apiUrl,{
    headers: GHTOKEN ? {Authorization:`token ${GHTOKEN}`} : {}
  });
  if(!res.ok) throw new Error("Impossible de lire le fichier GitHub");
  const json=await res.json();
  return json.sha;
}

async function saveToGitHubRaw(csvText, message="Mise à jour catalogue"){
  if(!GHTOKEN) throw new Error("Pas de token");
  let sha; 
  try{ sha = await getShaFor(API_ART);}catch{ sha = null; }

  const content = btoa(unescape(encodeURIComponent(csvText)));
  const body = { message, content, branch: GITHUB_BRANCH };
  if (sha) body.sha = sha;

  const res = await fetch(API_ART, {
    method: "PUT",
    headers: {
      "Content-Type":"application/json",
      Authorization:`token ${GHTOKEN}`
    },
    body: JSON.stringify(body)
  });

  if(!res.ok){
    console.error("Échec commit GitHub", res.status, await res.text());
    throw new Error("Échec commit");
  }
}

async function saveToGitHubMerged(csvText, message="Mise à jour catalogue (merge distant)"){
  // pour la connexion initiale : on relit le fichier, on merge, puis on pousse.
  const remoteTxt = await fetchText(RAW_ART);
  const remoteRows = parseCSV(remoteTxt);
  // on prend la version locale comme vérité pour les lignes communes (pas de merge fin ici)
  const csv = csvText || toCSV(ARTICLES.length ? ARTICLES : remoteRows);
  await saveToGitHubRaw(csv, message);
}

function enqueueSave(message="Mise à jour catalogue"){
  if(!GHTOKEN){
    if(!AUTO_SAVE_SILENT) toast("Modifié localement — cliquez 🔐 pour enregistrer sur GitHub");
    setSaveBadge("error");
    return;
  }
  // on stocke juste le message, toutes les saves écrivent l'état actuel d'ARTICLES
  SAVE_QUEUE.push({ message });
  if(!IS_SAVING) runQueuedSave();
}

async function runQueuedSave(){
  if(IS_SAVING) return;
  IS_SAVING = true;
  while(SAVE_QUEUE.length){
    const payload = SAVE_QUEUE.pop(); // on vide la file, seule la dernière nous intéresse
    try{
      setSaveBadge("pending");
      await saveToGitHubRaw(toCSV(ARTICLES), payload.message);
      setSaveBadge("ok");
    }catch(e){
      console.error(e);
      setSaveBadge("error");
      if(!AUTO_SAVE_SILENT) toast("❌ Échec d'enregistrement GitHub");
    }
  }
  IS_SAVING=false;
}

/* ==== Login / Logout GitHub ==== */
async function githubLoginInline(){
  const token=prompt("Collez votre token GitHub (scope: repo, contenu)");
  if(!token) return;
  localStorage.setItem("ghtoken", token); 
  GHTOKEN=token;
  alert("Connecté à GitHub ✅");
  render();
  try{
    AUTO_SAVE_SILENT=true;
    await saveToGitHubMerged(toCSV(ARTICLES),"commit auto après connexion");
  }catch(e){
    console.warn("Impossible de pousser automatiquement après connexion", e);
  }finally{
    AUTO_SAVE_SILENT=false;
  }
}
function githubLogoutInline(){
  if(!confirm("Supprimer le token GitHub enregistré dans ce navigateur ?")) return;
  localStorage.removeItem("ghtoken");
  GHTOKEN="";
  alert("Token supprimé. Vous êtes maintenant invité.");
  render();
}

/* ==== Filtres ==== */
function attachFilterHandlers(){
  const q=document.getElementById("q");
  if(q){
    q.addEventListener("input", debounce((e)=>{
      FILTERS.text=e.target.value||"";
      currentPage=1;
      render();
    },250));
  }

  const fAnnee=document.getElementById("f-annee");
  const fNumero=document.getElementById("f-numero");
  const fVille=document.getElementById("f-ville");
  const fTheme=document.getElementById("f-theme");
  const fEpoque=document.getElementById("f-epoque");

  if(fAnnee)  fAnnee.addEventListener("change",(e)=>{ FILTERS.annee=e.target.value||""; currentPage=1; render(); });
  if(fNumero) fNumero.addEventListener("change",(e)=>{ FILTERS.numero=e.target.value||""; currentPage=1; render(); });
  if(fVille)  fVille.addEventListener("change",(e)=>{ FILTERS.ville=e.target.value||""; currentPage=1; render(); });
  if(fTheme)  fTheme.addEventListener("change",(e)=>{ FILTERS.theme=e.target.value||""; currentPage=1; render(); });
  if(fEpoque) fEpoque.addEventListener("change",(e)=>{ FILTERS.epoque=e.target.value||""; currentPage=1; render(); });

  const resetBtn=document.getElementById("reset-filters");
  if(resetBtn){
    resetBtn.addEventListener("click",()=>{
      FILTERS={ text:"", annee:"", numero:"", ville:"", theme:"", epoque:"" };
      if(q) q.value="";
      if(fAnnee)  fAnnee.value="";
      if(fNumero) fNumero.value="";
      if(fVille)  fVille.value="";
      if(fTheme)  fTheme.value="";
      if(fEpoque) fEpoque.value="";
      currentPage=1;
      render();
    });
  }
}

/* ==== Listes (auteurs, villes, thèmes, époques) + mini-éditeur ==== */
function populateDatalist(id, values){
  const dl=document.getElementById(id);
  if(!dl) return;
  dl.innerHTML=values.map(v=>`<option value="${v}"></option>`).join("");
}

function rebuildCanonMaps(){
  CANON.auteurs = new Map(LISTS.auteurs.map(x => [deburr(x), x]));
  CANON.villes  = new Map(LISTS.villes.map(x  => [deburr(x), x]));
}

function openListEditor(type){
  const modal=document.getElementById("list-modal");
  const title=document.getElementById("list-modal-title");
  const textarea=document.getElementById("list-textarea");
  const hidden=document.getElementById("list-type");
  const info=document.getElementById("list-info");

  const map={
    auteurs: { label:"Auteurs", values:LISTS.auteurs },
    villes:  { label:"Villes",  values:LISTS.villes  },
    themes:  { label:"Thèmes",  values:LISTS.themes  },
    epoques: { label:"Époques", values:LISTS.epoques }
  }[type];
  if(!map) return;

  title.textContent=`Éditer la liste – ${map.label}`;
  textarea.value = map.values.join("\n");
  hidden.value = type;
  info.textContent = "Une valeur par ligne. Les doublons seront supprimés.";
  modal.showModal();
}

async function saveListEditor(){
  const textarea=document.getElementById("list-textarea");
  const hidden=document.getElementById("list-type");
  const type=hidden.value;
  const raw=(textarea.value||"")
    .replace(/\r\n/g,"\n")
    .split(/\n+/)
    .map(x=>x.trim())
    .filter(Boolean);
  const values=uniq(raw);

  LISTS[type]=values;
  if(type==="auteurs") populateDatalist("dl-auteurs", values);
  if(type==="villes")  populateDatalist("dl-villes",  values);
  if(type==="themes")  populateDatalist("dl-themes",  values);
  if(type==="epoques") populateDatalist("dl-epoques", values);
  rebuildCanonMaps();

  // On pousse la liste sur GitHub
  const apiMap={
    auteurs: API_AUTH,
    villes:  API_CITY,
    themes:  API_THEME,
    epoques: API_EPOCH
  };
  const apiUrl=apiMap[type];
  if(!apiUrl){
    document.getElementById("list-modal")?.close();
    return;
  }

  if(!GHTOKEN){
    toast("Liste modifiée localement — reconnectez-vous pour pousser sur GitHub");
    document.getElementById("list-modal")?.close();
    return;
  }

  try{
    const sha = await getShaFor(apiUrl);
    const content = btoa(unescape(encodeURIComponent(values.join("\n"))));
    const body = {
      message:`Mise à jour liste ${type}`,
      content,
      branch:GITHUB_BRANCH,
      sha
    };
    const res = await fetch(apiUrl,{
      method:"PUT",
      headers:{
        "Content-Type":"application/json",
        Authorization:`token ${GHTOKEN}`
      },
      body:JSON.stringify(body)
    });
    if(!res.ok) throw new Error("Échec PUT");
    toast("Liste mise à jour sur GitHub ✅");
  }catch(e){
    console.error(e);
    toast("⚠ Échec de mise à jour de la liste sur GitHub");
  }

  document.getElementById("list-modal")?.close();
}

/* ==== Initialisation ==== */
async function init(){
  try{
    const [rows, auteurs, villes, themes, epoques] = await Promise.all([
      fetchCSVArticles(),
      fetchCSVList(RAW_AUTH,"auteurs"),
      fetchCSVList(RAW_CITY,"villes"),
      fetchCSVList(RAW_THEME,"thèmes"),
      fetchCSVList(RAW_EPOCH,"époques")
    ]);

    ARTICLES = rows;
    LISTS.auteurs = auteurs;
    LISTS.villes  = villes;
    LISTS.themes  = themes;
    LISTS.epoques = epoques;

    populateDatalist("dl-auteurs", LISTS.auteurs);
    populateDatalist("dl-villes",  LISTS.villes);
    populateDatalist("dl-themes",  LISTS.themes);
    populateDatalist("dl-epoques", LISTS.epoques);
    rebuildCanonMaps();

    attachFilterHandlers();

    // Pagination
    document.getElementById("prev")?.addEventListener("click",()=>{
      if(currentPage>1){ currentPage--; render(); }
    });
    document.getElementById("next")?.addEventListener("click",()=>{
      currentPage++; render();
    });

    // Ajout
    const addBtn=document.getElementById("add-article-btn");
    const addModal=document.getElementById("add-modal");
    const addForm=document.getElementById("add-form");
    const addCancel=document.getElementById("add-cancel");
    if(addBtn && addModal){
      addBtn.addEventListener("click",()=>{
        addForm?.reset();
        refreshAddNumeroOptions();
        addModal.showModal();
      });
    }
    if(addCancel && addModal){
      addCancel.addEventListener("click",()=>addModal.close());
    }
    if(addForm){
      addForm.addEventListener("submit",(e)=>{
        e.preventDefault();
        addRowFromForm(addForm);
      });
      // préremplir numéro quand l'année change
      const aYear=addForm.querySelector("#a-annee");
      if(aYear){
        aYear.addEventListener("change", refreshAddNumeroOptions);
        aYear.addEventListener("input",  refreshAddNumeroOptions);
      }
    }

    // Export
    document.getElementById("export-csv-filtre")?.addEventListener("click", exportCurrent);
    document.getElementById("export-csv-all")?.addEventListener("click", exportAll);

    // Login / Logout
    document.getElementById("login-btn")?.addEventListener("click", githubLoginInline);
    document.getElementById("logout-btn")?.addEventListener("click", githubLogoutInline);

    // Listes
    document.getElementById("edit-authors")?.addEventListener("click", ()=>openListEditor("auteurs"));
    document.getElementById("edit-cities") ?.addEventListener("click", ()=>openListEditor("villes"));
    document.getElementById("edit-themes") ?.addEventListener("click", ()=>openListEditor("themes"));
    document.getElementById("edit-epochs") ?.addEventListener("click", ()=>openListEditor("epoques"));

    document.getElementById("list-save")?.addEventListener("click", saveListEditor);
    document.getElementById("list-cancel")?.addEventListener("click",()=>document.getElementById("list-modal")?.close());

    render();
    console.log("✅ Application initialisée avec succès");
  }catch(e){
    console.error("Erreur init:",e);
    toast("❌ Erreur lors de l'initialisation de l'application.");
  }
}

// Lancement
document.addEventListener("DOMContentLoaded", init);
