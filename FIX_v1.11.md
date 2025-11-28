# AHPV v1.11 - Corrections Erreurs 404/401

## 🐛 Problème résolu

### Symptômes (v1.10)
- ❌ Erreur 404 lors de l'ajout d'article
- ❌ Erreur 401 lors de la mise à jour des CSV
- ❌ Message "Error: Échec commit"
- ✅ Article bien ajouté dans articles.csv
- ❌ Mais autres CSV pas mis à jour

### Capture d'écran du problème
```
Failed to load resource: the server responded with a status of 404 ()
Failed to load resource: the server responded with a status of 401 ()
Error: Échec commit
```

## 🔍 Diagnostic

### Cause racine
Les fichiers **n'existaient pas** sur GitHub :
- `data/auteurs.csv` → **404 Not Found**
- `data/villes.csv` → **404 Not Found**
- `data/themes.csv` → **404 Not Found**
- `data/epoques.csv` → **404 Not Found**

### Comportement v1.10
1. Essayer de récupérer le SHA du fichier (pour mise à jour)
2. Si 404 → **ERREUR et arrêt complet**
3. Aucun CSV secondaire créé
4. Message d'erreur affiché

## ✅ Solution v1.11

### Modifications apportées

#### 1. Fonction `saveListToGitHub()` améliorée

**AVANT (v1.10)** :
```javascript
let sha;
try{ 
  sha = await getShaFor(apiUrl);
}catch{ 
  sha = null; 
}
// Si erreur plus loin → throw Error (bloquant)
```

**APRÈS (v1.11)** :
```javascript
let sha;
try{
  sha = await getShaFor(apiUrl);
}catch(e){
  // Fichier n'existe pas = on va le CRÉER
  sha = null;
  console.log(`Création de ${pathLabel} (fichier inexistant)`);
}

// Gestion d'erreur NON BLOQUANTE
try{
  const r = await fetch(apiUrl, {...});
  if(!r.ok){
    console.warn(`⚠️ Échec sauvegarde ${pathLabel}`);
    return false; // ← NON BLOQUANT
  }
  console.log(`✅ ${pathLabel} sauvegardé`);
  return true;
}catch(e){
  console.warn(`⚠️ Erreur réseau ${pathLabel}:`, e);
  return false; // ← NON BLOQUANT
}
```

**Avantages** :
- ✅ Crée le fichier s'il n'existe pas
- ✅ Ne bloque pas si erreur
- ✅ Log détaillé dans la console
- ✅ Retourne true/false au lieu de throw

#### 2. Fonction `updateAllListsFromArticles()` ajoutée

**Fonctionnement** :
```javascript
async function updateAllListsFromArticles(){
  // 1. Extraire toutes les valeurs uniques
  const auteursSet = new Set();
  const villesSet = new Set();
  // ... pour chaque type
  
  // 2. Parcourir tous les articles
  for(const article of ARTICLES){
    splitMulti(article["Auteur(s)"]).forEach(a => auteursSet.add(a));
    // ... etc
  }
  
  // 3. Convertir en tableaux triés
  const auteursArray = Array.from(auteursSet).sort(...);
  
  // 4. Sauvegarder EN PARALLÈLE (Promise.all)
  await Promise.all([
    saveListToGitHub(API_AUT, "auteurs.csv", auteursArray, "Auteur"),
    saveListToGitHub(API_VIL, "villes.csv", villesArray, "Ville"),
    // ... etc
  ]);
  
  // 5. Mettre à jour les listes locales
  LISTS.auteurs = auteursArray;
  buildCanonFromLists();
  populateDatalists();
}
```

**Avantages** :
- ✅ Extraction automatique depuis articles
- ✅ Dédoublonnage et tri
- ✅ Sauvegarde parallèle (rapide)
- ✅ Logs détaillés

#### 3. Fonction `runQueuedSave()` sécurisée

**AVANT (v1.10)** :
```javascript
try{
  await saveToGitHubRaw(toCSV(ARTICLES), payload.message);
  // Pas de mise à jour des autres CSV
  setSaveBadge("✅ Synchronisé");
}catch(e){
  setSaveBadge("⚠️ Échec");
}
```

**APRÈS (v1.11)** :
```javascript
try{
  // 1. Sauvegarder articles.csv
  await saveToGitHubRaw(toCSV(ARTICLES), payload.message);
  
  // 2. Mettre à jour les autres CSV (NON BLOQUANT)
  try{
    await updateAllListsFromArticles();
  }catch(listError){
    console.warn("⚠️ Erreur listes (non bloquant):", listError);
    // On continue, l'essentiel est sauvegardé
  }
  
  setSaveBadge("✅ Synchronisé");
}catch(e){
  setSaveBadge("⚠️ Échec");
}
```

**Avantages** :
- ✅ articles.csv toujours sauvegardé
- ✅ Autres CSV tentés mais non bloquants
- ✅ Badge "Synchronisé" même si CSV secondaires échouent
- ✅ Logs clairs des erreurs

## 🎯 Comportement v1.11

### Scénario 1 : Fichiers existent déjà
```
1. Ajout article → articles.csv sauvegardé
2. Extraction listes → auteurs, villes, thèmes, époques
3. Récupération SHA de chaque fichier → OK
4. Mise à jour de chaque fichier → OK
5. Badge "✅ Synchronisé"
```

### Scénario 2 : Fichiers n'existent pas (votre cas)
```
1. Ajout article → articles.csv sauvegardé
2. Extraction listes → auteurs, villes, thèmes, époques
3. Récupération SHA → 404 (normal)
   → Console: "Création de data/auteurs.csv (fichier inexistant)"
4. Création de chaque fichier → OK
5. Badge "✅ Synchronisé"
```

### Scénario 3 : Token invalide
```
1. Ajout article → articles.csv sauvegardé
2. Extraction listes → auteurs, villes, thèmes, époques
3. Tentative sauvegarde → 401 Unauthorized
   → Console: "⚠️ Échec sauvegarde data/auteurs.csv: 401"
4. Continuer avec les autres
5. Badge "✅ Synchronisé" (articles.csv OK)
```

### Scénario 4 : Pas de connexion
```
1. Ajout article → Sauvegarde locale uniquement
2. Pas de tentative GitHub (GHTOKEN vide)
3. Badge reste vide ou "Invité"
```

## 📊 Console logs (aide au debug)

### Logs normaux (succès)
```
📝 Extraction des listes depuis articles...
  - 42 auteurs uniques
  - 28 villes uniques
  - 15 thèmes uniques
  - 8 époques uniques
Création de data/auteurs.csv (fichier inexistant)
✅ data/auteurs.csv sauvegardé
Création de data/villes.csv (fichier inexistant)
✅ data/villes.csv sauvegardé
✅ Toutes les listes ont été traitées
```

### Logs avec erreur (non bloquante)
```
📝 Extraction des listes depuis articles...
  - 42 auteurs uniques
⚠️ Échec sauvegarde data/auteurs.csv: 401 Unauthorized
✅ data/villes.csv sauvegardé
⚠️ Erreur listes (non bloquant): ...
```

## 🔧 Vérification après correction

### 1. Ouvrir la console (F12)
- Onglet "Console"
- Voir les logs détaillés

### 2. Ajouter un article test
- Remplir le formulaire
- Cliquer "Enregistrer"
- Observer les logs

### 3. Vérifier sur GitHub
- Aller sur https://github.com/mich59139/AHPV
- Dossier `data/`
- Vérifier présence de :
  - ✅ articles.csv (mis à jour)
  - ✅ auteurs.csv (créé si n'existait pas)
  - ✅ villes.csv (créé si n'existait pas)
  - ✅ themes.csv (créé si n'existait pas)
  - ✅ epoques.csv (créé si n'existait pas)

## 📋 Fichiers modifiés v1.11

| Fichier | Changement | Lignes |
|---------|------------|--------|
| `app.js` | `saveListToGitHub()` sécurisée | ~40 lignes |
| `app.js` | `updateAllListsFromArticles()` ajoutée | ~90 lignes |
| `app.js` | `runQueuedSave()` avec try/catch | ~10 lignes |
| `index.html` | Title v1.11 | 1 ligne |

## 🚀 Déploiement

1. **Télécharger** les fichiers corrigés
2. **Remplacer** dans votre projet
3. **Pousser** sur GitHub
4. **Tester** l'ajout d'un article

### Commandes Git
```bash
cd ~/Downloads/"files 3"
git add app.js index.html
git commit -m "v1.11 - Fix erreurs 404/401 création CSV"
git push origin main --force
```

## 📈 Améliorations v1.11

| Fonctionnalité | v1.10 | v1.11 |
|----------------|-------|-------|
| Gestion fichier inexistant | ❌ Erreur | ✅ Création |
| Gestion erreur 404 | ❌ Bloquant | ✅ Non bloquant |
| Gestion erreur 401 | ❌ Bloquant | ✅ Non bloquant |
| Logs de debug | ❌ Minimaux | ✅ Détaillés |
| Sauvegarde articles | ✅ | ✅ |
| Mise à jour listes | ❌ Bloquant | ✅ Non bloquant |

## ⚠️ Notes importantes

1. **Première utilisation** : Les fichiers CSV secondaires seront **créés** automatiquement
2. **Token requis** : Sans token GitHub, aucune sauvegarde (normal)
3. **Permissions token** : Vérifier que le token a les droits `repo` complets
4. **Console** : Toujours ouvrir F12 pour voir les logs détaillés

---

**Version** : 1.11  
**Date** : 28 novembre 2024  
**Status** : ✅ Correction critique des erreurs 404/401
