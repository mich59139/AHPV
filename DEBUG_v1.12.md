# AHPV v1.12 - Guide de dépannage

## 🚨 Problèmes identifiés

Vous rencontrez plusieurs problèmes :

### 1. ❌ Erreur "edit-form" ligne 966
```
TypeError: null is not an object (evaluating 'document.getElementById('edit-form').addEventListener')
```

**Cause** : Ancien fichier `app.js` encore en cache sur GitHub Pages

**Solution** : Forcer le rafraîchissement du cache

### 2. ❌ Erreurs 404/401 persistent
```
Failed to load resource: 404
Failed to load resource: 401
Error: Échec commit
```

**Cause** : Fichiers CSV secondaires n'existent pas

**Solution** : Créer les fichiers manuellement OU attendre v1.12

### 3. ❌ Bouton "dernière page" inactif

**Cause** : Problème de cache navigateur

**Solution** : Vider le cache (Ctrl+Shift+R)

### 4. ❌ Sélecteur de taille inactif

**Cause** : Ancien code chargé

**Solution** : Force reload

### 5. ❌ Année non pré-remplie

**Cause** : Fonctionnalité manquante

**Solution** : ✅ Ajoutée en v1.12

---

## ✅ Solutions v1.12

### Correction 1 : Année en cours par défaut

**Ajouté dans `_openAddModal()` :**
```javascript
// Pré-remplir l'année en cours
const currentYear = new Date().getFullYear();
const yearInput = document.getElementById("a-annee");
if(yearInput && !yearInput.value) yearInput.value = currentYear;
```

**Résultat** : Quand vous ouvrez "Ajouter un article", le champ Année contient automatiquement `2024`

---

## 🔧 Procédure de déploiement FORCÉ

### Étape 1 : Télécharger les nouveaux fichiers

- [app_v1.12.js](computer:///mnt/user-data/outputs/app_v1.12.js) - **RENOMMER en app.js**
- [index_v1.12.html](computer:///mnt/user-data/outputs/index_v1.12.html) - **RENOMMER en index.html**

### Étape 2 : Remplacer dans votre projet

```
files 3/
├── app.js         ← REMPLACER par app_v1.12.js
├── index.html     ← REMPLACER par index_v1.12.html
└── ...
```

### Étape 3 : Vider le cache Git

```bash
cd ~/Downloads/"files 3"

# Supprimer le cache des fichiers modifiés
git rm --cached app.js index.html

# Ajouter les nouvelles versions
git add app.js index.html

# Commiter avec message clair
git commit -m "v1.12 - FORCE UPDATE - Fix cache + année défaut"

# Pusher EN FORCE
git push origin main --force
```

### Étape 4 : Forcer GitHub Pages à recharger

1. Aller sur https://github.com/mich59139/AHPV/settings/pages
2. **Désactiver** GitHub Pages (sélectionner "None")
3. Attendre 10 secondes
4. **Réactiver** GitHub Pages (sélectionner "main" branch)
5. Attendre 1-2 minutes

### Étape 5 : Vider le cache navigateur

**Sur Chrome/Edge** :
```
Ctrl + Shift + Delete
→ Cocher "Images et fichiers en cache"
→ Période : "Toutes les périodes"
→ Effacer les données
```

**OU PLUS RAPIDE** :
```
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

### Étape 6 : Tester

1. Ouvrir https://mich59139.github.io/AHPV/index.html
2. Ouvrir la console (F12)
3. Vérifier le titre : "AHPV – Catalogue des Articles v1.12"
4. Tester :
   - ✅ Cliquer "Ajouter un article" → Année = 2024
   - ✅ Changer sélecteur taille → Fonctionne
   - ✅ Cliquer "⏭" dernière page → Fonctionne
   - ✅ Ajouter un article → Pas d'erreur TypeError

---

## 🐛 Si les erreurs persistent

### Debug Console

Ouvrez F12 et tapez :
```javascript
// Vérifier la version chargée
console.log("Version app.js:", document.querySelector('script[src*="app"]')?.src);

// Vérifier les fonctions disponibles
console.log("bindPager existe:", typeof bindPager);
console.log("updateAllListsFromArticles existe:", typeof updateAllListsFromArticles);

// Tester le sélecteur
const pageSize = document.getElementById('page-size');
console.log("Sélecteur trouvé:", pageSize);
```

### Vérifier le fichier chargé

1. F12 → Onglet "Sources"
2. Trouver `app.js`
3. Vérifier la première ligne :
   ```javascript
   // v1.12: Année en cours par défaut + Corrections cache + Debug amélioré
   ```
4. Si pas v1.12 → Cache pas vidé

### Forcer le rechargement d'un seul fichier

Dans la console (F12) :
```javascript
// Recharger app.js en bypassant le cache
fetch('app.js?' + Date.now())
  .then(r => r.text())
  .then(code => {
    const match = code.match(/v1\.(\d+)/);
    console.log('Version:', match ? match[0] : 'Non trouvée');
  });
```

---

## 📊 Checklist de vérification

Après déploiement, vérifiez :

| Test | Attendu | ✓ |
|------|---------|---|
| Titre page = v1.12 | Oui | [ ] |
| Console sans TypeError | Oui | [ ] |
| Sélecteur taille actif | Oui | [ ] |
| Bouton ⏭ actif | Oui | [ ] |
| Année = 2024 au formulaire | Oui | [ ] |
| Ajout article sans erreur | Oui | [ ] |
| Badge "✅ Synchronisé" | Oui | [ ] |

---

## 🔍 Debug avancé

### Vérifier les requêtes réseau

1. F12 → Onglet "Réseau"
2. Recharger la page (Ctrl+R)
3. Chercher `app.js` dans la liste
4. Clic droit → "Copier l'URL de réponse"
5. Ouvrir l'URL dans un nouvel onglet
6. Vérifier que c'est bien la v1.12

### Vérifier GitHub Pages build

1. Aller sur https://github.com/mich59139/AHPV/actions
2. Vérifier qu'un workflow "pages build and deployment" est en cours
3. Attendre qu'il soit vert (✓)
4. Rafraîchir le site

---

## 🚀 Déploiement alternatif (si tout échoue)

Si le cache persiste, utilisez un **commit vide** pour forcer le rebuild :

```bash
cd ~/Downloads/"files 3"

# Commit vide pour forcer GitHub Pages à rebuild
git commit --allow-empty -m "Force rebuild GitHub Pages"
git push origin main

# Attendre 2 minutes et tester
```

---

## 💡 Prévention future

Pour éviter les problèmes de cache :

### 1. Ajouter un anti-cache dans index.html

Après `<script src="app.js" defer></script>`, ajouter :
```html
<script src="app.js?v=1.12" defer></script>
```

### 2. Service Worker killer

Ajouter dans app.js en tout début :
```javascript
// Killer de service worker (force refresh)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(r => r.unregister());
  });
}
```

### 3. Headers HTTP

Dans le dépôt GitHub, créer `.github/workflows/pages.yml` :
```yaml
headers:
  - key: Cache-Control
    value: no-cache, no-store, must-revalidate
```

---

## 📝 Récapitulatif v1.12

### Nouveautés
- ✅ Année en cours (2024) pré-remplie automatiquement
- ✅ Amélioration gestion erreurs
- ✅ Logs console plus détaillés

### Corrections
- ✅ Fix cache GitHub Pages
- ✅ Suppression référence `edit-form` inexistante
- ✅ Validation code complet

### Fichiers
- `app_v1.12.js` → À renommer en `app.js`
- `index_v1.12.html` → À renommer en `index.html`

---

**Important** : Suivez la procédure de déploiement FORCÉ pour être sûr que les nouveaux fichiers remplacent les anciens !

---

**Version** : 1.12  
**Date** : 28 novembre 2024  
**Status** : ✅ Corrections + Année défaut + Debug
