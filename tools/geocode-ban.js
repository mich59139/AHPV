#!/usr/bin/env node
// Géocodage des villes via la Base Adresse Nationale (BAN).
// Lit data/villes.csv + data/articles.csv, écrit data/coordonnees.json.
// Les entrées de data/overrides.json priment sur le résultat BAN.
//
// Usage : node tools/geocode-ban.js

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const VILLES_CSV = path.join(ROOT, 'data/villes.csv');
const ARTICLES_CSV = path.join(ROOT, 'data/articles.csv');
const OVERRIDES_JSON = path.join(ROOT, 'data/overrides.json');
const OUT_JSON = path.join(ROOT, 'data/coordonnees.json');

const VIZILLE_LAT = 45.0786;
const VIZILLE_LON = 5.7740;

function normalize(name) {
  if (!name) return '';
  return name.trim()
    .replace(/[''`´]/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*/, '')
    .replace(/oisans ou vizille/i, 'vizille');
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  return lines.slice(1).map(l => l.split(',')[0].trim()).filter(Boolean);
}

function collectVilles() {
  const set = new Set();
  const villesText = fs.readFileSync(VILLES_CSV, 'utf8');
  parseCsv(villesText).forEach(v => { if (v && v !== '-') set.add(v); });
  // Aussi parser articles.csv pour attraper d'éventuelles villes manquantes
  const artText = fs.readFileSync(ARTICLES_CSV, 'utf8');
  const lines = artText.split(/\r?\n/);
  const header = lines[0].split(',');
  const idx = header.findIndex(h => h.replace(/"/g, '').trim().toLowerCase().startsWith('ville'));
  if (idx >= 0) {
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (!cols[idx]) continue;
      cols[idx].split(/[;,]/).forEach(v => {
        const t = v.trim();
        if (t && t !== '-') set.add(t);
      });
    }
  }
  return Array.from(set).sort();
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'AHPV-geocoder/1.0' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function distanceKm(a, b) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]), lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function geocodeOne(ville) {
  // 1) recherche municipality biaisée Vizille
  const u1 = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(ville)}&type=municipality&limit=5&lat=${VIZILLE_LAT}&lon=${VIZILLE_LON}`;
  let json = await fetchJson(u1);
  let pick = pickBest(json, ville);
  if (pick) return { source: 'ban-municipality', ...pick };

  // 2) recherche libre biaisée Vizille
  const u2 = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(ville)}&limit=5&lat=${VIZILLE_LAT}&lon=${VIZILLE_LON}`;
  json = await fetchJson(u2);
  pick = pickBest(json, ville);
  if (pick) return { source: 'ban-search', ...pick };

  return null;
}

function pickBest(json, ville) {
  if (!json || !json.features || !json.features.length) return null;
  // Préférer le résultat le plus proche de Vizille parmi les bons scores
  const scored = json.features
    .map(f => {
      const lon = f.geometry.coordinates[0];
      const lat = f.geometry.coordinates[1];
      const d = distanceKm([VIZILLE_LAT, VIZILLE_LON], [lat, lon]);
      return { f, lat, lon, d };
    })
    .sort((a, b) => a.d - b.d);
  // Tolérance : si dans 50 km de Vizille, on prend; sinon meilleur score BAN
  const close = scored.find(s => s.d <= 50);
  const best = close || scored[0];
  return {
    coords: [Number(best.lat.toFixed(5)), Number(best.lon.toFixed(5))],
    label: best.f.properties.label,
    citycode: best.f.properties.citycode || null,
    score: best.f.properties.score,
    distance_vizille_km: Number(best.d.toFixed(2))
  };
}

(async () => {
  const overrides = fs.existsSync(OVERRIDES_JSON)
    ? JSON.parse(fs.readFileSync(OVERRIDES_JSON, 'utf8'))
    : {};

  const villes = collectVilles();
  console.log(`📋 ${villes.length} villes à traiter`);

  const out = {};
  const report = [];
  for (const v of villes) {
    const key = normalize(v);
    if (overrides[key]) {
      out[key] = { ...overrides[key], source: 'override', display_name: v };
      report.push(`✋ ${v.padEnd(40)} override → [${overrides[key].coords.join(', ')}]`);
      continue;
    }
    try {
      const r = await geocodeOne(v);
      if (r) {
        out[key] = { ...r, display_name: v };
        report.push(`✅ ${v.padEnd(40)} ${r.source.padEnd(18)} ${r.label} (${r.distance_vizille_km}km)`);
      } else {
        out[key] = { coords: null, source: 'not-found', display_name: v };
        report.push(`❌ ${v.padEnd(40)} NON TROUVÉ`);
      }
    } catch (e) {
      out[key] = { coords: null, source: 'error', display_name: v, error: e.message };
      report.push(`💥 ${v.padEnd(40)} ${e.message}`);
    }
    // BAN n'a pas de rate limit strict, mais soyons polis
    await new Promise(r => setTimeout(r, 80));
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  console.log('\n' + report.join('\n'));
  console.log(`\n💾 Écrit ${OUT_JSON} (${Object.keys(out).length} entrées)`);

  // Rapport des suspects (très loin de Vizille)
  const suspects = Object.entries(out)
    .filter(([k, v]) => v.coords && v.distance_vizille_km > 30 && v.source !== 'override')
    .sort((a, b) => b[1].distance_vizille_km - a[1].distance_vizille_km);
  if (suspects.length) {
    console.log('\n⚠️  À vérifier (> 30 km de Vizille) :');
    suspects.forEach(([k, v]) => {
      console.log(`   - ${v.display_name}  → ${v.label} (${v.distance_vizille_km}km)`);
    });
  }
})();
