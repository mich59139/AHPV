
const CSV_URL = "https://raw.githubusercontent.com/<ton_user>/<ton_repo>/main/data/articles.csv";
let articles = [];

Papa.parse(CSV_URL, {
  download: true,
  header: true,
  complete: function(results) {
    articles = results.data;
    render(articles);
  }
});

function render(data) {
  const container = document.getElementById("articles");
  if (!data.length) {
    container.innerHTML = "<p>Aucun article trouvé.</p>";
    return;
  }

  let html = `<table><thead><tr>
    <th>Titre</th>
    <th>Auteur(s)</th>
    <th>Année</th>
    <th>Thème(s)</th>
  </tr></thead><tbody>`;

  html += data.map(row => `
    <tr>
      <td>\${row["Titre"] || ""}</td>
      <td>\${row["Auteur(s)"] || ""}</td>
      <td>\${row["Année"] || ""}</td>
      <td>\${row["Theme(s)"] || ""}</td>
    </tr>
  `).join('');

  html += "</tbody></table>";
  container.innerHTML = html;
}

document.getElementById("search").addEventListener("input", e => {
  const term = e.target.value.toLowerCase();
  const filtered = articles.filter(row =>
    Object.values(row).some(val => val.toLowerCase().includes(term))
  );
  render(filtered);
});

function toggleForm() {
  const form = document.getElementById("form-container");
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
  const csv = header + "\n" + row;
  document.getElementById("preview").textContent = csv;
  navigator.clipboard.writeText(csv).then(() => alert("Ligne copiée ! Collez-la dans votre fichier articles.csv sur GitHub."));
});
