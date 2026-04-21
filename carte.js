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

// Coordonnées GPS - v2.2 : chargées depuis data/coordonnees.json (généré par BAN)
// + data/overrides.json (corrections manuelles, prioritaires).
// Le mode ajustement (bouton ✏️) permet de déplacer un marker et d'exporter
// le snippet JSON à coller dans overrides.json.
let VILLE_COORDINATES = {};
let VILLE_META = {}; // {key: {label, kind, approx, source}}
let COORDONNEES_LOADED = false;

async function loadCoordonnees() {
    try {
        const [coordsResp, overrideResp] = await Promise.all([
            fetch('data/coordonnees.json', {cache: 'no-cache'}),
            fetch('data/overrides.json', {cache: 'no-cache'})
        ]);
        const coords = coordsResp.ok ? await coordsResp.json() : {};
        const overrides = overrideResp.ok ? await overrideResp.json() : {};

        // Le fichier coordonnees.json contient déjà les overrides fusionnés
        // (le script geocode-ban.js les applique), mais on re-fusionne par sécurité.
        Object.entries(coords).forEach(([k, v]) => {
            if (k.startsWith('_') || !v.coords) return;
            VILLE_COORDINATES[k] = v.coords;
            VILLE_META[k] = {label: v.label, kind: v.kind, approx: !!v.approx, source: v.source};
        });
        Object.entries(overrides).forEach(([k, v]) => {
            if (k.startsWith('_') || !v.coords) return;
            VILLE_COORDINATES[k] = v.coords;
            VILLE_META[k] = {label: v.label, kind: v.kind, approx: !!v.approx, source: 'override'};
        });
        COORDONNEES_LOADED = true;
        console.log('📍 Coordonnées chargées : ' + Object.keys(VILLE_COORDINATES).length + ' lieux');
    } catch (e) {
        console.error('❌ Échec chargement coordonnées :', e);
    }
}

// ============================================
// Mode ajustement : déplacer les markers et exporter
// ============================================
window._adjustMode = false;
const ADJUST_CHANGES = {}; // {key: {coords:[lat,lng], label}}

function toggleAdjustMode(btn) {
    window._adjustMode = !window._adjustMode;
    document.body.classList.toggle('adjust-mode', window._adjustMode);
    if (btn) {
        btn.style.background = window._adjustMode ? '#daa520' : '';
        btn.style.color = window._adjustMode ? '#fff' : '';
    }
    if (window._adjustMode) {
        showAdjustToast(
            'Mode ajustement activé. Glisse un marker pour le repositionner. ' +
            'Clique 📋 dans le panneau pour copier le snippet JSON à coller dans data/overrides.json.'
        );
        ensureAdjustPanel();
    } else {
        hideAdjustPanel();
    }
    applyFilters(); // re-render markers en mode draggable
}

function attachAdjustHandlers(marker, key) {
    marker.on('dragend', function(e) {
        const ll = e.target.getLatLng();
        const coords = [Number(ll.lat.toFixed(5)), Number(ll.lng.toFixed(5))];
        const meta = VILLE_META[key] || {};
        ADJUST_CHANGES[key] = {
            coords,
            label: meta.label || key,
            kind: meta.kind || 'commune'
        };
        VILLE_COORDINATES[key] = coords;
        renderAdjustPanel();
    });
}

function ensureAdjustPanel() {
    if (document.getElementById('adjust-panel')) return;
    const div = document.createElement('div');
    div.id = 'adjust-panel';
    div.style.cssText = 'position:fixed;top:90px;right:10px;width:340px;max-height:70vh;overflow:auto;background:#faf8f3;border:2px solid #daa520;border-radius:10px;padding:12px;box-shadow:0 4px 16px rgba(0,0,0,0.2);z-index:9999;font-size:12px;';
    div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong style="color:#5d2e0d">🎯 Ajustements en cours</strong><button id="adjust-close" style="border:none;background:none;font-size:16px;cursor:pointer">✕</button></div><div id="adjust-list" style="color:#666"><em>Aucun marker déplacé pour l\'instant.</em></div>';
    document.body.appendChild(div);
    document.getElementById('adjust-close').onclick = () => {
        const btn = document.querySelector('.leaflet-bar-part[title^="Mode ajustement"]');
        toggleAdjustMode(btn);
    };
}

function hideAdjustPanel() {
    const el = document.getElementById('adjust-panel');
    if (el) el.remove();
}

function renderAdjustPanel() {
    const list = document.getElementById('adjust-list');
    if (!list) return;
    const keys = Object.keys(ADJUST_CHANGES);
    if (!keys.length) { list.innerHTML = '<em>Aucun marker déplacé pour l\'instant.</em>'; return; }
    let html = '';
    keys.forEach(k => {
        const c = ADJUST_CHANGES[k];
        html += `<div style="border-bottom:1px solid #e0d8c5;padding:6px 0"><strong>${k}</strong><br><code style="font-size:10px">[${c.coords[0]}, ${c.coords[1]}]</code></div>`;
    });
    const snippet = generateOverrideSnippet();
    html += `<div style="margin-top:10px"><button id="adjust-copy" style="background:#daa520;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:600;width:100%">📋 Copier snippet JSON</button></div>`;
    html += `<details style="margin-top:8px"><summary style="cursor:pointer;color:#666">Voir le JSON</summary><pre style="background:#fff;padding:8px;border-radius:6px;font-size:10px;overflow:auto;max-height:200px;border:1px solid #e0d8c5">${snippet}</pre></details>`;
    html += `<div style="margin-top:6px;font-size:11px;color:#666">Colle ce snippet dans <code>data/overrides.json</code> puis recharge.</div>`;
    list.innerHTML = html;
    document.getElementById('adjust-copy').onclick = () => {
        navigator.clipboard.writeText(snippet).then(() => showAdjustToast('✅ Snippet copié dans le presse-papier'));
    };
}

function generateOverrideSnippet() {
    const obj = {};
    Object.entries(ADJUST_CHANGES).forEach(([k, v]) => {
        obj[k] = { coords: v.coords, label: v.label, kind: v.kind };
    });
    return JSON.stringify(obj, null, 2);
}

function showAdjustToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#5d2e0d;color:#fff;padding:10px 18px;border-radius:8px;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:13px;max-width:500px;text-align:center';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4500);
}

// Normaliser les noms de villes (apostrophes, espaces)
function normalizeVilleName(name) {
    if (!name) return '';
    return name.trim()
        .replace(/'/g, "'")  // apostrophe courbe → droite
        .replace(/'/g, "'")  // autre apostrophe → droite
        .replace(/\s+/g, ' '); // espaces multiples
}

// Chercher les coordonnées — toutes les clés sont en minuscules
function getVilleCoordinates(ville) {
    if (!ville) return null;
    // Normaliser : minuscules, retirer codes postaux, apostrophes
    var key = normalizeVilleName(ville).toLowerCase()
        .replace(/\s*\(\d+\)\s*/, '')  // retirer (38220) etc.
        .replace(/oisans ou vizille/i, 'vizille');
    if (VILLE_COORDINATES[key]) return VILLE_COORDINATES[key];
    // Essai partiel (ex: "Comboire (Échirolles)" → "comboire")
    var first = key.split('(')[0].trim().split(',')[0].trim();
    if (VILLE_COORDINATES[first]) return VILLE_COORDINATES[first];
    return null;
}

let map;
let markers = [];
let markerClusterGroup;
let allArticles = [];
let filteredArticles = [];
let currentEditIndex = -1;

// Cache géocodage Nominatim
const GEOCODE_CACHE = {};
const GEOCODE_QUEUE = [];
let geocodeRunning = false;

// Géocodage automatique via Nominatim (OpenStreetMap)
async function geocodeVille(ville) {
    if (!ville || ville === '-') return null;
    var key = normalizeVilleName(ville).toLowerCase().replace(/\s*\(\d+\)\s*/, '');
    if (GEOCODE_CACHE[key] !== undefined) return GEOCODE_CACHE[key];
    try {
        // Chercher d'abord en Isère, puis en France
        var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr&q=' + encodeURIComponent(ville + ', Isère');
        var resp = await fetch(url, {headers: {'User-Agent': 'AHPV-Carte/1.0'}});
        var data = await resp.json();
        if (!data.length) {
            url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr&q=' + encodeURIComponent(ville);
            resp = await fetch(url, {headers: {'User-Agent': 'AHPV-Carte/1.0'}});
            data = await resp.json();
        }
        if (data.length) {
            var coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            GEOCODE_CACHE[key] = coords;
            VILLE_COORDINATES[key] = coords;
            console.log('📍 Géocodé: ' + ville + ' → [' + coords + ']');
            return coords;
        }
        GEOCODE_CACHE[key] = null;
        console.warn('❌ Non trouvé: ' + ville);
        return null;
    } catch (e) {
        GEOCODE_CACHE[key] = null;
        return null;
    }
}

// Géocoder toutes les villes inconnues (avec rate-limit 1 req/sec pour Nominatim)
async function geocodeUnknownVilles() {
    var unknowns = new Set();
    allArticles.forEach(function(a) {
        var villes = (a['Ville(s)'] || '').split(',').map(function(v) { return v.trim(); });
        villes.forEach(function(v) {
            if (v && v !== '-' && !getVilleCoordinates(v)) unknowns.add(v);
        });
    });
    if (unknowns.size === 0) return;
    console.log('🔍 Géocodage de ' + unknowns.size + ' ville(s) inconnue(s)...');
    var arr = Array.from(unknowns);
    for (var i = 0; i < arr.length; i++) {
        await geocodeVille(arr[i]);
        if (i < arr.length - 1) await new Promise(function(r) { setTimeout(r, 1100); }); // Rate limit
    }
    // Rafraîchir la carte
    applyFilters();
}

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

    // Bouton Mode ajustement (déplacer les markers pour corriger les coordonnées)
    L.Control.Adjust = L.Control.extend({
        onAdd: function () {
            const btn = L.DomUtil.create('button', 'btn btn-secondary leaflet-bar-part');
            btn.innerHTML = '✏️';
            btn.title = 'Mode ajustement : déplacer les markers pour corriger les coordonnées';
            btn.style.fontSize = '14px';
            btn.onclick = (e) => {
                L.DomEvent.stopPropagation(e);
                toggleAdjustMode(btn);
            };
            return btn;
        },
        onRemove: function () {}
    });
    L.control.adjust = function (opts) { return new L.Control.Adjust(opts); };
    L.control.adjust({ position: 'topright' }).addTo(map);

    // Bouton Plein écran
    L.Control.Fullscreen = L.Control.extend({
        onAdd: function () {
            const btn = L.DomUtil.create('button', 'btn btn-secondary leaflet-bar-part');
            btn.innerHTML = '⛶';
            btn.title = 'Plein écran';
            btn.style.fontSize = '18px';
            btn.onclick = (e) => {
                L.DomEvent.stopPropagation(e);
                var el = document.getElementById('map');
                if (!document.fullscreenElement) {
                    (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen).call(el);
                    btn.innerHTML = '✕';
                    btn.title = 'Quitter le plein écran';
                } else {
                    (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
                    btn.innerHTML = '⛶';
                    btn.title = 'Plein écran';
                }
                setTimeout(function(){ if(map) map.invalidateSize(); }, 300);
            };
            return btn;
        },
        onRemove: function () {}
    });
    L.control.fullscreen = function (opts) { return new L.Control.Fullscreen(opts); };
    L.control.fullscreen({ position: 'topright' }).addTo(map);

    initLegend();
    initMiniMap();
    initTimeline();

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
        var html = '<div style="font-weight:bold; margin-bottom:6px;">Couleur par thème</div>';
        var shown = {};
        for (var key in THEME_COLORS) {
            if (!shown[THEME_COLORS[key]]) {
                html += '<div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;font-size:12px;">'
                    + '<span style="width:12px;height:12px;border-radius:50%;background:'+THEME_COLORS[key]+';display:inline-block;flex-shrink:0"></span>'
                    + '<span>'+key.charAt(0).toUpperCase()+key.slice(1)+'</span></div>';
                shown[THEME_COLORS[key]] = true;
            }
        }
        div.innerHTML = html;
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
    
    // Charger d'abord les coordonnées (BAN + overrides) puis les articles
    loadCoordonnees().then(() => parseArticles());
}

function parseArticles() {
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
            hideLoading();
            // Animation d'ouverture
            playIntroAnimation(function() {
                applyFilters();
                // Géocoder les villes inconnues en arrière-plan
                geocodeUnknownVilles();
            });
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
        
        // Filtre frise chronologique
        if (window._timelineFilter) {
            var year = parseInt(article['Année']);
            if (!year || year < window._timelineFilter.from || year > window._timelineFilter.to) return false;
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
    if (vizilleSpecialMarker) { map.removeLayer(vizilleSpecialMarker); vizilleSpecialMarker = null; }
    markers = [];

    // Agréger les articles "Vizille" (et alias géographiques pointant sur Vizille)
    // pour les afficher via un marker spécial hors cluster (point d'ancrage du projet).
    const vizilleAliases = ['vizille', 'pays vizillois', 'canton', 'oisans ou vizille'];
    let vizilleArticles = [];
    let vizilleDisplayName = 'Vizille';
    for (const [ville, articles] of Object.entries(articlesByVille)) {
        const key = normalizeVilleName(ville).toLowerCase().replace(/\s*\(\d+\)\s*/, '');
        if (vizilleAliases.includes(key)) {
            vizilleArticles = vizilleArticles.concat(articles);
        }
    }
    // Dédoublonner par titre+année
    const seen = new Set();
    vizilleArticles = vizilleArticles.filter(a => {
        const k = (a.Titre || '') + '|' + (a['Année'] || '');
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
    createVizilleMarker(vizilleArticles);

    for (const [ville, articles] of Object.entries(articlesByVille)) {
        const key = normalizeVilleName(ville).toLowerCase().replace(/\s*\(\d+\)\s*/, '');
        if (vizilleAliases.includes(key)) continue; // déjà géré
        const coords = getVilleCoordinates(ville);
        if (coords) createMarker(ville, articles, coords);
    }
}

let vizilleSpecialMarker = null;
const VIZILLE_COORDS = [45.0786, 5.7740];

function createVizilleMarker(articles) {
    const count = articles.length;
    const dim = count === 0 ? 'opacity:.55;' : '';
    const html = `
        <div class="vizille-marker" style="${dim}">
            <div class="vizille-icon">⛰</div>
            <div class="vizille-label">
                <span class="vizille-name">Vizille</span>
                <span class="vizille-count">${count} article${count > 1 ? 's' : ''}</span>
            </div>
        </div>
    `;
    const icon = L.divIcon({
        html,
        className: 'ahpv-vizille-marker',
        iconSize: null,
        iconAnchor: [22, 44]
    });
    vizilleSpecialMarker = L.marker(VIZILLE_COORDS, {icon, zIndexOffset: 1000, draggable: window._adjustMode === true});
    vizilleSpecialMarker.on('click', () => showInfoPanel('Vizille', articles));
    if (window._adjustMode) attachAdjustHandlers(vizilleSpecialMarker, 'vizille');
    vizilleSpecialMarker.addTo(map);
}

// Couleurs par thème principal
const THEME_COLORS = {
    'patrimoine': '#1e3a5f',
    'architecture': '#2d5a87',
    'histoire': '#6b4423',
    'guerre': '#dc2626',
    'religion': '#7c3aed',
    'industrie': '#d97706',
    'nature': '#16a34a',
    'agriculture': '#65a30d',
    'personnage': '#0891b2',
    'transport': '#3B82F6',
    'art': '#db2777',
    'éducation': '#6366F1',
    'économie': '#14B8A6',
    'société': '#F59E0B',
    'géographie': '#059669'
};
const DEFAULT_MARKER_COLOR = '#1e3a5f';

function getThemeColor(articles) {
    // Trouver le thème le plus fréquent
    var counts = {};
    articles.forEach(function(a) {
        var t = (a['Theme(s)'] || '').split(',')[0].trim().toLowerCase();
        if (t) counts[t] = (counts[t] || 0) + 1;
    });
    var best = '';
    var bestN = 0;
    for (var t in counts) { if (counts[t] > bestN) { best = t; bestN = counts[t]; } }
    // Chercher une correspondance partielle dans THEME_COLORS
    for (var key in THEME_COLORS) {
        if (best.includes(key) || key.includes(best)) return THEME_COLORS[key];
    }
    return DEFAULT_MARKER_COLOR;
}

function createMarker(ville, articles, coords) {
    var color = getThemeColor(articles);
    var key = normalizeVilleName(ville).toLowerCase().replace(/\s*\(\d+\)\s*/, '');
    var meta = VILLE_META[key] || {};
    var approxClass = meta.approx ? ' approx' : '';
    var approxBadge = meta.approx ? ' <span style="font-size:9px;opacity:.7" title="Localisation approximative">≈</span>' : '';

    const markerHtml = `
        <div class="custom-marker${approxClass}" style="background:${color};" title="${meta.label || ville}">
            <div class="marker-content">
                <span class="marker-ville">${ville}${approxBadge}</span>
                <span class="marker-count">${articles.length}</span>
            </div>
        </div>
    `;

    const icon = L.divIcon({
        html: markerHtml,
        className: 'ahpv-marker',
        iconSize: null,
        iconAnchor: [0, 0]
    });

    const marker = L.marker(coords, { icon, draggable: window._adjustMode === true });
    marker.on('click', () => showInfoPanel(ville, articles));
    if (window._adjustMode) attachAdjustHandlers(marker, key);

    // En mode ajustement, on sort du cluster pour pouvoir drag chaque marker
    if (window._adjustMode) {
        marker.addTo(map);
    } else {
        markerClusterGroup.addLayer(marker);
    }
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
                    <a href="index.html?q=${encodeURIComponent(article.Titre)}" class="btn-link" style="text-decoration:none;color:var(--accent,#1e3a5f);font-size:13px;font-weight:600;">📋 Voir dans le catalogue</a>
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
    // Heat map
    var btnHeat = document.getElementById('btnHeat');
    if (btnHeat) btnHeat.addEventListener('click', toggleHeatMap);

    // Export PNG
    var btnExport = document.getElementById('btnExport');
    if (btnExport) btnExport.addEventListener('click', exportMapPNG);

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
// Animation d'ouverture
// ============================================

function playIntroAnimation(callback) {
    // Trouver la plage d'années
    var years = {};
    allArticles.forEach(function(a) {
        var y = parseInt(a['Année']);
        if (y) {
            if (!years[y]) years[y] = [];
            years[y].push(a);
        }
    });
    var sortedYears = Object.keys(years).map(Number).sort();
    if (sortedYears.length === 0) { callback(); return; }

    var firstYear = sortedYears[0];
    var lastYear = sortedYears[sortedYears.length - 1];

    // Bandeau d'animation
    var overlay = document.createElement('div');
    overlay.id = 'intro-overlay';
    overlay.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2000;display:flex;align-items:center;justify-content:center;gap:20px;background:linear-gradient(0deg,rgba(45,26,13,0.92),rgba(45,26,13,0.75));color:white;font-family:Crimson Text,Georgia,serif;transition:opacity .8s,transform .8s;pointer-events:none;padding:16px 24px;backdrop-filter:blur(4px)';
    overlay.innerHTML = '<div style="text-align:center">'
        + '<div style="font-size:.8rem;opacity:.6">Amis de l\'Histoire du Pays Vizillois</div>'
        + '<div style="font-size:.75rem;opacity:.5;margin-top:2px">Exploration du patrimoine local</div>'
        + '</div>'
        + '<div id="intro-year" style="font-size:2.5rem;font-weight:700;letter-spacing:.05em;text-shadow:0 2px 8px rgba(0,0,0,.3);min-width:80px;text-align:center">' + firstYear + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:4px;min-width:200px">'
        + '<div id="intro-count" style="font-size:.85rem;opacity:.8">0 article</div>'
        + '<div style="width:100%;height:4px;background:rgba(255,255,255,.15);border-radius:4px;overflow:hidden"><div id="intro-bar" style="width:0%;height:100%;background:linear-gradient(90deg,#daa520,#f4d03f);border-radius:4px;transition:width .15s"></div></div>'
        + '</div>';
    document.body.appendChild(overlay);

    var yearEl = document.getElementById('intro-year');
    var countEl = document.getElementById('intro-count');
    var barEl = document.getElementById('intro-bar');

    // Ajouter les marqueurs progressivement
    markerClusterGroup.clearLayers();
    markers = [];

    var totalArticles = 0;
    var yearIndex = 0;
    var duration = 4000; // 4 secondes pour toute l'animation
    var interval = Math.max(50, Math.floor(duration / sortedYears.length));

    var timer = setInterval(function() {
        if (yearIndex >= sortedYears.length) {
            clearInterval(timer);
            // Glissement vers le bas
            setTimeout(function() {
                overlay.style.opacity = '0';
                overlay.style.transform = 'translateY(100%)';
                setTimeout(function() {
                    overlay.remove();
                    callback();
                }, 800);
            }, 600);
            return;
        }

        var yr = sortedYears[yearIndex];
        var arts = years[yr];
        totalArticles += arts.length;

        if (yearEl) yearEl.textContent = yr;
        if (countEl) countEl.textContent = totalArticles + ' article' + (totalArticles > 1 ? 's' : '') + ' publiés';
        if (barEl) barEl.style.width = Math.round((yearIndex + 1) / sortedYears.length * 100) + '%';

        // Ajouter les marqueurs de cette année
        var articlesByVille = {};
        arts.forEach(function(article) {
            var villes = (article['Ville(s)'] || '').split(',').map(function(v) { return v.trim(); }).filter(Boolean);
            villes.forEach(function(ville) {
                var coords = getVilleCoordinates(ville);
                if (!ville || ville === '-' || !coords) return;
                if (!articlesByVille[ville]) articlesByVille[ville] = [];
                articlesByVille[ville].push(article);
            });
        });

        for (var ville in articlesByVille) {
            var coords = getVilleCoordinates(ville);
            if (coords) {
                createMarker(ville, articlesByVille[ville], coords);
            }
        }

        yearIndex++;
    }, interval);
}

// ============================================
// Mini-carte (vue d'ensemble)
// ============================================

function initMiniMap() {
    var miniTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '',
        maxZoom: 13
    });
    var miniMapCtrl = L.control({position: 'bottomright'});
    miniMapCtrl.onAdd = function() {
        var div = L.DomUtil.create('div', 'minimap-container');
        div.innerHTML = '<div id="minimap" style="width:160px;height:120px;border-radius:10px;border:2px solid rgba(139,69,19,0.3);box-shadow:0 2px 10px rgba(0,0,0,0.2);overflow:hidden"></div>';
        L.DomEvent.disableClickPropagation(div);
        return div;
    };
    miniMapCtrl.addTo(map);

    setTimeout(function() {
        var minimap = L.map('minimap', {
            center: [45.2, 5.7],
            zoom: 8,
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            touchZoom: false
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 13}).addTo(minimap);
        // Marqueur Vizille sur la mini-carte
        L.circleMarker([45.073, 5.773], {radius: 6, color: '#8b4513', fillColor: '#daa520', fillOpacity: 0.9, weight: 2}).addTo(minimap);
        // Label
        L.marker([45.073, 5.773], {
            icon: L.divIcon({className: '', html: '<div style="font-size:10px;font-weight:700;color:#8b4513;text-shadow:0 0 3px #fff;white-space:nowrap">Vizille</div>', iconAnchor: [-8, 5]})
        }).addTo(minimap);
        // Marqueurs contexte
        L.circleMarker([45.188, 5.727], {radius: 4, color: '#666', fillColor: '#999', fillOpacity: 0.7, weight: 1}).addTo(minimap);
        L.marker([45.188, 5.727], {
            icon: L.divIcon({className: '', html: '<div style="font-size:9px;color:#666;text-shadow:0 0 3px #fff;white-space:nowrap">Grenoble</div>', iconAnchor: [-6, 5]})
        }).addTo(minimap);
    }, 500);
}

// ============================================
// Frise chronologique (slider par année)
// ============================================

function initTimeline() {
    var ctrl = L.control({position: 'bottomleft'});
    ctrl.onAdd = function() {
        var div = L.DomUtil.create('div', 'timeline-container');
        div.style.cssText = 'background:white;border-radius:12px;padding:10px 16px;box-shadow:0 2px 12px rgba(0,0,0,0.15);min-width:280px;margin-bottom:8px;';
        div.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
            + '<span style="font-size:12px;font-weight:700;color:#5d2e0d">📅 Période</span>'
            + '<span id="timeline-label" style="font-size:11px;color:#6b6560;flex:1;text-align:right">Toutes les années</span>'
            + '<button id="timeline-reset" style="font-size:10px;border:1px solid #ddd;background:#faf8f5;border-radius:6px;padding:2px 8px;cursor:pointer;display:none">✕</button>'
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:8px">'
            + '<span id="timeline-min" style="font-size:11px;color:#6b6560;min-width:32px">1991</span>'
            + '<input type="range" id="timeline-from" min="1991" max="2026" value="1991" style="flex:1;accent-color:#8b4513;height:4px">'
            + '<input type="range" id="timeline-to" min="1991" max="2026" value="2026" style="flex:1;accent-color:#daa520;height:4px">'
            + '<span id="timeline-max" style="font-size:11px;color:#6b6560;min-width:32px">2026</span>'
            + '</div>';
        L.DomEvent.disableClickPropagation(div);
        return div;
    };
    ctrl.addTo(map);

    setTimeout(function() {
        var from = document.getElementById('timeline-from');
        var to = document.getElementById('timeline-to');
        var label = document.getElementById('timeline-label');
        var resetBtn = document.getElementById('timeline-reset');
        if (!from || !to) return;

        function updateTimeline() {
            var f = parseInt(from.value);
            var t = parseInt(to.value);
            if (f > t) { var tmp = f; f = t; t = tmp; from.value = f; to.value = t; }
            if (f === 1991 && t === 2026) {
                label.textContent = 'Toutes les années';
                resetBtn.style.display = 'none';
                window._timelineFilter = null;
            } else {
                label.textContent = f + ' — ' + t;
                resetBtn.style.display = '';
                window._timelineFilter = {from: f, to: t};
            }
            applyFilters();
        }

        from.addEventListener('input', updateTimeline);
        to.addEventListener('input', updateTimeline);
        resetBtn.addEventListener('click', function() {
            from.value = 1991;
            to.value = 2026;
            updateTimeline();
        });
    }, 300);
}

// ============================================
// Carte de chaleur (Heat Map)
// ============================================

let heatLayer = null;
let heatVisible = false;

function toggleHeatMap() {
    if (heatVisible) {
        if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
        heatVisible = false;
        markerClusterGroup.addTo(map);
        document.getElementById('btnHeat').style.background = '';
        return;
    }

    // Construire les points de chaleur
    var heatPoints = [];
    var articlesByVille = {};
    filteredArticles.forEach(function(a) {
        var villes = (a['Ville(s)'] || '').split(',').map(function(v) { return v.trim(); }).filter(Boolean);
        villes.forEach(function(v) {
            var coords = getVilleCoordinates(v);
            if (coords) {
                if (!articlesByVille[v]) articlesByVille[v] = 0;
                articlesByVille[v]++;
            }
        });
    });

    for (var ville in articlesByVille) {
        var coords = getVilleCoordinates(ville);
        if (coords) {
            // [lat, lng, intensité]
            heatPoints.push([coords[0], coords[1], articlesByVille[ville]]);
        }
    }

    if (heatPoints.length === 0) return;

    // Cacher les marqueurs, afficher la heatmap
    map.removeLayer(markerClusterGroup);
    heatLayer = L.heatLayer(heatPoints, {
        radius: 35,
        blur: 25,
        maxZoom: 14,
        max: Math.max.apply(null, heatPoints.map(function(p) { return p[2]; })),
        gradient: {
            0.2: '#ffffb2',
            0.4: '#fed976',
            0.6: '#feb24c',
            0.8: '#f03b20',
            1.0: '#bd0026'
        }
    });
    heatLayer.addTo(map);
    heatVisible = true;
    document.getElementById('btnHeat').style.background = 'rgba(255,100,50,.3)';
}

// ============================================
// Export PNG
// ============================================

function exportMapPNG() {
    var mapEl = document.getElementById('map');
    if (!mapEl || typeof html2canvas === 'undefined') {
        alert('Export non disponible');
        return;
    }

    // Notification
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;background:#5d2e0d;color:white;padding:12px 24px;border-radius:10px;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,.3)';
    toast.textContent = '📸 Capture en cours...';
    document.body.appendChild(toast);

    setTimeout(function() {
        html2canvas(mapEl, {
            useCORS: true,
            allowTaint: true,
            scale: 2,
            backgroundColor: '#f5f0e8'
        }).then(function(canvas) {
            // Ajouter titre et date
            var finalCanvas = document.createElement('canvas');
            var ctx = finalCanvas.getContext('2d');
            var padding = 80;
            finalCanvas.width = canvas.width;
            finalCanvas.height = canvas.height + padding;

            // Fond
            ctx.fillStyle = '#faf8f5';
            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

            // Titre
            ctx.fillStyle = '#5d2e0d';
            ctx.font = 'bold 28px Source Sans 3, sans-serif';
            ctx.fillText('AHPV — Carte Interactive des Articles', 20, 35);
            ctx.fillStyle = '#6b6560';
            ctx.font = '18px Source Sans 3, sans-serif';
            ctx.fillText('Amis de l\'Histoire du Pays Vizillois — ' + new Date().toLocaleDateString('fr-FR'), 20, 60);

            // Carte
            ctx.drawImage(canvas, 0, padding);

            // Télécharger
            var link = document.createElement('a');
            link.download = 'AHPV-carte-' + new Date().toISOString().slice(0, 10) + '.png';
            link.href = finalCanvas.toDataURL('image/png');
            link.click();

            toast.textContent = '✅ Image téléchargée !';
            toast.style.background = '#2e7d32';
            setTimeout(function() { toast.remove(); }, 2000);
        }).catch(function(err) {
            toast.textContent = '❌ Erreur : ' + err.message;
            toast.style.background = '#c62828';
            setTimeout(function() { toast.remove(); }, 3000);
        });
    }, 300);
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
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}
