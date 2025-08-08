
const CSV_URL = 'data/articles.csv';
let articles = [];

Papa.parse(CSV_URL, {
  download: true,
  header: true,
  complete: (results) => {
    articles = results.data;
    renderArticles(articles);
  }
});

function renderArticles(data) {
  const container = document.getElementById("articles");
  container.innerHTML = data.map(row => `
    <div class="card">
      <h3>${row["Titre"]}</h3>
      <p><strong>Auteur(s):</strong> ${row["Auteur(s)"] || ""}</p>
      <p><strong>Année:</strong> ${row["Année"] || ""}</p>
      <p><strong>Thème:</strong> ${row["Theme(s)"] || ""}</p>
    </div>
  `).join('');
}

document.getElementById("search").addEventListener("input", e => {
  const term = e.target.value.toLowerCase();
  const filtered = articles.filter(row =>
    Object.values(row).some(val => val.toLowerCase().includes(term))
  );
  renderArticles(filtered);
});

function toggleForm() {
  const form = document.getElementById("add-form");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

document.getElementById("form-article").addEventListener("submit", e => {
  e.preventDefault();
  const form = e.target;
  const data = {};
  for (const input of form.elements) {
    if (input.name) data[input.name] = input.value;
  }
  const header = Object.keys(data).join(",");
  const row = Object.values(data).join(",");
  const preview = header + "\n" + row;
  document.getElementById("preview").textContent = preview;
  navigator.clipboard.writeText(preview).then(() => alert("Ligne copiée ! Ajoute-la manuellement au CSV."));
});
