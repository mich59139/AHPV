# Script de test AHPV v1.12

Copiez-collez ce code dans la console (F12) pour tester toutes les fonctionnalités :

```javascript
// ============================================
// SCRIPT DE TEST AHPV v1.12
// ============================================

console.clear();
console.log("🔍 TESTS AHPV v1.12");
console.log("====================\n");

// Test 1 : Version
console.log("📋 Test 1 : Vérification version");
const titleMatch = document.title.match(/v1\.(\d+)/);
const version = titleMatch ? titleMatch[0] : "Non trouvée";
console.log(version === "v1.12" ? "✅" : "❌", "Version:", version);
console.log("");

// Test 2 : Sélecteur de taille
console.log("📋 Test 2 : Sélecteur de taille");
const pageSize = document.getElementById('page-size');
console.log(pageSize ? "✅" : "❌", "Sélecteur trouvé:", !!pageSize);
if(pageSize) {
  console.log("   Options disponibles:");
  Array.from(pageSize.options).forEach(opt => {
    console.log("   -", opt.value, ":", opt.text);
  });
}
console.log("");

// Test 3 : Boutons de pagination
console.log("📋 Test 3 : Boutons de pagination");
const buttons = {
  first: document.getElementById('first'),
  prev: document.getElementById('prev'),
  next: document.getElementById('next'),
  last: document.getElementById('last')
};
Object.entries(buttons).forEach(([name, btn]) => {
  console.log(btn ? "✅" : "❌", `Bouton ${name}:`, !!btn);
});
console.log("");

// Test 4 : Numéros de page
console.log("📋 Test 4 : Numéros de page");
const pageNumbers = document.getElementById('page-numbers');
console.log(pageNumbers ? "✅" : "❌", "Conteneur page-numbers:", !!pageNumbers);
if(pageNumbers) {
  const numButtons = pageNumbers.querySelectorAll('.page-num');
  console.log("   Nombre de boutons:", numButtons.length);
}
console.log("");

// Test 5 : Fonctions JS
console.log("📋 Test 5 : Fonctions JavaScript");
const functions = {
  bindPager: typeof bindPager === 'function',
  renderPageNumbers: typeof renderPageNumbers === 'function',
  updateAllListsFromArticles: typeof updateAllListsFromArticles === 'function',
  saveListToGitHub: typeof saveListToGitHub === 'function'
};
Object.entries(functions).forEach(([name, exists]) => {
  console.log(exists ? "✅" : "❌", `Fonction ${name}:`, exists);
});
console.log("");

// Test 6 : Formulaire ajout article
console.log("📋 Test 6 : Formulaire ajout article");
const addModal = document.getElementById('add-modal');
const addForm = document.getElementById('add-form');
const yearInput = document.getElementById('a-annee');
console.log(addModal ? "✅" : "❌", "Modal ajout:", !!addModal);
console.log(addForm ? "✅" : "❌", "Formulaire:", !!addForm);
console.log(yearInput ? "✅" : "❌", "Input année:", !!yearInput);
console.log("");

// Test 7 : Année en cours
console.log("📋 Test 7 : Pré-remplissage année");
console.log("   Pour tester, exécutez: window._openAddModal()");
console.log("   Puis vérifiez que le champ Année contient:", new Date().getFullYear());
console.log("");

// Test 8 : Token GitHub
console.log("📋 Test 8 : Configuration GitHub");
const ghtoken = localStorage.getItem('ghtoken');
console.log(ghtoken ? "✅" : "❌", "Token GitHub configuré:", !!ghtoken);
if(ghtoken) {
  console.log("   Token (premiers caractères):", ghtoken.substring(0, 10) + "...");
}
console.log("");

// Test 9 : Variables globales
console.log("📋 Test 9 : Variables d'état");
console.log("   ARTICLES:", typeof ARTICLES !== 'undefined' ? ARTICLES.length + " articles" : "Non défini");
console.log("   currentPage:", typeof currentPage !== 'undefined' ? currentPage : "Non défini");
console.log("   pageSize:", typeof pageSize !== 'undefined' ? pageSize : "Non défini");
console.log("");

// Test 10 : Erreurs console
console.log("📋 Test 10 : Erreurs console");
const errors = console.error.toString().includes('native') ? "Aucune erreur visible" : "Vérifier l'onglet Console";
console.log("   État:", errors);
console.log("");

// Résumé
console.log("====================");
console.log("📊 RÉSUMÉ");
console.log("====================");
const allTests = [
  version === "v1.12",
  !!pageSize,
  !!buttons.first && !!buttons.last,
  !!pageNumbers,
  functions.bindPager && functions.renderPageNumbers,
  !!addModal && !!yearInput
];
const passed = allTests.filter(Boolean).length;
const total = allTests.length;
console.log(`✅ Tests réussis: ${passed}/${total}`);
console.log(`❌ Tests échoués: ${total - passed}/${total}`);

if(passed === total) {
  console.log("\n🎉 TOUS LES TESTS SONT OK !");
  console.log("Vous pouvez utiliser l'application normalement.");
} else {
  console.log("\n⚠️ CERTAINS TESTS ONT ÉCHOUÉ");
  console.log("Veuillez :");
  console.log("1. Vider le cache (Ctrl+Shift+R)");
  console.log("2. Vérifier que les fichiers v1.12 sont bien déployés");
  console.log("3. Relancer ce script");
}

console.log("\n====================");
console.log("Pour forcer le reload de app.js:");
console.log("location.reload(true);");
console.log("====================\n");
```

---

## Comment l'utiliser

1. Ouvrir https://mich59139.github.io/AHPV/index.html
2. Appuyer sur **F12** (console développeur)
3. **Copier** tout le code JavaScript ci-dessus
4. **Coller** dans la console
5. Appuyer sur **Entrée**
6. Lire les résultats

---

## Interprétation des résultats

### ✅ Tous OK
```
🎉 TOUS LES TESTS SONT OK !
Vous pouvez utiliser l'application normalement.
```
→ Version v1.12 correctement chargée

### ❌ Échecs
```
⚠️ CERTAINS TESTS ONT ÉCHOUÉ
```
→ Cache pas vidé ou ancien fichier encore présent

Actions :
1. `Ctrl + Shift + R`
2. Vérifier déploiement GitHub
3. Relancer le script

---

## Tests individuels

### Tester le sélecteur de taille
```javascript
document.getElementById('page-size').value = "10";
document.getElementById('page-size').dispatchEvent(new Event('change'));
```

### Tester la pagination
```javascript
// Aller à la page 5
currentPage = 5;
render();
```

### Tester l'ouverture formulaire avec année
```javascript
window._openAddModal();
console.log("Année:", document.getElementById('a-annee').value);
```

### Forcer la mise à jour des listes
```javascript
updateAllListsFromArticles().then(() => {
  console.log("✅ Listes mises à jour");
}).catch(e => {
  console.error("❌ Erreur:", e);
});
```
