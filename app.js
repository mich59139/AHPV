
const CSV_URL = 'data/articles.csv';
let articles = [];

Papa.parse(CSV_URL, {
  download: true,
  header: true,
  complete: function(results) {
    articles = results.data;
    applyLimitAndDisplay(articles);
    
  }
});

document.getElementById('search').addEventListener('input', e => {
  const term = e.target.value.toLowerCase();
  const filtered = articles.filter(row =>
    Object.values(row).some(val => val.toLowerCase().includes(term))
  );
  displayTable(filtered);
displayCards(filtered);
  displayCards(filtered);
});

function displayTable(data) {
  const container = document.getElementById('table-view');
  container.innerHTML = `
    <table><thead><tr>
      ${Object.keys(data[0]).map(k => `<th>${k}</th>`).join('')}
    </tr></thead><tbody>
      ${data.map(row => `<tr>${Object.values(row).map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('') + data.map(row => `<tr><td colspan='100%'><a href='#' onclick='openDrawer(${JSON.stringify(row)})'>✏ Modifier</a></td></tr>`).join('')}
    </tbody></table>
  `;
}

function displayCards(data) {
  const container = document.getElementById('card-view');
  container.innerHTML = data.map(row => `
    <div class="card">
      <h3>${row.Titre}</h3>
      <p><strong>Auteur(s):</strong> ${row["Auteur(s)"]}</p>
      <p><strong>Année:</strong> ${row["Année"]}</p>
      <p><strong>Thème:</strong> ${row["Theme(s)"]}</p>
    </div>
  `).join('');
}

function showTable() {
  document.getElementById('table-view').style.display = 'block';
  document.getElementById('card-view').style.display = 'none';
}

function showCards() {
  document.getElementById('table-view').style.display = 'none';
  document.getElementById('card-view').style.display = 'block';
}

document.getElementById("add-form").addEventListener("submit", e => {
  e.preventDefault();
  const form = e.target;
  const row = Array.from(form.elements)
    .filter(el => el.name)
    .reduce((acc, el) => ({ ...acc, [el.name]: el.value }), {});

  const csvLine = Object.values(row).join(",");
  const header = Object.keys(row).join(",");
  const fullCSV = `${header}
${csvLine}`;

  document.getElementById("preview").textContent = fullCSV;
  navigator.clipboard.writeText(fullCSV).then(() =>
    alert("Données copiées ! Ouvre une PR sur GitHub pour les ajouter.")
  );
});


  const encodedContent = encodeURIComponent(fullCSV);
  const githubPRUrl = `https://github.com/<user>/<repo>/new/main/data?filename=new_article.csv&value=${encodedContent}`;
  document.getElementById("github-pr-link").href = githubPRUrl;
  document.getElementById("github-pr-link").style.display = 'inline-block';


document.getElementById("limit").addEventListener("change", () => applyLimitAndDisplay(articles));

function applyLimitAndDisplay(data) {
  const limit = document.getElementById("limit").value;
  let limited = data;
  if (limit !== "all") {
    limited = data.slice(0, parseInt(limit));
  }
  displayTable(limited);
  displayCards(limited);
setAutocompleteFields(data);
}

function setAutocompleteFields(data) {
  const uniqueValues = {};
  ['Année', 'Numéro', 'Auteur(s)', 'Ville(s)', 'Theme(s)', 'Epoque'].forEach(field => {
    uniqueValues[field] = [...new Set(data.map(row => row[field]).filter(Boolean))];
  });

  for (const [field, values] of Object.entries(uniqueValues)) {
    const datalistId = `${field}-list`;
    let datalist = document.getElementById(datalistId);
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = datalistId;
      document.body.appendChild(datalist);
    }
    datalist.innerHTML = values.map(v => `<option value="${v}">`).join('');
    const input = document.querySelector(`input[name="${field}"]`);
    if (input) input.setAttribute('list', datalistId);
  }
}


let currentPage = 1;
let rowsPerPage = 50;
let currentSort = { column: null, direction: 'asc' };

document.getElementById("limit").addEventListener("change", (e) => {
  const val = e.target.value;
  rowsPerPage = val === "all" ? articles.length : parseInt(val);
  currentPage = 1;
  renderPaginatedAndSorted();
});

function renderPaginatedAndSorted() {
  let sorted = applyFilters([...articles]);
  if (currentSort.column) {
    sorted.sort((a, b) => {
      let valA = a[currentSort.column] || '';
      let valB = b[currentSort.column] || '';
      if (!isNaN(valA) && !isNaN(valB)) {
        valA = parseFloat(valA);
        valB = parseFloat(valB);
      }
      return currentSort.direction === 'asc'
        ? valA > valB ? 1 : -1
        : valA < valB ? 1 : -1;
    });
  }

  const start = (currentPage - 1) * rowsPerPage;
  const paginated = sorted.slice(start, start + rowsPerPage);
  displayTable(paginated);
  displayCards(paginated);
  setAutocompleteFields(articles);
  renderPaginationControls(sorted.length);
}

function renderPaginationControls(total) {
  const container = document.getElementById("pagination-controls") || createPaginationContainer();
  container.innerHTML = `
    <button ${currentPage <= 1 ? 'disabled' : ''} onclick="changePage(-1)">◀ Précédent</button>
    <span> Page ${currentPage} </span>
    <button ${(currentPage * rowsPerPage) >= total ? 'disabled' : ''} onclick="changePage(1)">Suivant ▶</button>
  `;
}

function createPaginationContainer() {
  const div = document.createElement("div");
  div.id = "pagination-controls";
  div.style.marginTop = "10px";
  document.getElementById("table-view").after(div);
  return div;
}

function changePage(delta) {
  currentPage += delta;
  renderPaginatedAndSorted();
}

function displayTable(data) {
  const container = document.getElementById('table-view');
  if (!data.length) return container.innerHTML = "<p>Aucun résultat</p>";

  const headers = Object.keys(data[0]);
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          ${headers.map(k => `<th onclick="sortBy('${k}')">${k} ${currentSort.column === k ? (currentSort.direction === 'asc' ? '▲' : '▼') : ''}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${data.map(row => `<tr>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>`).join('') + data.map(row => `<tr><td colspan='100%'><a href='#' onclick='openDrawer(${JSON.stringify(row)})'>✏ Modifier</a></td></tr>`).join('')}
      </tbody>
    </table>
  `;
}

function sortBy(column) {
  if (currentSort.column === column) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.column = column;
    currentSort.direction = 'asc';
  }
  renderPaginatedAndSorted();
}


function openDrawer(data = {}) {
  const drawer = document.getElementById("drawer");
  const form = document.getElementById("drawer-form");
  const fields = ['Année', 'Numéro', 'Titre', 'Page(s)', 'Auteur(s)', 'Ville(s)', 'Theme(s)', 'Epoque'];
  form.innerHTML = `<div id="form-fields">` + fields.map(f => 
    `<label>${f}<input name="${f}" value="${data[f] || ''}" ${f === 'Année' || f === 'Numéro' || f === 'Titre' ? 'required' : ''}></label>`
  ).join('') + '<button type="submit">Préparer</button><button type="button" id="delete-btn" style="margin-left:10px; display:none;">❌ Supprimer</button>';
  drawer.classList.add("open");
  document.getElementById("drawer-title").textContent = data["Titre"] ? "Modifier l'article" : "Nouvel article";
}

function closeDrawer() {
  document.getElementById("drawer").classList.remove("open");
}

document.getElementById("drawer-form").addEventListener("submit", e => {
  e.preventDefault();
  const form = e.target;
  const row = Array.from(form.elements)
    .filter(el => el.name)
    .reduce((acc, el) => ({ ...acc, [el.name]: el.value }), {});
  const csvLine = Object.values(row).join(",");
  const header = Object.keys(row).join(",");
  const fullCSV = `${header}
${csvLine}`;
  document.getElementById("preview").textContent = fullCSV;
  const encodedContent = encodeURIComponent(fullCSV);
  const githubPRUrl = `https://github.com/<user>/<repo>/new/main/data?filename=new_article.csv&value=${encodedContent}`;
  const link = document.getElementById("github-pr-link");
  link.href = githubPRUrl;
  link.style.display = 'inline-block';
});


document.getElementById("drawer-form").addEventListener("reset", closeDrawer);

document.getElementById("delete-btn").addEventListener("click", () => {
  const form = document.getElementById("drawer-form");
  const row = Array.from(form.elements)
    .filter(el => el.name)
    .reduce((acc, el) => ({ ...acc, [el.name]: el.value }), {});
  const csvLine = Object.values(row).join(",");
  const header = Object.keys(row).join(",");
  const fullCSV = `# Suppression demandée\n${header}\n${csvLine}`;
  document.getElementById("preview").textContent = fullCSV;
  const encodedContent = encodeURIComponent(fullCSV);
  const githubPRUrl = `https://github.com/<user>/<repo>/new/main/data?filename=suppression_article.csv&value=${encodedContent}`;
  const link = document.getElementById("github-pr-link");
  link.href = githubPRUrl;
  link.style.display = 'inline-block';
  alert("Un fichier de suppression a été préparé. Ouvre la PR pour valider.");
});

const openDrawerOriginal = openDrawer;
openDrawer = function(data = {}) {
  openDrawerOriginal(data);
  document.getElementById("delete-btn").style.display = data["Titre"] ? "inline-block" : "none";
};

function populateFilterOptions(field, selectorId) {
  const values = [...new Set(articles.map(a => a[field]).filter(Boolean))].sort();
  const select = document.getElementById(selectorId);
  select.innerHTML = '<option value="">(toutes)</option>' + values.map(v => `<option value="${v}">${v}</option>`).join('');
}

['filter-annee', 'filter-ville', 'filter-theme'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => {
    currentPage = 1;
    renderPaginatedAndSorted();
  });
});

function applyFilters(data) {
  const annee = document.getElementById('filter-annee').value;
  const ville = document.getElementById('filter-ville').value;
  const theme = document.getElementById('filter-theme').value;
  const search = document.getElementById('search').value.toLowerCase();

  return data.filter(row => {
    const matchesSearch = Object.values(row).some(val => val.toLowerCase().includes(search));
    const matchesAnnee = !annee || row["Année"] === annee;
    const matchesVille = !ville || row["Ville(s)"] === ville;
    const matchesTheme = !theme || row["Theme(s)"] === theme;
    return matchesSearch && matchesAnnee && matchesVille && matchesTheme;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  populateFilterOptions("Année", "filter-annee");
  populateFilterOptions("Ville(s)", "filter-ville");
  populateFilterOptions("Theme(s)", "filter-theme");
});
