# AHPV - Carte Interactive v1.9

## 🎯 Nouveauté v1.9 : Mise à jour automatique de TOUS les CSV

### Fonctionnement

Lorsque vous modifiez les articles dans `index.html` (catalogue), le système met maintenant à jour **automatiquement et simultanément** tous les fichiers CSV :

1. **`articles.csv`** ← Articles modifiés/ajoutés/supprimés
2. **`auteurs.csv`** ← Liste extraite automatiquement des articles
3. **`villes.csv`** ← Liste extraite automatiquement des articles
4. **`themes.csv`** ← Liste extraite automatiquement des articles
5. **`epoques.csv`** ← Liste extraite automatiquement des articles

### Avantages

✅ **Cohérence garantie** : Les listes sont toujours synchronisées avec les articles
✅ **Gain de temps** : Plus besoin de mettre à jour manuellement chaque CSV
✅ **Pas de doublons** : Les listes sont automatiquement dédupliquées et triées
✅ **Sauvegarde unique** : Un seul clic sauvegarde tout sur GitHub

### Prérequis

Pour que la sauvegarde automatique fonctionne, vous devez :

1. **Configurer votre token GitHub** dans `index.html` (bouton 🔐)
2. **Avoir les droits en écriture** sur le dépôt GitHub

### Comment ça marche ?

**Quand vous ajoutez/modifiez/supprimez un article :**

```
1. Modification article dans index.html
   ↓
2. Sauvegarde de articles.csv sur GitHub
   ↓
3. Extraction automatique :
   - Tous les auteurs mentionnés → auteurs.csv
   - Toutes les villes mentionnées → villes.csv
   - Tous les thèmes mentionnés → themes.csv
   - Toutes les époques mentionnées → epoques.csv
   ↓
4. Sauvegarde de tous les CSV sur GitHub
   ↓
5. Badge "✅ Synchronisé"
```

### Exemples

**Exemple 1 : Ajout d'un nouvel article**

Article ajouté :
- Auteurs : "Jean Dupont; Marie Martin"
- Villes : "Grenoble; Vizille"
- Thèmes : "Architecture; Urbanisme"
- Époque : "XIXe siècle"

Résultat automatique :
- ✅ `auteurs.csv` contient maintenant "Jean Dupont" et "Marie Martin"
- ✅ `villes.csv` contient maintenant "Grenoble" et "Vizille"
- ✅ `themes.csv` contient maintenant "Architecture" et "Urbanisme"
- ✅ `epoques.csv` contient maintenant "XIXe siècle"

**Exemple 2 : Suppression d'un article**

Si vous supprimez le dernier article mentionnant "Lyon", alors "Lyon" disparaîtra automatiquement de `villes.csv`.

### Badge de statut

Le badge en haut à droite indique l'état :

- 💾 **Enregistrement…** : Sauvegarde en cours
- ✅ **Synchronisé** : Tout est sauvegardé sur GitHub
- ⚠️ **Échec** : Erreur de sauvegarde (vérifiez votre token)

### Mode invité (sans token)

Si vous n'avez pas configuré de token GitHub :
- ✅ Les modifications fonctionnent **localement** dans votre navigateur
- ❌ Rien n'est sauvegardé sur GitHub
- 📥 Utilisez le bouton "Télécharger CSV" pour récupérer vos modifications

### Historique des versions

- **v1.0-v1.5** : Carte de base avec filtres
- **v1.6** : Édition d'articles (temporaire)
- **v1.7** : Corrections bugs (édition + statistiques)
- **v1.8** : Modal d'édition catalogue + Bouton Retour
- **v1.9** : **Mise à jour automatique de TOUS les CSV** ← VERSION ACTUELLE

### Support

Pour toute question ou problème, contactez l'équipe AHPV.

---

**Déployé sur** : https://mich59139.github.io/AHPV/
