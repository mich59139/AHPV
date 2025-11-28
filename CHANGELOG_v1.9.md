# AHPV v1.9 - Récapitulatif des modifications

## 🎯 Objectif principal

Implémenter la mise à jour automatique de TOUS les fichiers CSV (articles, auteurs, villes, thèmes, époques) directement depuis `index.html`, sans téléchargement manuel.

## ✅ Fonctionnalités ajoutées

### 1. Fonction `updateAllListsFromArticles()`

**Localisation** : `app.js` lignes ~120-180

**Ce qu'elle fait** :
- Parcourt tous les articles
- Extrait toutes les valeurs uniques (auteurs, villes, thèmes, époques)
- Trie et déduplique automatiquement
- Sauvegarde chaque CSV sur GitHub via l'API

**Déclenchement** :
- Automatique après chaque modification d'article
- Lors de l'ajout d'un article
- Lors de l'édition d'un article
- Lors de la suppression d'un article

### 2. Modification de `runQueuedSave()`

**Localisation** : `app.js` lignes ~180-210

**Changement** :
```javascript
// AVANT (v1.8)
await saveToGitHubRaw(toCSV(ARTICLES), payload.message);

// APRÈS (v1.9)
await saveToGitHubRaw(toCSV(ARTICLES), payload.message);
await updateAllListsFromArticles(); // ← AJOUTÉ
```

**Résultat** :
- Chaque sauvegarde d'articles déclenche automatiquement la mise à jour de tous les CSV
- Sauvegardes en parallèle pour optimiser le temps

### 3. Gestion des erreurs

**Comportement** :
- Si un CSV ne peut pas être sauvegardé → Warning dans console
- Les autres CSV continuent à être sauvegardés
- Badge "✅ Synchronisé" affiché même si un CSV échoue

## 📋 Fichiers modifiés

| Fichier | Modification | Lignes |
|---------|--------------|--------|
| `app.js` | Ajout `updateAllListsFromArticles()` | ~80 nouvelles lignes |
| `app.js` | Modification `runQueuedSave()` | ~5 lignes |
| `app.js` | Header version v1.9 | 2 lignes |
| `carte.js` | Header version v1.9 | 3 lignes |
| `carte.html` | Title v1.9 | 1 ligne |
| `README_v1.9.md` | Documentation complète | NOUVEAU |
| `DEPLOY_v1.9.md` | Guide déploiement | NOUVEAU |

## 🔄 Workflow complet

### Avant v1.9
```
Utilisateur modifie article
    ↓
Sauvegarde articles.csv
    ↓
Utilisateur va dans "Listes"
    ↓
Utilisateur clique "Sauvegarder" pour chaque liste
    ↓
Mise à jour manuelle de 4 CSV
```

### Après v1.9
```
Utilisateur modifie article
    ↓
Sauvegarde automatique de 5 CSV :
  - articles.csv
  - auteurs.csv
  - villes.csv
  - themes.csv
  - epoques.csv
    ↓
Badge "✅ Synchronisé"
    ↓
FIN
```

## 📊 Comparaison des versions

| Fonctionnalité | v1.8 | v1.9 |
|----------------|------|------|
| Édition articles | ✅ | ✅ |
| Modal édition | ✅ | ✅ |
| Bouton Retour | ✅ | ✅ |
| Sauvegarde articles.csv | ✅ | ✅ |
| Sauvegarde auteurs.csv | ❌ Manuel | ✅ Auto |
| Sauvegarde villes.csv | ❌ Manuel | ✅ Auto |
| Sauvegarde themes.csv | ❌ Manuel | ✅ Auto |
| Sauvegarde epoques.csv | ❌ Manuel | ✅ Auto |
| Dédoublonnage auto | ❌ | ✅ |
| Tri alphabétique auto | ❌ | ✅ |

## 🎨 Interface utilisateur

### Badge de statut

- **💾 Enregistrement…** : 1-3 secondes
- **✅ Synchronisé** : Affiché 2 secondes puis disparaît
- **⚠️ Échec** : Reste affiché jusqu'à correction

### Toast notifications

- "Modifié localement — cliquez 🔐 pour enregistrer" (si pas de token)
- "❌ Échec d'enregistrement GitHub" (si erreur)

## 🔧 Configuration requise

### GitHub Token

**Permissions nécessaires** :
- ✅ `repo` (accès complet au dépôt)
- ✅ `contents:write` (écriture des fichiers)

**Comment configurer** :
1. Cliquer sur 🔐 dans `index.html`
2. Générer token sur https://github.com/settings/tokens
3. Coller le token
4. Sauvegarder

### Structure des dossiers

```
AHPV/
├── data/
│   ├── articles.csv     ← Mis à jour automatiquement
│   ├── auteurs.csv      ← Mis à jour automatiquement
│   ├── villes.csv       ← Mis à jour automatiquement
│   ├── themes.csv       ← Mis à jour automatiquement
│   └── epoques.csv      ← Mis à jour automatiquement
├── carte.html
├── carte.js
├── carte.css
├── index.html
├── app.js
└── styles.css
```

## 🐛 Tests recommandés

### Test 1 : Ajout article avec nouvelle ville
1. Ajouter article avec "Ville(s): Chambéry"
2. Vérifier badge "✅ Synchronisé"
3. Ouvrir `data/villes.csv` sur GitHub
4. Confirmer que "Chambéry" est présent

### Test 2 : Suppression article
1. Supprimer un article
2. Vérifier que les listes sont mises à jour
3. Vérifier qu'aucun doublon n'est créé

### Test 3 : Édition article
1. Modifier "Ville(s)" d'un article
2. Vérifier que `villes.csv` contient les nouvelles valeurs
3. Vérifier que les anciennes valeurs sont supprimées si inutilisées

## 📈 Performance

### Temps de sauvegarde (estimé)

- **v1.8** : ~1s (1 CSV)
- **v1.9** : ~2-3s (5 CSV en parallèle)

### Optimisations implémentées

- ✅ Sauvegardes en parallèle (`Promise.all`)
- ✅ File d'attente pour regrouper les modifications
- ✅ Délai de 1,2s avant sauvegarde (évite trop de commits)

## 🎯 Prochaines améliorations possibles

- [ ] Historique des modifications (changelog)
- [ ] Bouton "Annuler" pour revenir en arrière
- [ ] Export automatique vers Google Drive
- [ ] Synchronisation temps réel entre utilisateurs
- [ ] Notification par email des modifications

## 📝 Notes techniques

### Gestion des accents

- La fonction `deburr()` normalise les accents
- Permet de détecter les doublons même avec variations d'accents

### Gestion des séparateurs

- Détection automatique : `;` `,` `/` `&` `•` `·`
- Conversion du mot "et" en séparateur

### Tri

- Tri français avec `localeCompare("fr", {sensitivity: "base"})`
- Tri numérique pour les années/numéros

## ⚠️ Limitations connues

1. **Token requis** : Sans token GitHub, pas de sauvegarde automatique
2. **Permissions** : Le token doit avoir les droits en écriture
3. **Rate limit** : GitHub limite à ~5000 requêtes/heure
4. **Taille fichiers** : API GitHub limitée à 100 MB par fichier

## 🚀 Déploiement

Voir `DEPLOY_v1.9.md` pour les instructions détaillées.

---

**Version** : 1.9  
**Date** : 28 novembre 2024  
**Auteur** : Assistant Claude  
**Statut** : ✅ Prêt pour déploiement
