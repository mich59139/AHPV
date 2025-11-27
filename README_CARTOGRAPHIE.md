# 🗺️ AHPV - Module de Cartographie

## 📋 Description

Module de **cartographie interactive** pour visualiser les 922 articles de la revue Mémoire sur une carte géographique.

Ce module s'ajoute au catalogue existant et permet de :
- 📍 Visualiser les articles par lieu géographique
- 🔍 Filtrer par thème, époque, auteur
- 📊 Consulter des statistiques
- 🗂️ Explorer les articles de manière spatiale

---

## 📦 Fichiers créés

### Pages web
- `carte.html` - Page de cartographie interactive
- `carte.css` - Styles assortis à la charte AHPV
- `carte.js` - Logique de la carte

### Fichiers existants
- `index.html` - Catalogue d'origine (inchangé)
- `app.js` - Logique du catalogue
- `style.css` - Styles du catalogue

### Données
- `data/articles.csv` - 922 articles
- `data/villes.csv` - Liste des villes
- `data/themes.csv` - Liste des thèmes
- `data/auteurs.csv` - Liste des auteurs

### Assets
- `assets/logo-ahpv.png` - Logo de l'association
- `assets/favicon.png` - Icône

---

## 🚀 Utilisation

### En local

1. **Lancer un serveur local** :
   ```bash
   cd ahpv_cartographie
   python3 -m http.server 8000
   ```

2. **Ouvrir dans le navigateur** :
   - Catalogue : http://localhost:8000/index.html
   - **Carte** : http://localhost:8000/carte.html

### Déploiement GitHub Pages

1. **Uploader tous les fichiers** sur votre dépôt GitHub `mich59139/AHPV`

2. **Activer GitHub Pages** :
   - Settings → Pages
   - Branch: `main`, folder: `/ (root)`
   - Save

3. **Accès** :
   - Catalogue : https://mich59139.github.io/AHPV/
   - **Carte** : https://mich59139.github.io/AHPV/carte.html

---

## 🎯 Fonctionnalités de la carte

### 📍 Carte interactive
- Marqueurs par ville
- Taille selon le nombre d'articles
- Clustering automatique
- Popup avec compteur
- Panel d'informations détaillées

### 🔍 Filtres avancés
- **Recherche** textuelle (titre, auteur, mots-clés)
- **Thèmes** : Résistance, Déportation, Vie locale, etc.
- **Époques** : XIXe, XXe, XXIe siècle
- **Numéros** : Filtrage par plage de numéros

### 📊 Statistiques
- Nombre total d'articles affichés
- Nombre de villes, auteurs, thèmes
- Top 10 des villes avec graphiques

### 🎨 Design
- Charte graphique AHPV (beige/olive)
- Responsive (mobile-friendly)
- Modales d'aide intégrées

---

## 🗺️ Villes géolocalisées

Le système inclut les coordonnées GPS de **50+ villes** :

**Principales** :
- Vizille (centre de la carte)
- Jarrie, Séchilienne
- Grenoble, Bourg d'Oisans
- Saint Georges de Commiers
- Claix, Varces, Champagnier
- L'Oisans, Livet, Gavet
- Et beaucoup d'autres...

**Villes avec plus de 10 articles** ont des marqueurs plus gros.

---

## 📊 Données

### Format articles.csv
```csv
Année,Numéro,Titre,Page(s),Auteur(s),Ville(s),Theme(s),Epoque
1991,Mémoire n°01,La bataille de Jarrie,14 à 17,Yvette Virot,Jarrie,"Religions, Guerres",-
```

### Champs utilisés
- **Ville(s)** : Liste séparée par virgules
- **Theme(s)** : Pour les filtres
- **Epoque** : Période historique
- **Numéro** : Pour filtrer par revue
- **Titre, Auteur(s)** : Pour la recherche

---

## 🔧 Personnalisation

### Ajouter une ville

Dans `carte.js`, section `VILLE_COORDINATES` :

```javascript
const VILLE_COORDINATES = {
    'Nouvelle Ville': [latitude, longitude],
    // ... autres villes
};
```

### Modifier les couleurs

Dans `carte.css`, section `:root` :

```css
:root {
    --accent: #6b8a21;  /* Couleur principale */
    --bg: #f3ead1;      /* Fond */
    /* ... */
}
```

### Ajouter des filtres

Dans `carte.js`, fonction `applyFilters()`.

---

## 🆕 Intégration avec le catalogue

Pour ajouter un lien vers la carte dans le catalogue existant :

### Dans index.html

Ajouter dans le header :

```html
<a href="carte.html" class="btn ghost">🗺️ Vue carte</a>
```

### Dans carte.html

Lien retour déjà présent :

```html
<a href="index.html" class="btn ghost">📋 Retour au catalogue</a>
```

---

## 📱 Responsive

- ✅ Desktop : Sidebar + Carte
- ✅ Tablet : Sidebar plein écran
- ✅ Mobile : Interface adaptée

---

## 🔍 Recherche

La recherche cherche dans :
- Titre de l'article
- Nom de l'auteur
- Thèmes
- Ville

**Astuce** : Tapez Entrée pour lancer la recherche rapidement.

---

## 📈 Statistiques disponibles

- **Nombre total** d'articles (filtrés)
- **Villes** mentionnées
- **Auteurs** différents
- **Thèmes** abordés
- **Top 10** des villes avec graphiques

---

## 🎓 Technologies utilisées

- **Leaflet 1.9.4** - Cartographie
- **Leaflet.markercluster** - Clustering
- **PapaParse 5.4.1** - Parsing CSV
- **Vanilla JavaScript** - Pas de framework
- **CSS Grid/Flexbox** - Layout moderne

---

## 🐛 Dépannage

### La carte ne charge pas
- Vérifiez que vous utilisez un serveur local
- Ouvrez la console (F12) pour voir les erreurs

### Les marqueurs n'apparaissent pas
- Vérifiez que `data/articles.csv` est accessible
- Vérifiez les coordonnées GPS dans `carte.js`

### Problème de filtres
- Cliquez sur "Réinitialiser" pour remettre à zéro
- Vérifiez la console pour des erreurs JS

---

## 🔄 Mise à jour des données

1. **Modifiez** `data/articles.csv`
2. **Ajoutez** les nouvelles villes dans `VILLE_COORDINATES` si nécessaire
3. **Rechargez** la page

---

## 📞 Support

Pour toute question :
1. Consultez ce README
2. Ouvrez la console (F12)
3. Vérifiez que tous les fichiers sont au bon endroit

---

## 🎯 Prochaines améliorations possibles

- [ ] Export PNG de la carte
- [ ] Timeline interactive (vue chronologique)
- [ ] Liens directs vers les PDFs des articles
- [ ] Recherche par auteur (autocomplete)
- [ ] Graphe de réseau thématique
- [ ] Heatmap des publications par période
- [ ] Vue 3D des données

---

## 📜 Licence

Projet AHPV - Amis de l'Histoire du Pays Vizillois

---

**Créé le 27 novembre 2025**  
**Version 1.0 - Module de cartographie interactive**

🗺️ Pour honorer la mémoire et partager l'histoire du Pays Vizillois
