// ============================================
// AHPV - Carte Interactive
// v2.1 - 69 lieux cartographiés
// ============================================

// Configuration & Variables globales
const CONFIG = {
    mapCenter: [45.073, 5.773], // Vizille
    mapZoom: 11,
    csvPath: 'data/articles.csv'
};

// Coordonnées GPS - v2.1 avec 69 lieux
const VILLE_COORDINATES = {
    'Allemond (38114)': [45.132, 6.040],
    'Belledonne': [45.200, 5.980],
    "Bessey d'Oz": [45.098, 6.050],
    "Bourg d'Oisans": [45.056, 6.030],
    'Brandes en Oisans': [45.103, 6.082],
    'Bresson': [45.139, 5.740],
    'Brié': [45.125, 5.793],
    'Brié et Angonnes': [45.125, 5.793],
    'Canton (38220)': [45.073, 5.773],
    'Champ sur Drac': [45.080, 5.733],
    'Champagnier': [45.112, 5.721],
    'Chamrousse': [45.117, 5.878],
    'Cholonge': [44.979, 5.741],
    'Claix': [45.123, 5.673],
    'Clelles': [44.822, 5.631],
    'Comboire (Échirolles)': [45.135, 5.714],
    'Crots': [44.545, 6.447],
    'Dauphiné': [45.200, 5.700],
    'Eybens': [45.147, 5.753],
    'Fontaine': [45.192, 5.689],
    'France': [46.603, 2.440],
    'france': [46.603, 2.440],
    'Gavet': [45.055, 5.870],
    'Grenoble': [45.188, 5.727],
    'Haute-Jarrie': [45.092, 5.763],
    'Herbeys': [45.137, 5.798],
    'Isère': [45.200, 5.700],
    'Jarrie': [45.115, 5.758],
    "L'Alpe d'Huez": [45.092, 6.072],
    "L'Oisans": [45.100, 6.000],
    'La Morte': [45.027, 5.862],
    'La Paute': [45.080, 5.897],
    'Laffrey': [45.008, 5.767],
    'Livet': [45.093, 5.915],
    'Livet et Gavet': [45.093, 5.915],
    'Lyon': [45.764, 4.835],
    'Massif de Belledonne': [45.200, 5.980],
    'Matheysine': [44.967, 5.783],
    'Monestier de Clermont': [44.919, 5.635],
    'Mont Aiguille': [44.844, 5.554],
    'Montchaboud': [45.125, 5.770],
    'Montchaffrey': [45.110, 5.829],
    'Montjean': [45.046, 5.718],
    'Notre Dame de Mésage': [45.074, 5.749],
    'Oisans ou Vizille': [45.073, 5.773],
    'Pays Vizillois': [45.073, 5.773],
    'Pays vizillois': [45.073, 5.773],
    'Pellafol': [44.778, 5.893],
    'Petichet': [44.991, 5.765],
    'Rioupéroux': [45.092, 5.903],
    'Saint Barthélémy de Séchilienne': [45.031, 5.823],
    'Saint Georges de Commiers': [45.046, 5.704],
    'Saint Jean de Vaux': [45.052, 5.768],
    'Saint Martin de la Cluze': [45.031, 5.697],
    'Saint Paul de Varces': [45.069, 5.663],
    'Saint Pierre de Mésage': [45.070, 5.760],
    'Saint-Maurice-en-Trièves': [44.859, 5.681],
    'Sassenage': [45.212, 5.661],
    'Séchilienne': [45.054, 5.835],
    'Tavernolles': [45.042, 5.695],
    'Uriage': [45.147, 5.826],
    'Varces': [45.092, 5.676],
    'Vaulnaveys': [45.111, 5.818],
    'Vaulnaveys le bas': [45.107, 5.811],
    'Vaulnaveys le haut': [45.115, 5.825],
    'Verdun': [49.160, 5.387],
    "Villeneuve d'Uriage": [45.137, 5.842],
    'Vizille': [45.073, 5.773],
    'vizille': [45.073, 5.773]
};

// Normaliser les noms de villes (apostrophes, espaces)
function normalizeVilleName(name) {
    if (!name) return '';
    return name.trim()
        .replace(/'/g, "'")  // apostrophe courbe → droite
        .replace(/'/g, "'")  // autre apostrophe → droite
        .replace(/\s+/g, ' '); // espaces multiples
}

// Chercher les coordonnées avec normalisation
function getVilleCoordinates(ville) {
    if (!ville) return null;
    
    // Essai direct
    if (VILLE_COORDINATES[ville]) return VILLE_COORDINATES[ville];
    
    // Essai normalisé
    const normalized = normalizeVilleName(ville);
    for (const [key, coords] of Object.entries(VILLE_COORDINATES)) {
        if (normalizeVilleName(key) === normalized) {
            return coords;
        }
    }
    
    // Essai insensible à la casse
    const lowerVille = normalized.toLowerCase();
    for (const [key, coords] of Object.entries(VILLE_COORDINATES)) {
        if (normalizeVilleName(key).toLowerCase() === lowerVille) {
            return coords;
        }
    }
    
    return null;
}

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
    
    // 🔧 CORRECTION : Ouvrir la sidebar UNIQUEMENT sur desktop
    setTimeout(() => {
        const sidebar = document.getElementById('sidebar');
        const mapElement = document.getElementById('map');
        const isMobile = window.innerWidth <= 768;
        
        // Ne PAS ouvrir automatiquement sur mobile
        if(sidebar && mapElement && !isMobile) {
            sidebar.classList.add('active');
            mapElement.classList.add('map-shifted');
            
            setTimeout(() => {
                if (map) map.invalidateSize();
            }, 300);
        }
    }, 500);
});

// ============================================
// Initialisation de la carte
// ============================================

function initMap() {
    const isMobile = window.innerWidth <= 768;
    
    map = L.map('map', {
        center: CONFIG.mapCenter,
        zoom: isMobile ? CONFIG.mapZoom - 1 : CONFIG.mapZoom,
        zoomControl: false,
        tap: true,
        touchZoom: true,
        bounceAtZoomLimits: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    markerClusterGroup = L.markerClusterGroup({
        disableClusteringAtZoom: isMobile ? 14 : 15,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        maxClusterRadius: isMobile ? 60 : 50
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
    
    // Gérer le redimensionnement (rotation écran)
    window.addEventListener('resize', debounce(() => {
        if (map) map.invalidateSize();
    }, 200));
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
                <span style="width:16px; height:16px; border-radius:50%; background:#1e3a5f; display:inline-block;"></span>
                <span>Pays vizillois</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
                <span style="width:16px; height:16px; border-radius:50%; background:#6b5c4a; display:inline-block;"></span>
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
    if (typeof Papa === 'undefined') {
        console.error("Papa Parse n'est pas chargé.");
        hideLoading();
        return;
    }
    
    Papa.parse(CONFIG.csvPath, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
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
            applyFilters();
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
    container.innerHTML = '';

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
        const primaryTheme = (article['Theme(s)'] || '').split(',').map(t => t.trim()).filter(Boolean)[0];

        if (primaryTheme && primaryTheme !== '-') {
            themesCount[primaryTheme] = (themesCount[primaryTheme] || 0) + 1;
        }
    });

    const container = document.getElementById('themesFilters');
    if(!container) return;
    container.innerHTML = '';
    
    Object.entries(themesCount)
        .sort((a, b) => b[1] - a[1])
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

// ============================================
// Logique de Filtrage
// ============================================

function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    const modeInput = document.querySelector('input[name="filterMode"]:checked');
    const activeMode = modeInput ? modeInput.value : 'none';
    
    let selectedThemes = [];
    let selectedEpoques = [];
    let selectedVilles = [];
    
    if (activeMode === 'theme') {
        const el = document.getElementById('themesFilters');
        if(el) selectedThemes = Array.from(el.selectedOptions).map(opt => opt.value);
    } else if (activeMode === 'epoque') {
        const el = document.getElementById('epoquesFilters');
        if(el) selectedEpoques = Array.from(el.selectedOptions).map(opt => opt.value);
    } else if (activeMode === 'ville') {
        const el = document.getElementById('villesFilters');
        if(el) selectedVilles = Array.from(el.selectedOptions).map(opt => opt.value);
    }
    
    filteredArticles = allArticles.filter(article => {
        if (searchTerm) {
            const searchableText = `${article.Titre} ${article['Auteur(s)']} ${article['Theme(s)']}`.toLowerCase();
            if (!searchableText.includes(searchTerm)) return false;
        }
        
        if (selectedThemes.length > 0) {
            const primaryTheme = (article['Theme(s)'] || '').split(',').map(t => t.trim()).filter(Boolean)[0];
            if (!primaryTheme || !selectedThemes.includes(primaryTheme)) return false;
        }
        
        if (selectedEpoques.length > 0) {
            if (!selectedEpoques.includes(article['Epoque']?.trim())) return false;
        }
        
        if (selectedVilles.length > 0) {
            const vs = article['Ville(s)']?.split(',').map(v => v.trim()) || [];
            if (!vs.some(v => selectedVilles.includes(v))) return false;
        }
        
        return true;
    });
    
    processData();
    updateStats();
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    const radioNone = document.querySelector('input[name="filterMode"][value="none"]');
    if(radioNone) radioNone.checked = true;
    
    ['villesFilterGroup', 'themesFilterGroup', 'epoquesFilterGroup'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    
    ['villesFilters', 'themesFilters', 'epoquesFilters'].forEach(id => {
        const select = document.getElementById(id);
        if(select) Array.from(select.options).forEach(opt => opt.selected = true);
    });
    
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
            const coords = getVilleCoordinates(ville);
            if (!ville || ville === '-' || !coords) return;
            if (!articlesByVille[ville]) articlesByVille[ville] = [];
            articlesByVille[ville].push(article);
        });
    });

    markerClusterGroup.clearLayers();
    markers = [];

    for (const [ville, articles] of Object.entries(articlesByVille)) {
        const coords = getVilleCoordinates(ville);
        if (coords) createMarker(ville, articles, coords);
    }
}

function createMarker(ville, articles, coords) {
    const isPaysVizille = ['Vizille','Jarrie','Séchilienne','Saint Georges de Commiers',
    'Champ sur Drac','Notre Dame de Mésage','Saint Pierre de Mésage',
    'Vaulnaveys le bas','Vaulnaveys le haut','Uriage','Champagnier',
    'Bresson','Herbeys','Varces','Claix','Pays vizillois', 'Vaulnaveys (seul)'].includes(ville);

    const markerHtml = `
        <div class="custom-marker" style="background:${isPaysVizille ? '#1e3a5f' : '#6b5c4a'};">
            <div class="marker-content">
                <span class="marker-ville">${ville}</span>
                <span class="marker-count">${articles.length}</span>
            </div>
        </div>
    `;

    // Taille automatique pour s'adapter au contenu
    const icon = L.divIcon({
        html: markerHtml,
        className: 'ahpv-marker',
        iconSize: null,  // Taille automatique
        iconAnchor: [0, 0]  // Sera ajusté par CSS
    });

    const marker = L.marker(coords, { icon });
    marker.on('click', () => showInfoPanel(ville, articles));
    markerClusterGroup.addLayer(marker);
    markers.push(marker);
}

// ============================================
// Panel Latéral (Info Articles)
// ============================================

function showInfoPanel(ville, articles) {
    const panel = document.getElementById('infoPanel');
    const title = document.getElementById('infoPanelTitle'); 
    const content = document.getElementById('infoPanelContent'); 
    
    if(title) title.textContent = `${ville} — ${articles.length} article(s)`;
    if(content) content.innerHTML = generateArticlesHtml(articles);
    
    panel.classList.add('active');
}

function hideInfoPanel() {
    document.getElementById('infoPanel').classList.remove('active');
}

function generateArticlesHtml(articles) {
    let html = '';
    const maxDisplay = 30;
    
    articles.slice(0, maxDisplay).forEach((article, index) => {
        const globalIndex = allArticles.indexOf(article);
        const articleId = `article-card-${index}`;
        
        html += `
            <div class="article-card" id="${articleId}">
                <h4>${article.Titre}</h4>
                <div class="article-meta">
                    <span>🗓️ ${article['Année']}</span>
                    <span>📘 ${article.Numero}</span>
                    ${article['Page(s)'] ? `<span>📄 ${article['Page(s)']}</span>` : ''}
                </div>
                 <div class="article-meta" style="margin-top:4px;">
                     ${article['Auteur(s)'] ? `<span>✍️ ${article['Auteur(s)']}</span>` : ''}
                 </div>
                ${article['Theme(s)'] ? `<div class="article-themes">🏷️ ${article['Theme(s)']}</div>` : ''}
                
                <div class="article-actions">
                    <button class="btn-edit" onclick="openEditModal(${globalIndex})">
                        ✏️ Modifier
                    </button>
                </div>
            </div>
        `;
    });
    
    if (articles.length > maxDisplay) {
        html += `<p class="muted" style="text-align:center;">... et ${articles.length - maxDisplay} autres articles.</p>`;
    }
    return html;
}

// ============================================
// Gestion des Événements
// ============================================

function initEventListeners() {
    const toggleBtn = document.getElementById('toggleSidebar');
    const sidebar = document.getElementById('sidebar');
    const mapElement = document.getElementById('map');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    
    // 🔧 Fonction pour fermer la sidebar
    function closeSidebar() {
        sidebar.classList.remove('active');
        mapElement.classList.remove('map-shifted');
        if (toggleBtn) {
            toggleBtn.style.left = window.innerWidth <= 768 ? '12px' : '20px';
        }
        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 300);
    }
    
    // 🔧 Fonction pour ouvrir la sidebar
    function openSidebar() {
        sidebar.classList.add('active');
        // Ne pas décaler la carte sur mobile
        if (window.innerWidth > 768) {
            mapElement.classList.add('map-shifted');
        }
        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 300);
    }
    
    // Toggle sidebar avec le bouton hamburger
    if(toggleBtn && sidebar && mapElement) {
        toggleBtn.addEventListener('click', () => {
            if (sidebar.classList.contains('active')) {
                closeSidebar();
            } else {
                openSidebar();
            }
            
            // Mise à jour position du bouton
            if (window.innerWidth <= 768) {
                toggleBtn.style.left = sidebar.classList.contains('active') ? 'calc(85% - 60px)' : '12px';
            } else {
                toggleBtn.style.left = sidebar.classList.contains('active') ? 'calc(var(--sidebar-width) + 20px)' : '20px';
            }
        });
    }
    
    // 🔧 CORRECTION : Bouton × dans la sidebar
    if(closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeSidebar);
    }
    
    // Fermer la sidebar en cliquant sur la carte (mobile)
    if(mapElement) {
        mapElement.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
                if (!e.target.closest('.leaflet-marker-icon') && 
                    !e.target.closest('.leaflet-popup') &&
                    !e.target.closest('.custom-marker')) {
                    closeSidebar();
                }
            }
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

    // Modes de filtrage
    document.querySelectorAll('input[name="filterMode"]').forEach(radio => {
        radio.addEventListener('change', onFilterModeChange);
    });

    // Reset
    const resetBtn = document.getElementById('resetFilters'); 
    if(resetBtn) resetBtn.addEventListener('click', resetFilters);

    // Sélection multiple helpers
    setupMultiSelectHelpers('Themes', 'themesFilters');
    setupMultiSelectHelpers('Epoques', 'epoquesFilters');
    setupMultiSelectHelpers('Villes', 'villesFilters');
}

function setupMultiSelectHelpers(name, selectId) {
    const checkBtn = document.getElementById(`checkAll${name}`);
    const uncheckBtn = document.getElementById(`uncheckAll${name}`);
    
    if(checkBtn) {
        checkBtn.addEventListener('click', () => {
            const select = document.getElementById(selectId);
            Array.from(select.options).forEach(opt => opt.selected = true);
            applyFilters();
        });
    }
    if(uncheckBtn) {
        uncheckBtn.addEventListener('click', () => {
            const select = document.getElementById(selectId);
            Array.from(select.options).forEach(opt => opt.selected = false);
            applyFilters();
        });
    }
}

function onFilterModeChange() {
    const activeMode = document.querySelector('input[name="filterMode"]:checked').value;
    document.getElementById('villesFilterGroup').style.display = activeMode === 'ville' ? 'block' : 'none';
    document.getElementById('themesFilterGroup').style.display = activeMode === 'theme' ? 'block' : 'none';
    document.getElementById('epoquesFilterGroup').style.display = activeMode === 'epoque' ? 'block' : 'none';
    applyFilters();
}

// ============================================
// Modales et Édition
// ============================================

function initModalListeners() {
    // Aide
    const btnHelp = document.getElementById('btnHelp');
    const helpModal = document.getElementById('helpModal');
    const closeHelp = document.getElementById('closeHelp');
    
    if(btnHelp) btnHelp.addEventListener('click', () => helpModal.showModal());
    if(closeHelp) closeHelp.addEventListener('click', () => helpModal.close());

    // Stats
    const btnStats = document.getElementById('btnStats');
    const statsModal = document.getElementById('statsModal');
    const closeStats = document.getElementById('closeStats');

    if(btnStats) btnStats.addEventListener('click', () => {
        populateStatsContent();
        statsModal.showModal();
    });
    if(closeStats) closeStats.addEventListener('click', () => statsModal.close());

    // Édition
    const editModal = document.getElementById('editModal');
    const closeEdit = document.getElementById('closeEditModal');
    const cancelEdit = document.getElementById('cancelEdit');
    const editForm = document.getElementById('editForm');

    if(closeEdit) closeEdit.addEventListener('click', () => editModal.close());
    if(cancelEdit) cancelEdit.addEventListener('click', () => editModal.close());

    if(editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveArticleChanges();
        });
    }
}

window.openEditModal = function(globalIndex) {
    const article = allArticles[globalIndex];
    if (!article) return;

    currentEditIndex = globalIndex;

    document.getElementById('editAnnee').value = article.Année || '';
    document.getElementById('editNumero').value = article.Numero || '';
    document.getElementById('editTitre').value = article.Titre || '';
    document.getElementById('editPages').value = article['Page(s)'] || '';
    document.getElementById('editAuteurs').value = article['Auteur(s)'] || '';
    document.getElementById('editVilles').value = article['Ville(s)'] || '';
    document.getElementById('editThemes').value = article['Theme(s)'] || '';
    document.getElementById('editEpoque').value = article['Epoque'] || '';

    document.getElementById('editStatus').style.display = 'none';
    document.getElementById('editModal').showModal();
};

function saveArticleChanges() {
    if (currentEditIndex === -1) return;

    const article = allArticles[currentEditIndex];
    
    article.Année = document.getElementById('editAnnee').value;
    article.Numero = document.getElementById('editNumero').value;
    article.Titre = document.getElementById('editTitre').value;
    article['Page(s)'] = document.getElementById('editPages').value;
    article['Auteur(s)'] = document.getElementById('editAuteurs').value;
    article['Ville(s)'] = document.getElementById('editVilles').value;
    article['Theme(s)'] = document.getElementById('editThemes').value;
    article['Epoque'] = document.getElementById('editEpoque').value;

    const status = document.getElementById('editStatus');
    status.className = 'edit-status success'; 
    status.style.background = '#d4edda';
    status.style.color = '#155724';
    status.textContent = '✅ Article modifié (en mémoire uniquement)';
    status.style.display = 'block';

    populateFilters();
    applyFilters();
    
    setTimeout(() => {
        document.getElementById('editModal').close();
    }, 1500);
}

// ============================================
// Statistiques
// ============================================

function populateStatsContent() {
    const container = document.getElementById('statsContent');
    const total = allArticles.length;
    
    const themes = new Set();
    const auteurs = new Set();
    allArticles.forEach(a => {
        if(a['Theme(s)']) a['Theme(s)'].split(',').forEach(t => themes.add(t.trim()));
        if(a['Auteur(s)']) a['Auteur(s)'].split(',').forEach(au => auteurs.add(au.trim()));
    });

    container.innerHTML = `
        <div class="stats-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:16px; text-align:center;">
            <div style="padding:20px; background:#f5f5f5; border-radius:8px;">
                <h3 style="font-size:2em; margin:0; color:var(--accent);">${total}</h3>
                <p>Articles</p>
            </div>
            <div style="padding:20px; background:#f5f5f5; border-radius:8px;">
                <h3 style="font-size:2em; margin:0; color:var(--accent);">${Object.keys(VILLE_COORDINATES).length}</h3>
                <p>Lieux cartographiés</p>
            </div>
            <div style="padding:20px; background:#f5f5f5; border-radius:8px;">
                <h3 style="font-size:2em; margin:0; color:var(--accent);">${themes.size}</h3>
                <p>Thèmes</p>
            </div>
            <div style="padding:20px; background:#f5f5f5; border-radius:8px;">
                <h3 style="font-size:2em; margin:0; color:var(--accent);">${auteurs.size}</h3>
                <p>Auteurs uniques</p>
            </div>
        </div>
    `;
}

function populateStats() {}

function updateStats() {}

// ============================================
// Utilitaires
// ============================================

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden'); 
    else document.getElementById('loading')?.remove();
}

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}
