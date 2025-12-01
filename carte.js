// ============================================
// AHPV - Carte Interactive
// v1.9 - Compatible avec système auto-update des CSV
// ============================================
// Configuration & Variables globales
// ============================================

const CONFIG = {
    mapCenter: [45.073, 5.773], // Vizille
    mapZoom: 11,
    csvPath: 'data/articles.csv'
};

// Coordonnées GPS des principales villes
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

// ============================================
// Initialisation
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadData();
    initEventListeners();
    
    // Ouvrir automatiquement le panneau de filtres
    setTimeout(() => {
        document.querySelector('.sidebar').classList.add('active');
        document.querySelector('.btn-toggle-sidebar').style.left = 'calc(var(--sidebar-width) + 20px)';
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

    // Fond de carte
    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        attribution: '&copy; contributeurs OpenStreetMap',
        maxZoom: 19
    }).addTo(map);

    // Contrôles
    L.control.zoom({ position: 'topright' }).addTo(map);

    markerClusterGroup = L.markerClusterGroup({
        disableClusteringAtZoom: 15,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        maxClusterRadius: 50
    });
    map.addLayer(markerClusterGroup);

    // Bouton "Accueil"
    L.Control.Home = L.Control.extend({
        onAdd: function () {
            const btn = L.DomUtil.create('button', 'btn btn-secondary leaflet-bar-part');
            btn.innerHTML = '⌂';
            btn.title = 'Recentrer sur le Pays vizillois';
            btn.style.cursor = 'pointer';
            btn.style.width = '32px';
            btn.style.height = '32px';
            btn.style.padding = '0';
            btn.style.lineHeight = '32px';
            btn.style.textAlign = 'center';
            btn.style.fontSize = '18px';
            btn.style.borderRadius = '8px';
            
            btn.onclick = () => {
                map.setView(CONFIG.mapCenter, CONFIG.mapZoom);
            };
            return btn;
        },

        onRemove: function () {}
    });

    L.control.home = function (opts) {
        return new L.Control.Home(opts);
    };

    L.control.home({ position: 'topright' }).addTo(map);

    // Legende
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
                <span style="width:16px; height:16px; border-radius:50%; background:#6b8a21; display:inline-block;"></span>
                <span>Ville du Pays vizillois</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
                <span style="width:16px; height:16px; border-radius:50%; background:#888; display:inline-block;"></span>
                <span>Autre localisation</span>
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
    Papa.parse(CONFIG.csvPath, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            allArticles = results.data;

            // Nettoyer les champs pour éviter les undefined
            allArticles = allArticles.map(article => ({
                ...article,
                Titre: article.Titre || '',
                'Auteur(s)': article['Auteur(s)'] || '',
                'Ville(s)': article['Ville(s)'] || '',
                'Theme(s)': article['Theme(s)'] || '',
                'Epoque': article['Epoque'] || ''
            }));

            filteredArticles = allArticles;
            populateFilters();
            applyFilters();
            hideLoading();
        },
        error: (error) => {
            console.error('Erreur de chargement CSV:', error);
            hideLoading();
        }
    });
}

// ============================================
// Filtres
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
    // Construction avec comptage (pour l'affichage)
    const villesArray = Array.from(villesSet);
    const villesWithCount = villesArray.map(ville => {
        const count = allArticles.filter(a => 
            a['Ville(s)']?.includes(ville)
        ).length;
        return { ville, count };
    });
    // Tri alphabétique par nom de ville
    villesWithCount.sort((a, b) => a.ville.localeCompare(b.ville, 'fr', { sensitivity: 'base' }));
    
    villesWithCount.forEach(({ ville, count }) => {
        const option = document.createElement('option');
        option.value = ville;
        option.textContent = `${ville} (${count})`;
        option.selected = true;
        container.appendChild(option);
    });
    
    // Événement change
    container.addEventListener('change', applyFilters);
}

function createFilterOption(value, count, type) {
    const div = document.createElement('div');
    div.className = 'filter-option';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `${type}-${value}`;
    checkbox.value = value;
    checkbox.checked = true;
    
    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = value;
    
    const countSpan = document.createElement('span');
    countSpan.className = 'count';
    countSpan.textContent = count;
    
    div.appendChild(checkbox);
    div.appendChild(label);
    div.appendChild(countSpan);
    
    return div;
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
    container.innerHTML = '';
    
    Object.entries(themesCount)
        .sort((a, b) => b[1] - a[1]) // tri par nombre d’articles
        .forEach(([theme, count]) => {
            const option = document.createElement('option');
            option.value = theme;
            option.textContent = `${theme} (${count})`;
            option.selected = true;
            container.appendChild(option);
        });
    
    document.getElementById('themesFilters').addEventListener('change', applyFilters);
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
    
    document.getElementById('epoquesFilters').addEventListener('change', applyFilters);
}

// ============================================
// Application des filtres
// ============================================

function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    // Déterminer le mode actif
    const activeMode = document.querySelector('input[name="filterMode"]:checked').value;
    
    // Récupérer les filtres selon le mode
    let selectedThemes = [];
    let selectedEpoques = [];
    let selectedVilles = [];
    
    if (activeMode === 'theme') {
        selectedThemes = Array.from(document.getElementById('themesFilters').selectedOptions)
            .map(opt => opt.value);
    } else if (activeMode === 'epoque') {
        selectedEpoques = Array.from(document.getElementById('epoquesFilters').selectedOptions)
            .map(opt => opt.value);
    } else if (activeMode === 'ville') {
        selectedVilles = Array.from(document.getElementById('villesFilters').selectedOptions)
            .map(opt => opt.value);
    }
    
    // Filtrage initial sur base texte + mode actif
    filteredArticles = allArticles.filter(article => {
        // Recherche texte
        if (searchTerm) {
            const searchableText = `${article.Titre} ${article['Auteur(s)']} ${article['Theme(s)']}`.toLowerCase();
            if (!searchableText.includes(searchTerm)) return false;
        }
        
        // Thèmes (seulement si mode actif)
        if (selectedThemes.length > 0) {
            const articleThemes = article['Theme(s)']?.split(',').map(t => t.trim()) || [];
            if (!articleThemes.some(t => selectedThemes.includes(t))) return false;
        }
        
        // Époques (seulement si mode actif)
        if (selectedEpoques.length > 0) {
            if (!selectedEpoques.includes(article['Epoque']?.trim())) return false;
        }
        
        // Villes (seulement si mode actif)
        if (selectedVilles.length > 0) {
            const articleVilles = article['Ville(s)']?.split(',').map(v => v.trim()) || [];
            if (!articleVilles.some(v => selectedVilles.includes(v))) return false;
        }
        
        return true;
    });
    
    processData();
    updateStats();
}

function resetFilters() {
    // Réinitialiser la recherche
    document.getElementById('searchInput').value = '';
    
    // Réinitialiser le mode à "Toutes les villes"
    document.querySelector('input[name="filterMode"][value="none"]').checked = true;
    
    // Cacher tous les filtres
    document.getElementById('villesFilterGroup').style.display = 'none';
    document.getElementById('themesFilterGroup').style.display = 'none';
    document.getElementById('epoquesFilterGroup').style.display = 'none';
    
    // Tout sélectionner dans chaque select
    Array.from(
        document.getElementById('villesFilters').options
    ).forEach(opt => opt.selected = true);
    Array.from(
        document.getElementById('themesFilters').options
    ).forEach(opt => opt.selected = true);
    Array.from(
        document.getElementById('epoquesFilters').options
    ).forEach(opt => opt.selected = true);
    
    filteredArticles = allArticles;
    processData();
    updateStats();
}

// ============================================
// Traitement des données & génération des marqueurs
// ============================================

function processData() {
    // On tient compte du mode de filtrage actif pour décider
    // quelles villes seront réellement matérialisées par un marqueur.
    let selectedVilles = [];
    let activeMode = 'none';

    const modeInput = document.querySelector('input[name="filterMode"]:checked');
    if (modeInput) {
        activeMode = modeInput.value;
    }

    if (activeMode === 'ville') {
        const villesSelect = document.getElementById('villesFilters');
        if (villesSelect) {
            selectedVilles = Array.from(villesSelect.selectedOptions).map(opt => opt.value);
        }
    }

    // Grouper les articles par ville (avec prise en compte du mode)
    const articlesByVille = {};

    filteredArticles.forEach(article => {
        const villes = (article['Ville(s)'] || '')
            .split(',')
            .map(v => v.trim())
            .filter(Boolean);

        // Par défaut, on utilise toutes les villes de l'article
        let villesForMarkers = villes;

        // Si on est en mode "Par ville" avec une sélection,
        // on ne garde que les villes sélectionnées.
        if (activeMode === 'ville' && selectedVilles.length > 0) {
            villesForMarkers = villes.filter(v => selectedVilles.includes(v));
        }

        villesForMarkers.forEach(ville => {
            if (!ville || ville === '-') return;

            if (!articlesByVille[ville]) {
                articlesByVille[ville] = [];
            }
            articlesByVille[ville].push(article);
        });
    });

    // Créer les marqueurs
    markerClusterGroup.clearLayers();
    markers = [];

    for (const [ville, articles] of Object.entries(articlesByVille)) {
        const coords = VILLE_COORDINATES[ville];
        if (coords) {
            createMarker(ville, articles, coords);
        }
    }
}

function createMarker(ville, articles, coords) {
    const isPaysVizille = 
        ville === 'Vizille' ||
        ville === 'Jarrie' ||
        ville === 'Séchilienne' ||
        ville === 'Saint Georges de Commiers' ||
        ville === 'Champ sur Drac' ||
        ville === 'Notre Dame de Mésage' ||
        ville === 'Saint Pierre de Mésage' ||
        ville === 'Vaulnaveys le bas' ||
        ville === 'Vaulnaveys le haut' ||
        ville === 'Uriage' ||
        ville === 'Champagnier' ||
        ville === 'Bresson' ||
        ville === 'Herbeys' ||
        ville === 'Varces' ||
        ville === 'Claix' ||
        ville === 'Pays vizillois';

    const markerHtml = `
        <div class="custom-marker" style="background:${isPaysVizille ? '#6b8a21' : '#555'};">
            <div class="marker-content">
                <span class="marker-ville">${ville}</span>
                <span class="marker-count">${articles.length}</span>
            </div>
        </div>
    `;

    const icon = L.divIcon({
        html: markerHtml,
        className: 'ahpv-marker',
        iconSize: [90, 30],
        iconAnchor: [45, 30]
    });

    const marker = L.marker(coords, { icon });
    
    marker.on('click', () => {
        showInfoPanel(ville, articles);
    });
    
    markerClusterGroup.addLayer(marker);
    markers.push(marker);
}

// ============================================
// Panneau d'infos
// ============================================

function showInfoPanel(ville, articles) {
    const panel = document.getElementById('infoPanel');
    const title = document.getElementById('infoTitle');
    const content = document.getElementById('infoContent');
    
    title.textContent = `${ville} — ${articles.length} article(s)`;
    content.innerHTML = generateArticlesHtml(articles);
    
    panel.classList.add('active');
}

function hideInfoPanel() {
    document.getElementById('infoPanel').classList.remove('active');
}

function generateArticlesHtml(articles) {
    let html = '';
    const maxDisplay = 30;
    
    articles.slice(0, maxDisplay).forEach((article, index) => {
        const numero = article.Numero || article['Numéro'] || '';
        const pages = article['Page(s)'] || '';
        const auteurs = article['Auteur(s)'] || '';
        const themes = article['Theme(s)'] || '';
        const epoque = article['Epoque'] || '';
        
        const articleId = `article-${index}`;
        
        html += `
            <div class="article-card" id="${articleId}">
                <h4>${article.Titre}</h4>
                <div class="article-meta">
                    <span>🗓️ ${article.Année || ''}</span>
                    <span>📘 ${numero}</span>
                    ${pages ? `<span>📄 ${pages}</span>` : ''}
                    ${auteurs ? `<span>✍️ ${auteurs}</span>` : ''}
                </div>
                ${themes ? `<div class="article-themes">🏷️ ${themes}</div>` : ''}
                ${epoque ? `<div class="article-themes">⏳ ${epoque}</div>` : ''}
                <div class="article-actions">
                    <button class="btn-edit" onclick="editArticle('${articleId}', ${index})">
                        ✏️ Modifier
                    </button>
                </div>
            </div>
        `;
    });
    
    if (articles.length > maxDisplay) {
        html += `<p class="muted" style="text-align:center; margin-top:16px; padding:12px; background:var(--bg); border-radius:10px;">
            <strong>... et ${articles.length - maxDisplay} autres articles</strong><br>
            <small>Utilisez les filtres pour affiner votre recherche</small>
        </p>`;
    }
    
    return html;
}

// ============================================
// Statistiques
// ============================================

function populateStats() {
    const totalArticles = allArticles.length;
    const uniqueVilles = new Set();
    const uniqueThemes = new Set();
    
    allArticles.forEach(article => {
        const villes = article['Ville(s)']?.split(',').map(v => v.trim()) || [];
        const themes = article['Theme(s)']?.split(',').map(t => t.trim()) || [];
        
        villes.forEach(ville => { if (ville) uniqueVilles.add(ville); });
        themes.forEach(theme => { if (theme) uniqueThemes.add(theme); });
    });
    
    document.getElementById('statTotalArticles').textContent = totalArticles;
    document.getElementById('statTotalVilles').textContent = uniqueVilles.size;
    document.getElementById('statTotalThemes').textContent = uniqueThemes.size;
}

function updateStats() {
    const totalArticles = filteredArticles.length;
    const uniqueVilles = new Set();
    
    filteredArticles.forEach(article => {
        const villes = article['Ville(s)']?.split(',').map(v => v.trim()) || [];
        villes.forEach(ville => { if (ville) uniqueVilles.add(ville); });
    });
    
    document.getElementById('statFilteredArticles').textContent = totalArticles;
    document.getElementById('statFilteredVilles').textContent = uniqueVilles.size;
}

// ============================================
// Gestion des événements UI
// ============================================

function initEventListeners() {
    // Bouton sidebar
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.querySelector('.btn-toggle-sidebar');
    
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        if (sidebar.classList.contains('active')) {
            toggleBtn.style.left = 'calc(var(--sidebar-width) + 20px)';
            toggleBtn.style.animation = 'none';
        } else {
            toggleBtn.style.left = '20px';
        }
    });
    
    // Bouton fermer panneau info
    document.getElementById('closeInfo').addEventListener('click', hideInfoPanel);
    
    // Bouton retour map
    document.getElementById('backToMap').addEventListener('click', () => {
        hideInfoPanel();
        map.setView(CONFIG.mapCenter, CONFIG.mapZoom);
    });
    
    // Recherche texte
    document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 300));
    
    // Mode de filtrage
    document.querySelectorAll('input[name="filterMode"]').forEach(radio => {
        radio.addEventListener('change', onFilterModeChange);
    });
    
    // Bouton reset
    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);
    
    // Boutons sélectionner/désélectionner tous les thèmes
    document.getElementById('checkAllThemes').addEventListener('click', () => {
        const select = document.getElementById('themesFilters');
        Array.from(select.options).forEach(opt => opt.selected = true);
        applyFilters();
    });
    
    document.getElementById('uncheckAllThemes').addEventListener('click', () => {
        const select = document.getElementById('themesFilters');
        Array.from(select.options).forEach(opt => opt.selected = false);
        applyFilters();
    });
    
    // Boutons sélectionner/désélectionner toutes les époques
    document.getElementById('checkAllEpoques').addEventListener('click', () => {
        const select = document.getElementById('epoquesFilters');
        Array.from(select.options).forEach(opt => opt.selected = true);
        applyFilters();
    });
    
    document.getElementById('uncheckAllEpoques').addEventListener('click', () => {
        const select = document.getElementById('epoquesFilters');
        Array.from(select.options).forEach(opt => opt.selected = false);
        applyFilters();
    });
    
    // Boutons sélectionner/désélectionner toutes les villes
    document.getElementById('checkAllVilles').addEventListener('click', () => {
        const select = document.getElementById('villesFilters');
        Array.from(select.options).forEach(opt => opt.selected = true);
        applyFilters();
    });
    
    document.getElementById('uncheckAllVilles').addEventListener('click', () => {
        const select = document.getElementById('villesFilters');
        Array.from(select.options).forEach(opt => opt.selected = false);
        applyFilters();
    });
}

function onFilterModeChange() {
    const activeMode = document.querySelector('input[name="filterMode"]:checked').value;
    
    // Afficher/masquer les groupes de filtres
    document.getElementById('villesFilterGroup').style.display = activeMode === 'ville' ? 'block' : 'none';
    document.getElementById('themesFilterGroup').style.display = activeMode === 'theme' ? 'block' : 'none';
    document.getElementById('epoquesFilterGroup').style.display = activeMode === 'epoque' ? 'block' : 'none';
    
    applyFilters();
}

// ============================================
// Utilitaires
// ============================================

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
}

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

// ============================================
// Édition (placeholder / à adapter si besoin)
// ============================================

function editArticle(articleId, indexInPanel) {
    const articleCard = document.getElementById(articleId);
    if (!articleCard) return;

    // Récupérer l’article correspondant dans filteredArticles
    const article = filteredArticles[indexInPanel];
    if (!article) return;

    // Préparer les champs d’édition (modale existante dans carte.html)
    const modal = document.getElementById('editModal');
    if (!modal) {
        alert('Édition non disponible dans cette version de la carte.');
        return;
    }

    document.getElementById('editTitre').value = article.Titre || '';
    document.getElementById('editAuteurs').value = article['Auteur(s)'] || '';
    document.getElementById('editVilles').value = article['Ville(s)'] || '';
    document.getElementById('editThemes').value = article['Theme(s)'] || '';
    document.getElementById('editEpoque').value = article['Epoque'] || '';

    modal.showModal();

    // Gestion du bouton "Enregistrer" dans la modale
    const saveBtn = document.getElementById('editSave');
    const cancelBtn = document.getElementById('editCancel');

    const onSave = () => {
        article.Titre = document.getElementById('editTitre').value.trim();
        article['Auteur(s)'] = document.getElementById('editAuteurs').value.trim();
        article['Ville(s)'] = document.getElementById('editVilles').value.trim();
        article['Theme(s)'] = document.getElementById('editThemes').value.trim();
        article['Epoque'] = document.getElementById('editEpoque').value.trim();

        // Mettre à jour allArticles (source globale)
        const idxGlobal = allArticles.findIndex(a =>
            a.Titre === article.Titre &&
            a['Auteur(s)'] === article['Auteur(s)'] &&
            a['Ville(s)'] === article['Ville(s)']
        );

        if (idxGlobal !== -1) {
            allArticles[idxGlobal] = { ...article };
        }

        populateFilters();
        applyFilters();

        showEditStatus('success', '✓ Article modifié avec succès !');

        setTimeout(() => {
            modal.close();
        }, 1500);

        saveBtn.removeEventListener('click', onSave);
        cancelBtn.removeEventListener('click', onCancel);
    };

    const onCancel = () => {
        modal.close();
        saveBtn.removeEventListener('click', onSave);
        cancelBtn.removeEventListener('click', onCancel);
    };

    saveBtn.addEventListener('click', onSave);
    cancelBtn.addEventListener('click', onCancel);
}

function showEditStatus(type, message) {
    const status = document.getElementById('editStatus');
    status.className = `edit-status ${type}`;
    status.textContent = message;
    status.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }
}
