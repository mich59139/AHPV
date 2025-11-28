# Guide de déploiement AHPV v1.9

## Déployer sur GitHub

### Option 1 : Écraser (recommandé si sauvegarde faite)

```bash
cd ~/Downloads/"files 3"
git add .
git commit -m "v1.9 - Mise à jour automatique de tous les CSV"
git push origin main --force
```

### Option 2 : Fusionner (si changements sur GitHub)

```bash
cd ~/Downloads/"files 3"
git pull origin main --allow-unrelated-histories
git add .
git commit -m "v1.9 - Mise à jour automatique de tous les CSV"
git push origin main
```

## Fichiers modifiés v1.9

- ✅ `app.js` - Ajout fonction `updateAllListsFromArticles()`
- ✅ `carte.js` - Header version v1.9
- ✅ `carte.html` - Title version v1.9
- ✅ `README_v1.9.md` - Documentation

## Vérification après déploiement

1. Ouvrir https://mich59139.github.io/AHPV/index.html
2. Configurer le token GitHub (bouton 🔐)
3. Ajouter un article test
4. Vérifier que le badge affiche "✅ Synchronisé"
5. Vérifier sur GitHub que tous les CSV ont été mis à jour

## URLs

- Catalogue : https://mich59139.github.io/AHPV/index.html
- Carte : https://mich59139.github.io/AHPV/carte.html

## En cas de problème

- Vérifier que le token GitHub est valide
- Vérifier les permissions en écriture sur le dépôt
- Regarder la console navigateur (F12) pour les erreurs
