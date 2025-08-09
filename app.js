
const CSV_URL = "https://raw.githubusercontent.com/mich59139/AHPV/main/data/articles.csv";

// State
let rows = [];
let filtered = [];
let sortState = { col: null, dir: 'asc' };
let currentPage = 1;
let rowsPerPage = 'all';

// Elements
const tableContainer = document.getElementById('table-container');
const paginationEl = document.getElementById('pagination');
const searchEl = document.getElementById('search');
const limitEl = document.getElementById('limit');
const drawerEl = document.getElementById('drawer');
const addBtn = document.getElementById('addBtn');
const closeDrawerBtn = document.getElementById('closeDrawer');
const formEl = document.getElementById('articleForm');
const previewEl = document.getElementById('preview');

// Load CSV
Papa.parse(CSV_URL, {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: (res) => {
    rows = res.data.map(normalizeRow);
    filtered = rows.slice();
    populateDatalists(rows);
    render();
  },
  error: (err) => {
    tableContainer.innerHTML = '<p style="color:#b91c1c">Erreur de chargement du CSV.</p>';
    console.error(err);
  }
});

function normalizeRow(row) {
  // Ensure all needed keys exist and are strings
  const keys = ['Année','Numéro','Titre','Page(s)','Auteur(s)','Ville(s)','Theme(s)','Epoque'];
  const obj = {};
  keys.forEach(k => obj[k] = (row[k] ?? '').toString());
  return obj;
}

function populateDatalists(data) {
  const uniques = (key) => Array.from(new Set(data.map(r => r[key]).filter(Boolean))).sort();
  fillDatalist('anneesList', uniques('Année'));
  fillDatalist('numerosList', uniques('Numéro'));
  fillDatalist('auteursList', uniques('Auteur(s)'));
  fillDatalist('villesList', uniques('Ville(s)'));
  fillDatalist('themesList', uniques('Theme(s)'));
  fillDatalist('epoquesList', uniques('Epoque'));
}

function fillDatalist(id, values) {
  const dl = document.getElementById(id);
  dl.innerHTML = values.map(v => '<option value="'+escapeHtml(v)+'"></option>').join('');
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Rendering
function render() {
  // Search filter
  const q = (searchEl.value || '').toLowerCase();
  filtered = rows.filter(r => Object.values(r).some(v => (v||'').toLowerCase().includes(q)));

  // Sort
  if (sortState.col) {
    filtered.sort((a,b) => {
      const A = (a[sortState.col]||'').toLowerCase();
      const B = (b[sortState.col]||'').toLowerCase();
      if (A < B) return sortState.dir === 'asc' ? -1 : 1;
      if (A > B) return sortState.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Pagination
  const perPage = rowsPerPage === 'all' ? filtered.length : parseInt(rowsPerPage,10);
  const totalPages = Math.max(1, Math.ceil(filtered.length / Math.max(1, perPage)));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = rowsPerPage === 'all' ? 0 : (currentPage-1) * perPage;
  const end = rowsPerPage === 'all' ? filtered.length : start + perPage;
  const pageRows = filtered.slice(start, end);

  // Table
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const cols = [
    { key:'Année',   title:'Année',   className:'min-year' },
    { key:'Numéro',  title:'Numéro',  className:'min-num' },
    { key:'Titre',   title:'Titre' },
    { key:'Auteur(s)', title:'Auteur(s)' },
    { key:'Theme(s)',  title:'Thème(s)' },
  ];

  cols.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.title + (sortState.col === col.key ? (sortState.dir==='asc'?' ▲':' ▼') : '');
    if (col.className) th.className = col.className;
    th.addEventListener('click', () => toggleSort(col.key));
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  pageRows.forEach(r => {
    const tr = document.createElement('tr');
    cols.forEach(col => {
      const td = document.createElement('td');
      td.textContent = r[col.key] || '';
      if (col.className) td.className = col.className;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  tableContainer.innerHTML = '';
  tableContainer.appendChild(table);

  // Pagination controls
  paginationEl.innerHTML = '';
  if (rowsPerPage !== 'all') {
    const prev = document.createElement('button');
    prev.className = 'btn';
    prev.textContent = '◀ Précédent';
    prev.disabled = currentPage <= 1;
    prev.onclick = () => { currentPage--; render(); };

    const next = document.createElement('button');
    next.className = 'btn';
    next.textContent = 'Suivant ▶';
    next.disabled = currentPage >= totalPages;
    next.onclick = () => { currentPage++; render(); };

    const span = document.createElement('span');
    span.textContent = `Page ${currentPage} / ${totalPages}`;

    paginationEl.appendChild(prev);
    paginationEl.appendChild(span);
    paginationEl.appendChild(next);
  }
}

function toggleSort(colKey) {
  if (sortState.col === colKey) {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.col = colKey;
    sortState.dir = 'asc';
  }
  render();
}

// Events
searchEl.addEventListener('input', () => { currentPage = 1; render(); });
limitEl.addEventListener('change', (e) => {
  rowsPerPage = e.target.value;
  currentPage = 1;
  render();
});
addBtn.addEventListener('click', () => openDrawer());
closeDrawerBtn.addEventListener('click', () => drawerEl.classList.remove('open'));

// Drawer actions
function openDrawer(prefill={}) {
  formEl.reset();
  // prefill inputs
  Array.from(formEl.elements).forEach(el => {
    if (el.name && prefill[el.name]) el.value = prefill[el.name];
  });
  document.getElementById('drawerTitle').textContent = prefill.Titre ? "Modifier l'article" : "Nouvel article";
  previewEl.textContent = '';
  drawerEl.classList.add('open');
}

formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = {};
  Array.from(formEl.elements).forEach(el => { if (el.name) data[el.name] = el.value || ''; });

  const headers = Object.keys(data);
  const csv = headers.join(',') + "\\n" + headers.map(h => escapeCsv(data[h])).join(',');
  previewEl.textContent = csv;
  // Add locally to table for visual feedback
  rows.unshift(data);
  render();
});

document.getElementById('copyBtn').addEventListener('click', () => {
  if (!previewEl.textContent.trim()) return alert("Rien à copier : cliquez d'abord sur Préparer.");
  navigator.clipboard.writeText(previewEl.textContent).then(() => alert("Ligne CSV copiée. Collez-la dans data/articles.csv sur GitHub."));
});

function escapeCsv(val) {
  const needsQuotes = /[",\n]/.test(val);
  const v = val.replace(/"/g,'""');
  return needsQuotes ? `"${v}"` : v;
}
