// ============================================
// AHPV - Carte Interactive
// v2.0 - AMÉLIORATIONS CARTOGRAPHIQUES
// ============================================

// Configuration & Variables globales
const CONFIG = {
    mapCenter: [45.073, 5.773], // Vizille
    mapZoom: 11,
    csvPath: 'data/articles.csv'
};

// Coordonnées GPS (identiques à votre version)
const VILLE_COORDINATES = {
    'Allemond (38114)': [45.132, 6.040],
    "Bourg d'Oisans": [45.056, 6.030],
    'Bresson': [45.139, 5.740],
    'Champ sur Drac': [45.080, 5.733],
    'Champagnier': [45.112, 5.721],
    'Claix': [45.123, 5.673],
    'Dauphiné': [45.200, 5.700],
    'Eybens': [45.147, 5.753],
    'Fontaine': [45.192, 5.689],
    'France': [46.603, 2.440],
    'Gavet': [45.055, 5.870],
    'Grenoble': [45.188, 5.727],
    'Herbeys': [45.137, 5.798],
    'Isère': [45.200, 5.700],
    'Jarrie': [45.115, 5.758],
    "L'Oisans": [45.100, 6.000],
    'La Morte': [45.027, 5.862],
    'Laffrey': [45.008, 5.767],
    'Livet': [45.093, 5.915],
    'Monestier de Clermont': [44.919, 5.635],
    'Notre Dame de Mésage': [45.074, 5.749],
    'Pays vizillois': [45.073, 5.773],
    'Rioupéroux': [45.092, 5.903],
    'Saint Georges de Commiers': [45.046, 5.704],
    'Saint Martin de la Cluze': [45.031, 5.697],
    'Saint Pierre de Mésage': [45.070, 5.760],
    'Sassenage': [45.212, 5.661],
    'Séchilienne': [45.054, 5.835],
    'Uriage': [45.147, 5.826],
    'Varces': [45.092, 5.676],
    'Vaulnaveys le bas': [45.107, 5.811],
    'Vaulnaveys le haut': [45.115, 5.825],
    'Vizille': [45.073, 5.773]
};

let map;
let markers = [];
let markerClusterGroup;
let allArticles = [];
let filteredArticles = [];
let currentEditIndex = -1; 

// ============================================
// Initialisation
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadData();
    initEventListeners();
    initModalListeners(); 
    
    // Ouvrir automatiquement le panneau de filtres (ajustement de la méthode d'ouverture)
    setTimeout(() => {
        const sidebar = document.getElementById('sidebar');
        const mapElement = document.getElementById('map');
        if(sidebar && mapElement) {
            sidebar.classList.add('active');
            mapElement.classList.add('map-shifted'); // Appliquer le décalage à la carte
            
            // Forcer Leaflet à redessiner la carte après le décalage CSS
            setTimeout(() => {
                if (map) map.invalidateSize();
            }, 300); // 300ms correspond à la durée de transition CSS
        }
    }, 500);
});

// ============================================
// Initialisation de la carte
// ============================================

function initMap() {
    map = L.map('map', {
        center: CONFIG.mapCenter,
        zoom: CONFIG.mapZoom,
        zoomControl: false
    });

    // ⭐ NOUVEAU : Fond de carte plus sobre (CartoDB Positron)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // ⭐ NOUVEAU : Fonction de style personnalisé des clusters (couleur par densité)
    const customClusterIcon = (cluster) => {
        const count = cluster.getChildCount();
        let className = 'marker-cluster';
        let color = 'var(--ghost)';
        
        // Définition de la couleur en fonction du nombre d'articles
        if (count < 10) {
            className += ' small-cluster';
            color = 'var(--ghost)'; // gris clair
        } else if (count < 50) {
            className += ' medium-cluster';
            color = 'var(--muted)'; // gris moyen
        } else {
            className += ' large-cluster';
            color = 'var(--accent)'; // vert AHPV
        }

        return L.divIcon({
            html: `<div style="background-color: ${color};">${count}</div>`,
            className: className,
            iconSize: L.point(40, 40)
        });
    };

    // Remplacement de l'initialisation du cluster
    markerClusterGroup = L.markerClusterGroup({
        disableClusteringAtZoom: 15,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        iconCreateFunction: customClusterIcon // Utilisation de la nouvelle fonction
    });
    map.addLayer(markerClusterGroup);

    // Bouton Accueil
    L.Control.Home = L.Control.extend({
        onAdd: function () {
            const btn = L.DomUtil.create('button', 'btn btn-secondary leaflet-bar-part');
            btn.innerHTML = '⌂';
            btn.title = 'Recentrer sur le Pays vizillois';
            
            btn.onclick = (e) => {
                L.DomEvent.stopPropagation(e);
                map.setView(CONFIG.mapCenter, CONFIG.mapZoom);
            };
            return btn;
        },
        onRemove: function () {}
    });

    L.control.home = function (opts) { return new L.Control.Home(opts); };
    L.control.home({ position: 'topright' }).addTo(map);

    initLegend();
}

// ============================================
// Légende
// ============================================

function initLegend() {
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = `
            <div style="font-weight:bold; margin-bottom:6px;">Légende</div>
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <span style="width:16px; height:16px; border-radius:50%; background:var(--accent); display:inline-block;"></span>
                <span>Pays vizillois</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
                <span style="width:16px; height:16px; border-radius:50%; background:#555; display:inline-block;"></span>
                <span>Autre localisation</span>
            </div>
            <hr style="border-color: #eee; margin: 8px 0;">
            <div style="font-weight:bold; margin-bottom:6px;">Densité d'articles</div>
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <span style="width:14px; height:14px; border-radius:50%; background:var(--ghost); display:inline-block;"></span>
                <span>Faible (&lt;10)</span>
            </div>
             <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <span style="width:14px; height:14px; border-radius:50%; background:var(--muted); display:inline-block;"></span>
                <span>Moyenne (&lt;50)</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
                <span style="width:14px; height:14px; border-radius:50%; background:var(--accent); display:inline-block;"></span>
                <span>Forte (&gt;50)</span>
            </div>
        `;
        return div;
    };
    legend.addTo(map);
}

// ============================================
// Chargement des données
// ============================================

function loadData() {
    // Utilisation de la bibliothèque Papa Parse (doit être incluse dans votre HTML)
    if (typeof Papa === 'undefined') {
        console.error("Papa Parse n'est pas chargé. Assurez-vous d'inclure la bibliothèque.");
        hideLoading();
        return;
    }
    
    Papa.parse(CONFIG.csvPath, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            // Nettoyage initial
            allArticles = results.data.map(article => ({
                ...article,
                Titre: article.Titre || '',
                'Auteur(s)': article['Auteur(s)'] || '',
                'Ville(s)': article['Ville(s)'] || '',
                'Theme(s)': article['Theme(s)'] || '',
                'Epoque': article['Epoque'] || '',
                'Année': article['Année'] || '',
                'Numero': article['Numero'] || article['Numéro'] || ''
            }));

            filteredArticles = allArticles;
            populateFilters();
            applyFilters(); // Ceci déclenchera processData()
            hideLoading();
        },
        error: (error) => {
            console.error('Erreur CSV:', error);
            hideLoading();
            alert("Erreur de chargement du fichier CSV.");
        }
    });
}

// ============================================
// Filtres (Peuplement)
// ============================================

function populateFilters() {
    populateVillesFilters();
    populateThemesFilters();
    populateEpoquesFilters();
    populateStats();
}

function populateVillesFilters() {
    const villesSet = new Set();
    allArticles.forEach(article => {
        const villes = article['Ville(s)']?.split(',').map(v => v.trim()) || [];
        villes.forEach(ville => {
            if (ville && ville !== '-') villesSet.add(ville);
        });
    });
    
    const container = document.getElementById('villesFilters');
    if(!container) return;
    container.innerHTML = ''; // Reset pour éviter doublons

    const villesArray = Array.from(villesSet);
    const villesWithCount = villesArray.map(ville => {
        const count = allArticles.filter(a => a['Ville(s)']?.includes(ville)).length;
        return { ville, count };
    });
    
    villesWithCount.sort((a, b) => a.ville.localeCompare(b.ville, 'fr', { sensitivity: 'base' }));
    
    villesWithCount.forEach(({ ville, count }) => {
        const option = document.createElement('option');
        option.value = ville;
        option.textContent = `${ville} (${count})`;
        option.selected = true;
        container.appendChild(option);
    });
    
    container.addEventListener('change', applyFilters);
}

function populateThemesFilters() {
    const themesCount = {};
    allArticles.forEach(article => {
        const themes = article['Theme(s)']?.split(',').map(t => t.trim()) || [];
        themes.forEach(theme => {
            if (!theme || theme === '-') return;
            themesCount[theme] = (themesCount[theme] || 0) + 1;
        });
    });

    const container = document.getElementById('themesFilters');
    if(!container) return;
    container.innerHTML = '';

    Object.entries(themesCount)
        .sort((a, b) => b[1] - a[1]) // Tri par popularité (décroissant)
        .forEach(([theme, count]) => {
            const option = document.createElement('option');
            option.value = theme;
            option.textContent = `${theme} (${count})`;
            option.selected = true;
            container.appendChild(option);
        });
        
    container.addEventListener('change', applyFilters);
}

function populateEpoquesFilters() {
    const epoquesCount = {};
    allArticles.forEach(article => {
        const epoque = article['Epoque']?.trim();
        if (epoque && epoque !== '-') {
            epoquesCount[epoque] = (epoquesCount[epoque] || 0) + 1;
        }
    });

    const container = document.getElementById('epoquesFilters');
    if(!container) return;
    container.innerHTML = '';

    Object.entries(epoquesCount)
        .sort((a, b) => a[0].localeCompare(b[0], 'fr', { numeric: true }))
        .forEach(([epoque, count]) => {
            const option = document.createElement('option');
            option.value = epoque;
            option.textContent = `${epoque} (${count})`;
            option.selected = true;
            container.appendChild(option);
        });
        
    container.addEventListener('change', applyFilters);
}

function populateStats() {
    // Affichage des statistiques (compteur)
    const statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) return;

    const themes = new Set();
    const auteurs = new Set();
    allArticles.forEach(article => {
        article['Theme(s)']?.split(',').map(t => t.trim()).filter(Boolean).forEach(t => themes.add(t));
        article['Auteur(s)']?.split(',').map(a => a.trim()).filter(Boolean).forEach(a => auteurs.add(a));
    });

    statsContainer.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 10px; text-align:center;">
            <div style="padding:20px; background:var(--bg); border-radius:8px; border: 1px solid var(--border);">
                <h3 style="font-size:2em; margin:0; color:var(--accent);">${allArticles.length}</h3>
                <p>Articles</p>
            </div>
            <div style="padding:20px; background:var(--bg); border-radius:8px; border: 1px solid var(--border);">
                <h3 style="font-size:2em; margin:0; color:var(--accent);">${Object.keys(VILLE_COORDINATES).length}</h3>
                <p>Lieux cartographiés</p>
            </div>
            <div style="padding:20px; background:var(--bg); border-radius:8px; border: 1px solid var(--border);">
                <h3 style="font-size:2em; margin:0; color:var(--accent);">${themes.size}</h3>
                <p>Thèmes</p>
            </div>
            <div style="padding:20px; background:var(--bg); border-radius:8px; border: 1px solid var(--border);">
                <h3 style="font-size:2em; margin:0; color:var(--accent);">${auteurs.size}</h3>
                <p>Auteurs uniques</p>
            </div>
        </div>
    `;
}

// ============================================
// Logique de Filtrage
// ============================================

function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const modeInput = document.querySelector('input[name="filterMode"]:checked');
    const activeMode = modeInput ? modeInput.value : 'all';
    
    // Filtres sélection/multiselect
    const selectedVilles = Array.from(document.getElementById('villesFilters')?.selectedOptions || []).map(opt => opt.value);
    const selectedThemes = Array.from(document.getElementById('themesFilters')?.selectedOptions || []).map(opt => opt.value);
    const selectedEpoques = Array.from(document.getElementById('epoquesFilters')?.selectedOptions || []).map(opt => opt.value);

    // Filtres Numéro et Année
    const numMin = parseInt(document.getElementById('numMin')?.value) || 0;
    const numMax = parseInt(document.getElementById('numMax')?.value) || Infinity;
    const anneeMin = parseInt(document.getElementById('anneeMin')?.value) || 0;
    const anneeMax = parseInt(document.getElementById('anneeMax')?.value) || Infinity;

    filteredArticles = allArticles.filter(article => {
        // 1. Recherche Texte (Titre, Auteurs, Villes, Thèmes, Epoque, Numéro)
        const articleText = `${article.Titre} ${article['Auteur(s)']} ${article['Ville(s)']} ${article['Theme(s)']} ${article.Epoque} ${article.Numero}`.toLowerCase();
        if (searchTerm && !articleText.includes(searchTerm)) return false;

        // 2. Filtres Numéro
        const numero = parseInt(article.Numero) || 0;
        if (numero < numMin || numero > numMax) return false;

        // 3. Filtres Année
        const annee = parseInt(article.Année) || 0;
        if (annee < anneeMin || annee > anneeMax) return false;

        // 4. Filtre Thèmes
        const articleThemes = (article['Theme(s)'] || '').split(',').map(t => t.trim()).filter(Boolean);
        const themesMatch = selectedThemes.length === 0 || articleThemes.some(t => selectedThemes.includes(t));
        if (!themesMatch) return false;

        // 5. Filtre Époques
        const articleEpoque = article.Epoque?.trim();
        const epoquesMatch = selectedEpoques.length === 0 || (articleEpoque && selectedEpoques.includes(articleEpoque));
        if (!epoquesMatch) return false;
        
        // 6. Filtre Villes (Mode Exclusif uniquement)
        if (activeMode === 'ville') {
            const articleVilles = (article['Ville(s)'] || '').split(',').map(v => v.trim()).filter(Boolean);
            const villesMatch = selectedVilles.length === 0 || articleVilles.some(v => selectedVilles.includes(v));
            if (!villesMatch) return false;
        }

        return true;
    });

    processData();
    updateResultCount(filteredArticles.length);
}


function updateResultCount(count) {
    const countElement = document.getElementById('resultCount');
    if (countElement) {
        countElement.textContent = `${count} article${count > 1 ? 's' : ''}`;
    }
}

function onFilterModeChange() {
    const villeSelectContainer = document.getElementById('villeSelectContainer');
    const mode = document.querySelector('input[name="filterMode"]:checked')?.value;
    
    if (villeSelectContainer) {
        // Affiche le sélecteur Villes uniquement si le mode est 'ville'
        villeSelectContainer.style.display = (mode === 'ville') ? 'block' : 'none';
    }
    
    // Réapplique les filtres pour tenir compte du changement de mode (qui peut désactiver le filtre ville)
    applyFilters();
}

function resetFilters() {
    // Réinitialisation de la recherche et des champs de texte
    document.getElementById('searchInput').value = '';
    document.getElementById('numMin').value = '';
    document.getElementById('numMax').value = '';
    document.getElementById('anneeMin').value = '';
    document.getElementById('anneeMax').value = '';

    // Remettre le mode à 'all' et cacher le sélecteur de villes
    document.getElementById('filterModeAll').checked = true;
    onFilterModeChange(); // Ceci cache la liste de villes et gère applyFilters

    // Sélectionner 'Tout' pour les multisélections (Villes est géré par onFilterModeChange)
    ['themesFilters', 'epoquesFilters'].forEach(id => {
        const select = document.getElementById(id);
        if(select) Array.from(select.options).forEach(opt => opt.selected = true);
    });
    
    // Si on a gardé la liste de villes visible, il faut la réinitialiser
    const villesSelect = document.getElementById('villesFilters');
    if(villesSelect) Array.from(villesSelect.options).forEach(opt => opt.selected = true);

    applyFilters();
}

// ============================================
// Carte & Marqueurs
// ============================================

function processData() {
    let selectedVilles = [];
    let activeMode = 'none';
    const modeInput = document.querySelector('input[name="filterMode"]:checked');
    if (modeInput) activeMode = modeInput.value;
    if (activeMode === 'ville') {
        const villesSelect = document.getElementById('villesFilters');
        if (villesSelect) {
            selectedVilles = Array.from(villesSelect.selectedOptions).map(opt => opt.value);
        }
    }
    
    const articlesByVille = {};
    filteredArticles.forEach(article => {
        const villes = (article['Ville(s)'] || '').split(',').map(v => v.trim()).filter(Boolean);
        let villesForMarkers = villes;
        
        if (activeMode === 'ville' && selectedVilles.length > 0) {
            villesForMarkers = villes.filter(v => selectedVilles.includes(v));
        }

        villesForMarkers.forEach(ville => {
            if (!ville || ville === '-' || !VILLE_COORDINATES[ville]) return;
            if (!articlesByVille[ville]) articlesByVille[ville] = [];
            articlesByVille[ville].push(article);
        });
    });
    
    markerClusterGroup.clearLayers();
    markers = [];

    for (const [ville, articles] of Object.entries(articlesByVille)) {
        createMarker(ville, articles, VILLE_COORDINATES[ville]);
    }
    
    // Ajout des marqueurs au cluster group
    markerClusterGroup.addLayers(markers);

    // ⭐ NOUVEAU : Recentrage automatique sur les résultats filtrés
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        
        // Calcul du padding (340px est la largeur de la sidebar)
        const sidebarActive = document.getElementById('sidebar')?.classList.contains('active');
        const infoPanelActive = document.getElementById('infoPanel')?.classList.contains('active');
        
        // On suppose que la sidebar et l'infoPanel ont la même largeur
        const paddingLeft = sidebarActive ? 340 + 50 : 50; 
        const paddingRight = infoPanelActive ? 340 + 50 : 50;
        
        map.fitBounds(group.getBounds(), { 
            paddingTopLeft: [paddingLeft, 50],
            paddingBottomRight: [paddingRight, 50],
            maxZoom: CONFIG.mapZoom + 3 // Empêche un zoom trop profond
        });
    } else {
        // Retour à la vue par défaut si aucun résultat
        map.setView(CONFIG.mapCenter, CONFIG.mapZoom); 
    }

    // Si le panneau d'info est ouvert, le mettre à jour
    const infoPanel = document.getElementById('infoPanel');
    const villeAffichee = infoPanel?.dataset.ville;
    if (infoPanel?.classList.contains('active') && villeAffichee) {
        showInfoPanel(villeAffichee); // Force la mise à jour si la ville est dans les filtres
    }
}


function createMarker(ville, articles, coords) {
    const isPaysVizille = ['Vizille','Jarrie','Séchilienne','Saint Georges de Commiers', 'Champ sur Drac','Notre Dame de Mésage','Saint Pierre de Mésage', 'Vaulnaveys le bas','Vaulnaveys le haut','Uriage','Champagnier', 'Bresson','Herbeys','Varces','Claix','Pays vizillois'].includes(ville);
    
    // Utilisation de la variable CSS --accent pour la couleur Vizillois
    const markerHtml = `
        <div class="custom-marker" style="background:${isPaysVizille ? 'var(--accent)' : '#555'};">
            ${ville}
        </div>
    `;

    const marker = L.marker(coords, {
        icon: L.divIcon({
            className: 'ahpv-marker',
            html: markerHtml,
            iconSize: [200, 30],
            iconAnchor: [100, 15]
        })
    });

    // ⭐ NOUVEAU : Calcul et affichage des statistiques pour le popup
    const totalArticles = articles.length;
    const articlesVizillois = articles.filter(a => a['Pays Vizillois'] === 'OUI').length;
    
    // Calcul de la période couverte
    const anneeMin = articles.reduce((min, a) => Math.min(min, a['Année'] ? parseInt(a['Année']) : Infinity), Infinity);
    const anneeMax = articles.reduce((max, a) => Math.max(max, a['Année'] ? parseInt(a['Année']) : 0), 0);
    const anneeMinDisplay = anneeMin !== Infinity ? anneeMin : '?';
    const anneeMaxDisplay = anneeMax !== 0 ? anneeMax : '?';

    const popupContent = `
        <div class="popup-content">
            <h4 style="margin-bottom: 5px;">${ville}</h4>
            <hr style="border-color: #eee; margin: 5px 0 10px 0;">
            <p><strong>${totalArticles} article${totalArticles > 1 ? 's' : ''}</strong></p>
            ${articlesVizillois > 0 ? `<p style="font-size: 0.9em; color: var(--accent);">Dont ${articlesVizillois} sur le Pays Vizillois</p>` : ''}
            
            ${totalArticles > 0 ? `
                <p style="font-size: 0.85em; margin-top: 10px;">
                    Période couverte : <strong>${anneeMinDisplay}</strong> – <strong>${anneeMaxDisplay}</strong>
                </p>
            ` : ''}

            <button class="btn-popup" onclick="showInfoPanel('${ville}')">Voir les détails</button>
        </div>
    `;

    marker.bindPopup(popupContent, {
        offset: [0, -30]
    });

    markers.push(marker);
}


function showInfoPanel(ville) {
    // ... (Votre fonction showInfoPanel existante)
    const infoPanel = document.getElementById('infoPanel');
    const infoContent = document.getElementById('infoContent');
    const panelTitle = document.getElementById('panelTitle');

    if (!infoPanel || !infoContent || !panelTitle) return;

    infoPanel.dataset.ville = ville;
    panelTitle.textContent = ville;

    const articlesForVille = filteredArticles.filter(article => 
        (article['Ville(s)'] || '').split(',').map(v => v.trim()).includes(ville)
    );

    let htmlContent = '';
    
    if (articlesForVille.length === 0) {
        htmlContent = `<p class="muted">Aucun article trouvé pour ${ville} avec les filtres actuels.</p>`;
    } else {
        articlesForVille.sort((a, b) => (parseInt(b.Année) || 0) - (parseInt(a.Année) || 0)); // Tri par année
        htmlContent = articlesForVille.map((article, index) => {
            // Trouver l'index global de l'article pour l'édition
            const globalIndex = allArticles.findIndex(a => a.Titre === article.Titre && a.Numero === article.Numero);
            
            const isVizillois = article['Pays Vizillois'] === 'OUI';
            const themes = (article['Theme(s)'] || '').split(',').filter(t => t.trim()).join(' / ');
            
            return `
                <div class="article-card">
                    <h4>${article.Titre}</h4>
                    <div class="article-meta">
                        <span><strong style="color:var(--text);">Année :</strong> ${article.Année || '-'}</span>
                        <span><strong style="color:var(--text);">N° :</strong> ${article.Numero || '-'}</span>
                        <span><strong style="color:var(--text);">Auteur(s) :</strong> ${article['Auteur(s)'] || '-'}</span>
                        ${isVizillois ? '<span style="color:var(--accent); font-weight:600;">Pays Vizillois</span>' : ''}
                    </div>
                    ${themes ? `<p class="article-themes">Thèmes : ${themes}</p>` : ''}
                    <div class="article-actions">
                        ${globalIndex !== -1 ? `<button class="btn-edit" onclick="window.openEditModal(${globalIndex})">✍️ Modifier</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    infoContent.innerHTML = htmlContent;
    infoPanel.classList.add('active');

    // Forcer le redessin de la carte si elle a été décalée
    const mapElement = document.getElementById('map');
    if (mapElement) {
        mapElement.classList.add('map-shifted-panel');
        setTimeout(() => map.invalidateSize(), 300);
    }
}

function hideInfoPanel() {
    // ... (Votre fonction hideInfoPanel existante)
    const infoPanel = document.getElementById('infoPanel');
    if (infoPanel) infoPanel.classList.remove('active');
    
    // Retirer le décalage de la carte
    const mapElement = document.getElementById('map');
    if (mapElement) {
        mapElement.classList.remove('map-shifted-panel');
        setTimeout(() => map.invalidateSize(), 300);
    }
    infoPanel.dataset.ville = '';
}

// ============================================
// Utilitaires
// ============================================

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden'); 
    else document.getElementById('loading')?.remove();
}

function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}


function setupMultiSelectHelpers(name, selectId) {
    const checkBtn = document.getElementById(`checkAll${name}`);
    const uncheckBtn = document.getElementById(`uncheckAll${name}`);
    const select = document.getElementById(selectId);

    if (checkBtn && select) {
        checkBtn.addEventListener('click', () => {
            Array.from(select.options).forEach(opt => opt.selected = true);
            applyFilters();
        });
    }

    if (uncheckBtn && select) {
        uncheckBtn.addEventListener('click', () => {
            Array.from(select.options).forEach(opt => opt.selected = false);
            applyFilters();
        });
    }
}

// ============================================
// Gestion des Événements
// ============================================

function initEventListeners() {
    const toggleBtn = document.getElementById('toggleSidebar');
    const sidebar = document.getElementById('sidebar');
    const mapElement = document.getElementById('map');
    
    // 🌟 CORRECTION INTERACTION CARTE/SIDEBAR
    if(toggleBtn && sidebar && mapElement) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            mapElement.classList.toggle('map-shifted'); // Ajout/Retrait du décalage
            
            // S'assurer que Leaflet redessine la carte après le changement de taille
            setTimeout(() => {
                if (map) {
                    map.invalidateSize();
                }
            }, 300); // Délai calé sur la transition CSS
        });
    }

    // Panel Close
    const closeInfoBtn = document.getElementById('closeInfo');
    if(closeInfoBtn) closeInfoBtn.addEventListener('click', hideInfoPanel);
    const backBtn = document.getElementById('backFromPanel');
    if(backBtn) backBtn.addEventListener('click', hideInfoPanel);

    // Recherche
    const searchInput = document.getElementById('searchInput');
    if(searchInput) searchInput.addEventListener('input', debounce(applyFilters, 300));
    
    // Modes
    document.querySelectorAll('input[name="filterMode"]').forEach(radio => {
        radio.addEventListener('change', onFilterModeChange);
    });

    // Reset (Correction ID)
    const resetBtn = document.getElementById('resetFilters');
    if(resetBtn) resetBtn.addEventListener('click', resetFilters);
    
    // Filtres Numéro et Année (déclenché à chaque frappe)
    document.getElementById('numMin')?.addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('numMax')?.addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('anneeMin')?.addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('anneeMax')?.addEventListener('input', debounce(applyFilters, 300));

    // Sélection multiple helpers
    setupMultiSelectHelpers('Themes', 'themesFilters');
    setupMultiSelectHelpers('Epoques', 'epoquesFilters');
    setupMultiSelectHelpers('Villes', 'villesFilters');
}

// ============================================
// Gestion de la modale d'édition (simulée)
// ============================================

function initModalListeners() {
    const modal = document.getElementById('editModal');
    if (modal) {
        // Bouton Annuler
        document.getElementById('cancelEdit')?.addEventListener('click', () => {
            modal.close();
        });
        
        // Soumission du formulaire
        document.getElementById('editForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            saveArticleChanges();
        });
    }
}

// Fonction globale appelée par le bouton "Modifier" dans le HTML généré
window.openEditModal = function(globalIndex) {
    const article = allArticles[globalIndex];
    if (!article) return;
    currentEditIndex = globalIndex;

    // Remplir le formulaire
    document.getElementById('editAnnee').value = article.Année || '';
    document.getElementById('editNumero').value = article.Numero || '';
    document.getElementById('editTitre').value = article.Titre || '';
    document.getElementById('editPages').value = article['Page(s)'] || '';
    document.getElementById('editAuteurs').value = article['Auteur(s)'] || '';
    document.getElementById('editVilles').value = article['Ville(s)'] || '';
    document.getElementById('editThemes').value = article['Theme(s)'] || '';
    document.getElementById('editEpoque').value = article.Epoque || '';
    
    // Masquer le statut d'édition
    document.getElementById('editStatus').style.display = 'none';
    
    // Afficher la modale
    const modal = document.getElementById('editModal');
    if (modal) modal.showModal();
}

function saveArticleChanges() {
    const statusDiv = document.getElementById('editStatus');
    if (!statusDiv) return;

    // 1. Récupérer les nouvelles valeurs
    const newArticle = {
        'Année': document.getElementById('editAnnee').value,
        'Numero': document.getElementById('editNumero').value,
        'Titre': document.getElementById('editTitre').value,
        'Page(s)': document.getElementById('editPages').value,
        'Auteur(s)': document.getElementById('editAuteurs').value,
        'Ville(s)': document.getElementById('editVilles').value,
        'Theme(s)': document.getElementById('editThemes').value,
        'Epoque': document.getElementById('editEpoque').value,
        // Conserver les autres champs non éditables si nécessaire (ex: Pays Vizillois)
        'Pays Vizillois': allArticles[currentEditIndex]['Pays Vizillois'] || 'NON'
    };

    // 2. Mettre à jour l'article dans la source de données (simulée)
    if (currentEditIndex !== -1) {
        allArticles[currentEditIndex] = newArticle;
        
        // 3. Informer l'utilisateur (simulé)
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = 'var(--accent)';
        statusDiv.style.color = 'white';
        statusDiv.innerHTML = '✅ Article mis à jour localement. (La sauvegarde sur GitHub nécessite le catalogue complet).';

        // 4. Forcer la mise à jour de la carte/filtres après un délai
        setTimeout(() => {
            const modal = document.getElementById('editModal');
            if (modal) modal.close();
            
            // Recharger les filtres (les listes de sélection peuvent avoir changé)
            populateFilters(); 
            applyFilters();
            
        }, 1500); 
    }
}
