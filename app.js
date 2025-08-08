
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
      ${data.map(row => `<tr>${Object.values(row).map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
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
