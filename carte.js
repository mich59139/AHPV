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
    'Vizille': [45.073, 5.773],
    'Pays vizillois': [45.073, 5.773],
    'Jarrie': [45.115, 5.758],
    'Séchilienne': [45.054, 5.835],
    'Grenoble': [45.188, 5.727],
    'Saint Georges de Commiers': [45.046, 5.704],
    'Champ sur Drac': [45.080, 5.733],
    'Notre Dame de Mésage': [45.074, 5.749],
    'Claix': [45.123, 5.673],
    'Bourg d\'Oisans': [45.056, 6.030],
    'L\'Oisans': [45.100, 6.000],
    'Livet': [45.093, 5.915],
    'Gavet': [45.055, 5.870],
    'Rioupéroux': [45.092, 5.903],
    'Allemond (38114)': [45.132, 6.040],
    'La Morte': [45.027, 5.862],
    'Laffrey': [45.008, 5.767],
    'Champagnier': [45.112, 5.721],
    'Varces': [45.092, 5.676],
    'Vaulnaveys le bas': [45.107, 5.811],
    'Vaulnaveys le haut': [45.115, 5.825],
    'Eybens': [45.147, 5.753],
    'Fontaine': [45.192, 5.689],
    'Herbeys': [45.137, 5.798],
    'Uriage': [45.147, 5.826],
    'Sassenage': [45.212, 5.661],
    'Saint Pierre de Mésage': [45.070, 5.760],
    'Bresson': [45.139, 5.740],
    'Saint Martin de la Cluze': [45.031, 5.697],
    'Monestier de Clermont': [44.919, 5.635],
    'Isère': [45.200, 5.700],
    'Dauphiné': [45.200, 5.700],
    'France': [46.603, 2.440]
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
    
    // Ouvrir automatiquement la sidebar au démarrage pour la rendre visible
    setTimeout(() => {
        document.getElementById('sidebar').classList.add('active');
    }, 500);
});

// ============================================
// Carte
// ============================================

function initMap() {
    map = L.map('map', {
        center: CONFIG.mapCenter,
        zoom: CONFIG.mapZoom,
        zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 18
    }).addTo(map);

    markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false
    });
    map.addLayer(markerClusterGroup);

    addHomeControl();
}

function addHomeControl() {
    const HomeControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function() {
            const container = L.DomUtil.create('div', 'leaflet-bar');
            const button = L.DomUtil.create('a', '', container);
            button.href = '#';
            button.title = 'Recentrer';
            button.innerHTML = '⌂';
            button.style.fontWeight = '700';
            button.style.fontSize = '18px';
            button.style.lineHeight = '30px';
            button.style.width = '30px';
            button.style.height = '30px';
            button.style.textAlign = 'center';
            
            L.DomEvent.on(button, 'click', (e) => {
                L.DomEvent.stop(e);
                map.setView(CONFIG.mapCenter, CONFIG.mapZoom, { animate: true });
            });
            
            return container;
        }
    });
    
    new HomeControl().addTo(map);
}

// ============================================
// Chargement des données
// ============================================

function loadData() {
    Papa.parse(CONFIG.csvPath, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            allArticles = results.data;
            filteredArticles = [...allArticles];
            processData();
            populateFilters();
            hideLoading();
        },
        error: function(error) {
            console.error('Erreur chargement CSV:', error);
            alert('Erreur lors du chargement des données');
            hideLoading();
        }
    });
}

// ============================================
// Traitement des données
// ============================================

function processData() {
    // Grouper articles par ville
    const articlesByVille = {};
    
    filteredArticles.forEach(article => {
        const villes = article['Ville(s)']?.split(',').map(v => v.trim()) || [];
        
        villes.forEach(ville => {
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

function getVilleShort(ville) {
    // Raccourcis personnalisés pour les villes principales
    const shortcuts = {
        'Vizille': 'VIZ',
        'Pays vizillois': 'PV',
        'Jarrie': 'JAR',
        'Séchilienne': 'SECH',
        'Grenoble': 'GRE',
        'Saint Georges de Commiers': 'SGC',
        'Champ sur Drac': 'CSD',
        'Notre Dame de Mésage': 'NDM',
        'Bourg d\'Oisans': 'BO',
        'L\'Oisans': 'OIS',
        'Saint Pierre de Mésage': 'SPM',
        'Saint Martin de la Cluze': 'SMC',
        'Monestier de Clermont': 'MC'
    };
    
    if (shortcuts[ville]) return shortcuts[ville];
    
    // Sinon, prendre les 3-4 premières lettres en majuscules
    return ville.substring(0, Math.min(4, ville.length)).toUpperCase();
}

function createMarker(ville, articles, coords) {
    const count = articles.length;
    
    // Taille du marqueur selon le nombre d'articles
    let size = 30;
    if (count > 50) size = 50;
    else if (count > 20) size = 42;
    else if (count > 10) size = 36;

    // Obtenir les initiales ou nom court de la ville
    const villeShort = getVilleShort(ville);

    const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="marker-content"><span class="marker-ville">${villeShort}</span><span class="marker-count">${count}</span></div>`,
        iconSize: [size + 40, size],
        iconAnchor: [(size + 40)/2, size/2],
        popupAnchor: [0, -size/2]
    });

    const marker = L.marker(coords, { icon });
    
    marker.bindPopup(createPopupContent(ville, articles));
    
    marker.on('click', () => {
        showInfoPanel(ville, articles);
    });

    marker.ville = ville;
    marker.articles = articles;
    
    markerClusterGroup.addLayer(marker);
    markers.push(marker);
}

function createPopupContent(ville, articles) {
    return `
        <div class="popup-title">${ville}</div>
        <div class="popup-count">${articles.length} article(s)</div>
        <p style="margin-top:8px; font-size:13px; color:#6b645a;">
            Cliquez pour voir la liste complète
        </p>
    `;
}

// ============================================
// Panel d'informations
// ============================================

function showInfoPanel(ville, articles) {
    // Stocker les articles pour l'édition
    currentVilleArticles = articles;
    
    const panel = document.getElementById('infoPanel');
    const title = document.getElementById('infoPanelTitle');
    const content = document.getElementById('infoPanelContent');
    
    title.textContent = `${ville} — ${articles.length} article(s)`;
    
    // Afficher maximum 100 articles (ou tous si moins)
    const maxDisplay = 100;
    const articlesToShow = articles.slice(0, maxDisplay);
    
    let html = '';
    articlesToShow.forEach((article, index) => {
        const articleId = `${article['Année']}-${article['Numéro']}-${index}`;
        html += `
            <div class="article-card" data-article-id="${articleId}">
                <h4>${article.Titre || 'Sans titre'}</h4>
                <div class="article-meta">
                    <span>📅 ${article['Numéro'] || '-'} (${article['Année'] || '-'})</span>
                    <span>👤 ${article['Auteur(s)'] || 'Anonyme'}</span>
                    <span>📄 p.${article['Page(s)'] || '-'}</span>
                </div>
                ${article['Theme(s)'] ? `<div class="article-themes">${article['Theme(s)']}</div>` : ''}
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
    
    content.innerHTML = html;
    panel.classList.add('active');
}

// ============================================
// Filtres
// ============================================

function populateFilters() {
    populateThemesFilters();
    populateEpoquesFilters();
    populateVillesFilters();
}

function populateThemesFilters() {
    const themesSet = new Set();
    allArticles.forEach(article => {
        const themes = article['Theme(s)']?.split(',').map(t => t.trim()) || [];
        themes.forEach(theme => {
            if (theme && theme !== '-') themesSet.add(theme);
        });
    });
    
    const container = document.getElementById('themesFilters');
    const themes = Array.from(themesSet).sort();
    
    themes.forEach(theme => {
        const count = allArticles.filter(a => 
            a['Theme(s)']?.includes(theme)
        ).length;
        
        const option = document.createElement('option');
        option.value = theme;
        option.textContent = `${theme} (${count})`;
        option.selected = true;
        container.appendChild(option);
    });
    
    // Événement change
    container.addEventListener('change', applyFilters);
}

function populateEpoquesFilters() {
    const epoquesSet = new Set();
    allArticles.forEach(article => {
        const epoque = article['Epoque'];
        if (epoque && epoque !== '-') epoquesSet.add(epoque);
    });
    
    const container = document.getElementById('epoquesFilters');
    const epoques = Array.from(epoquesSet).sort();
    
    epoques.forEach(epoque => {
        const count = allArticles.filter(a => a['Epoque'] === epoque).length;
        
        const option = document.createElement('option');
        option.value = epoque;
        option.textContent = `${epoque} (${count})`;
        option.selected = true;
        container.appendChild(option);
    });
    
    // Événement change
    container.addEventListener('change', applyFilters);
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
    // Trier par nombre d'articles (décroissant)
    const villesArray = Array.from(villesSet);
    const villesWithCount = villesArray.map(ville => {
        const count = allArticles.filter(a => 
            a['Ville(s)']?.includes(ville)
        ).length;
        return { ville, count };
    });
    villesWithCount.sort((a, b) => b.count - a.count);
    
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
    checkbox.dataset.type = type;
    checkbox.checked = true;
    
    // Appliquer les filtres automatiquement au changement
    checkbox.addEventListener('change', () => {
        applyFilters();
    });
    
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
            if (!selectedEpoques.includes(article['Epoque'])) return false;
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
    Array.from(document.getElementById('themesFilters').options).forEach(opt => opt.selected = true);
    Array.from(document.getElementById('epoquesFilters').options).forEach(opt => opt.selected = true);
    Array.from(document.getElementById('villesFilters').options).forEach(opt => opt.selected = true);
    
    // Réafficher tout
    filteredArticles = [...allArticles];
    processData();
    updateStats();
}

// ============================================
// Statistiques
// ============================================

function showStats() {
    const content = document.getElementById('statsContent');
    
    const totalArticles = filteredArticles.length;
    const totalVilles = new Set();
    const totalAuteurs = new Set();
    const totalThemes = new Set();
    
    filteredArticles.forEach(article => {
        const villes = article['Ville(s)']?.split(',').map(v => v.trim()) || [];
        villes.forEach(v => { if (v && v !== '-') totalVilles.add(v); });
        
        const auteurs = article['Auteur(s)']?.split(',').map(a => a.trim()) || [];
        auteurs.forEach(a => { if (a && a !== '-') totalAuteurs.add(a); });
        
        const themes = article['Theme(s)']?.split(',').map(t => t.trim()) || [];
        themes.forEach(t => { if (t && t !== '-') totalThemes.add(t); });
    });
    
    content.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${totalArticles}</div>
                <div class="stat-label">Articles</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalVilles.size}</div>
                <div class="stat-label">Villes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalAuteurs.size}</div>
                <div class="stat-label">Auteurs</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalThemes.size}</div>
                <div class="stat-label">Thèmes</div>
            </div>
        </div>
        
        <h3 style="margin-top:20px; color:var(--accent);">Top 10 des villes</h3>
        ${getTopVilles()}
    `;
    
    document.getElementById('statsModal').showModal();
}

function getTopVilles() {
    const villeCount = {};
    
    // Ne compter que les villes qui ont des coordonnées (visibles sur la carte)
    filteredArticles.forEach(article => {
        const villes = article['Ville(s)']?.split(',').map(v => v.trim()) || [];
        villes.forEach(ville => {
            // Vérifier que la ville a des coordonnées
            if (ville && ville !== '-' && VILLE_COORDINATES[ville]) {
                villeCount[ville] = (villeCount[ville] || 0) + 1;
            }
        });
    });
    
    const sorted = Object.entries(villeCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (sorted.length === 0) {
        return '<p style="text-align:center; color:var(--muted); margin-top:20px;">Aucune ville géolocalisée</p>';
    }
    
    const max = sorted[0][1];
    
    let html = '<div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">';
    sorted.forEach(([ville, count]) => {
        const percentage = (count / max) * 100;
        html += `
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="flex:0 0 180px; font-weight:600;">${ville}</div>
                <div style="flex:1; background:var(--bg); height:24px; border-radius:12px; overflow:hidden; position:relative;">
                    <div style="width:${percentage}%; height:100%; background:linear-gradient(90deg, var(--accent), var(--ghost));"></div>
                    <div style="position:absolute; right:8px; top:50%; transform:translateY(-50%); font-size:12px; font-weight:700; color:var(--muted);">${count}</div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    return html;
}

function updateStats() {
    // Mettre à jour les compteurs si visible
}

// ============================================
// Event Listeners
// ============================================

function initEventListeners() {
    // Sidebar
    document.getElementById('toggleSidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('active');
    });
    
    document.getElementById('closeSidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('active');
    });
    
    // Info panel
    document.getElementById('closeInfo').addEventListener('click', () => {
        document.getElementById('infoPanel').classList.remove('active');
    });
    
    document.getElementById('backFromPanel').addEventListener('click', () => {
        document.getElementById('infoPanel').classList.remove('active');
    });
    
    // Filtres
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    
    // Recherche en temps réel
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    
    // Gestion du changement de mode de filtrage
    document.querySelectorAll('input[name="filterMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const mode = e.target.value;
            
            // Cacher tous les filtres
            document.getElementById('villesFilterGroup').style.display = 'none';
            document.getElementById('themesFilterGroup').style.display = 'none';
            document.getElementById('epoquesFilterGroup').style.display = 'none';
            
            // Afficher le filtre correspondant
            if (mode === 'ville') {
                document.getElementById('villesFilterGroup').style.display = 'block';
            } else if (mode === 'theme') {
                document.getElementById('themesFilterGroup').style.display = 'block';
            } else if (mode === 'epoque') {
                document.getElementById('epoquesFilterGroup').style.display = 'block';
            }
            
            // Appliquer les filtres
            applyFilters();
        });
    });
    
    // Modales
    document.getElementById('btnHelp').addEventListener('click', () => {
        document.getElementById('helpModal').showModal();
    });
    
    document.getElementById('closeHelp').addEventListener('click', () => {
        document.getElementById('helpModal').close();
    });
    
    document.getElementById('btnStats').addEventListener('click', showStats);
    
    document.getElementById('closeStats').addEventListener('click', () => {
        document.getElementById('statsModal').close();
    });
    
    // Modal d'édition
    document.getElementById('editForm').addEventListener('submit', saveArticleEdit);
    
    document.getElementById('closeEditModal').addEventListener('click', () => {
        document.getElementById('editModal').close();
    });
    
    document.getElementById('cancelEdit').addEventListener('click', () => {
        document.getElementById('editModal').close();
    });
    
    // Fermer modales en cliquant dehors
    document.querySelectorAll('.dialog').forEach(dialog => {
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.close();
        });
    });
    
    // ESC pour fermer
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.dialog[open]').forEach(d => d.close());
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('infoPanel').classList.remove('active');
        }
    });
    
    // Boutons Tout/Aucun pour les thèmes
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
    
    // Boutons Tout/Aucun pour les époques
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
    
    // Boutons Tout/Aucun pour les villes
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

// ============================================
// Utilitaires
// ============================================

function hideLoading() {
    const loading = document.getElementById('loading');
    loading.classList.add('hidden');
    setTimeout(() => {
        loading.style.display = 'none';
    }, 300);
}

// ============================================
// Édition d'articles
// ============================================

let currentEditIndex = null;
let currentVilleArticles = []; // Stocker les articles de la ville courante

function editArticle(articleId, localIndex) {
    // Utiliser l'index local dans la liste affichée
    if (localIndex < 0 || localIndex >= currentVilleArticles.length) {
        alert('Article non trouvé (index invalide)');
        return;
    }
    
    const article = currentVilleArticles[localIndex];
    
    // Trouver l'index dans allArticles
    currentEditIndex = allArticles.findIndex(a => 
        a.Titre === article.Titre && 
        a['Année'] === article['Année'] && 
        a['Numéro'] === article['Numéro']
    );
    
    if (currentEditIndex === -1) {
        alert('Article non trouvé dans la base');
        return;
    }
    
    // Remplir le formulaire
    document.getElementById('editIndex').value = currentEditIndex;
    document.getElementById('editAnnee').value = article['Année'] || '';
    document.getElementById('editNumero').value = article['Numéro'] || '';
    document.getElementById('editTitre').value = article.Titre || '';
    document.getElementById('editPages').value = article['Page(s)'] || '';
    document.getElementById('editAuteurs').value = article['Auteur(s)'] || '';
    document.getElementById('editVilles').value = article['Ville(s)'] || '';
    document.getElementById('editThemes').value = article['Theme(s)'] || '';
    document.getElementById('editEpoque').value = article['Epoque'] || '';
    
    // Afficher le modal
    document.getElementById('editModal').showModal();
}

function saveArticleEdit(event) {
    event.preventDefault();
    
    const index = parseInt(document.getElementById('editIndex').value);
    
    if (index < 0 || index >= allArticles.length) {
        showEditStatus('error', 'Article non trouvé');
        return;
    }
    
    // Récupérer les données du formulaire
    allArticles[index] = {
        'Année': document.getElementById('editAnnee').value,
        'Numéro': document.getElementById('editNumero').value,
        'Titre': document.getElementById('editTitre').value,
        'Page(s)': document.getElementById('editPages').value,
        'Auteur(s)': document.getElementById('editAuteurs').value,
        'Ville(s)': document.getElementById('editVilles').value,
        'Theme(s)': document.getElementById('editThemes').value,
        'Epoque': document.getElementById('editEpoque').value
    };
    
    // Mettre à jour filteredArticles aussi
    filteredArticles = [...allArticles];
    
    // Recharger les données
    populateFilters();
    applyFilters();
    
    showEditStatus('success', '✓ Article modifié avec succès !');
    
    setTimeout(() => {
        document.getElementById('editModal').close();
    }, 1500);
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

