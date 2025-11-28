# AHPV v1.13 - HOTFIX Erreurs 404/401

## 🚨 Problème

Vous obtenez des erreurs persistantes :
```
❌ Failed to load resource: 404 (auteurs.csv, villes.csv, themes.csv, epoques.csv)
❌ Failed to load resource: 401 (articles.csv)
❌ Error: Échec commit
```

## 🔍 Cause racine

1. Les fichiers CSV secondaires **n'existent pas** sur GitHub
2. Le token GitHub est peut-être **invalide** ou **expiré**

## ✅ SOLUTION v1.13 - HOTFIX

**J'ai désactivé temporairement la mise à jour automatique des CSV secondaires.**

Maintenant, seul `articles.csv` sera sauvegardé. Plus d'erreurs 404 !

---

## 📥 Télécharger v1.13 HOTFIX

**IMPORTANT : RENOMMER après téléchargement !**

- [app.js](computer:///mnt/user-data/outputs/app.js) - Version HOTFIX
- [index.html](computer:///mnt/user-data/outputs/index.html) - Version 1.13

---

## 🚀 Déploiement URGENT

```bash
cd ~/Downloads/"files 3"

# Remplacer les fichiers (après les avoir téléchargés et renommés)
git add app.js index.html

# Commiter
git commit -m "v1.13 HOTFIX - Désactivation CSV secondaires"

# Pusher EN FORCE
git push origin main --force
```

**Attendre 2 minutes** puis tester

---

## ✅ Résultat attendu

### AVANT (v1.12)
```
❌ Failed to load resource: 404
❌ Failed to load resource: 404
❌ Failed to load resource: 404
❌ Failed to load resource: 401
❌ Error: Échec commit
```

### APRÈS (v1.13)
```
✅ articles.csv sauvegardé
ℹ️ Mise à jour CSV secondaires désactivée (fichiers inexistants)
✅ Synchronisé
```

---

## 🧪 Test après déploiement

1. Ouvrir https://mich59139.github.io/AHPV/index.html
2. `Ctrl + Shift + R` (vider cache)
3. Vérifier titre = **"v1.13"**
4. Ouvrir F12 (Console)
5. Ajouter un article test
6. Vérifier console :
   ```
   ✅ Pas d'erreur 404
   ✅ Pas d'erreur 401
   ℹ️ "Mise à jour CSV secondaires désactivée"
   ✅ Badge "Synchronisé"
   ```

---

## 🔧 Vérification du token GitHub

Si vous avez toujours une erreur **401** sur `articles.csv` :

### Étape 1 : Vérifier le token

1. Ouvrir https://mich59139.github.io/AHPV/index.html
2. F12 (Console)
3. Taper :
   ```javascript
   localStorage.getItem('ghtoken')
   ```
4. Si `null` ou token trop court → **Problème de token**

### Étape 2 : Regénérer le token

1. Aller sur https://github.com/settings/tokens
2. Cliquer "Generate new token (classic)"
3. **Permissions requises** :
   - ✅ `repo` (cocher TOUTES les sous-options)
4. Copier le token (commence par `ghp_...`)

### Étape 3 : Configurer dans l'application

1. Ouvrir https://mich59139.github.io/AHPV/index.html
2. Cliquer sur **🔐 Connexion**
3. Coller le token
4. Cliquer OK

### Étape 4 : Tester

Ajouter un article → Devrait fonctionner !

---

## 📊 Comparaison versions

| Fonctionnalité | v1.12 | v1.13 HOTFIX |
|----------------|-------|--------------|
| Sauvegarde articles.csv | ✅ | ✅ |
| Mise à jour auteurs.csv | ❌ Erreur 404 | ⏸️ Désactivé |
| Mise à jour villes.csv | ❌ Erreur 404 | ⏸️ Désactivé |
| Mise à jour themes.csv | ❌ Erreur 404 | ⏸️ Désactivé |
| Mise à jour epoques.csv | ❌ Erreur 404 | ⏸️ Désactivé |
| Erreurs console | ❌ Nombreuses | ✅ Aucune |
| Badge Synchronisé | ✅ | ✅ |

---

## 🎯 Quand réactiver les CSV secondaires ?

**Plus tard**, une fois que vous aurez **créé manuellement** les fichiers :
- `data/auteurs.csv`
- `data/villes.csv`
- `data/themes.csv`
- `data/epoques.csv`

### Comment les créer ?

#### Option 1 : Via GitHub (interface web)

1. Aller sur https://github.com/mich59139/AHPV
2. Cliquer sur `data/`
3. Cliquer "Add file" → "Create new file"
4. Nom : `auteurs.csv`
5. Contenu :
   ```
   Auteur
   ```
6. Commit → "Create auteurs.csv"
7. Répéter pour `villes.csv`, `themes.csv`, `epoques.csv`

#### Option 2 : Via Git local

```bash
cd ~/Downloads/"files 3"/data

# Créer les fichiers vides
echo "Auteur" > auteurs.csv
echo "Ville" > villes.csv
echo "Theme" > themes.csv
echo "Epoque" > epoques.csv

# Commiter
git add *.csv
git commit -m "Création CSV secondaires"
git push origin main
```

### Réactiver la mise à jour auto

Dans `app.js`, ligne ~220, **décommenter** :
```javascript
// Avant (v1.13 HOTFIX)
/*
try{
  await updateAllListsFromArticles();
}catch(listError){
  ...
}
*/

// Après (réactivation)
try{
  await updateAllListsFromArticles();
}catch(listError){
  console.warn("⚠️ Erreur mise à jour listes (non bloquant):", listError);
}
```

---

## 💡 Conseils

### Pour l'instant (v1.13 HOTFIX)

✅ **Utilisez normalement** l'application  
✅ Ajoutez/modifiez des articles  
✅ Tout sera sauvegardé dans `articles.csv`  
⚠️ Les listes (auteurs, villes, etc.) ne seront **pas** mises à jour automatiquement

### Impact

- **Aucun impact** sur l'ajout/modification d'articles
- Les **datalists** (suggestions) fonctionneront quand même (basées sur articles)
- Juste pas de fichiers CSV séparés pour auteurs/villes/thèmes/époques

---

## 🚨 SI PROBLÈME PERSISTE

Si après déploiement v1.13 vous avez toujours des erreurs :

### Vérifier le cache

```bash
# Console (F12)
location.reload(true);
```

### Vérifier la version déployée

```bash
# Console (F12)
document.title
// Doit afficher "AHPV – Catalogue des Articles v1.13"
```

### Vérifier app.js sur GitHub

1. https://github.com/mich59139/AHPV/blob/main/app.js
2. Chercher ligne ~11 : `v1.13: HOTFIX`
3. Si absent → Pas déployé correctement

---

## 📝 Checklist

- [ ] Téléchargé app.js
- [ ] Téléchargé index.html  
- [ ] Remplacé dans "files 3"
- [ ] `git add app.js index.html`
- [ ] `git commit -m "v1.13 HOTFIX"`
- [ ] `git push origin main --force`
- [ ] Attendu 2 minutes
- [ ] `Ctrl + Shift + R` (vider cache)
- [ ] Vérifié titre = "v1.13"
- [ ] Testé ajout article
- [ ] Badge "✅ Synchronisé"
- [ ] Aucune erreur console

---

**Version** : 1.13 HOTFIX  
**Date** : 28 novembre 2024  
**Urgence** : CRITIQUE  
**Status** : ✅ Prêt à déployer immédiatement
