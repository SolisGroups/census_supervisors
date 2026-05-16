/* =====================================================================
   DASHBOARD SUPERVISEURS — 4ème RGPH/RGAE Cameroun
   Données : data/submissions.json  (généré par GitHub Actions)
   Formulaire KoboToolbox : aGFaz86f9uVHSr4LX37haY
   ===================================================================== */
'use strict';

// ── Helpers ─────────────────────────────────────────────────────────────
const byId    = id => document.getElementById(id);
const setText = (id, v) => { const el = byId(id); if (el) el.textContent = v; };
const toInt   = v => parseInt(v || 0) || 0;
const toFlt   = v => parseFloat(v || 0) || 0;
const pct     = (a, b) => b > 0 ? (a / b * 100).toFixed(1) : '0.0';

const REGION_NAMES = {
  'adamaoua':'Adamaoua','centre':'Centre','est':'Est','extreme_nord':'Extrême-Nord',
  'littoral':'Littoral','nord':'Nord','nord_ouest':'Nord-Ouest','ouest':'Ouest',
  'sud':'Sud','sud_ouest':'Sud-Ouest'
};

// ── État global ───────────────────────────────────────────────────────────
let allData       = [];
let activeProfile = 'all';   // 'all' | 'SR' | 'SD'
let activeRegion  = '';
let activeDept    = '';
let activeArr     = '';
let activeZC      = '';

/** Données filtrées selon profil + entités administratives */
function filtered() {
  return allData.filter(r => {
    if (activeProfile !== 'all' && r['grp_profil/profil'] !== activeProfile) return false;
    if (activeRegion && r['grp_profil/region']         !== activeRegion)    return false;
    if (activeDept   && r['grp_profil/departement']    !== activeDept)      return false;
    if (activeArr    && r['grp_profil/arrondissement']  !== activeArr)       return false;
    if (activeZC) {
      const zcs = (r['grp_1b/rep_zc'] || []).map(z => z['grp_1b/rep_zc/zc_nom']);
      if (!zcs.includes(activeZC)) return false;
    }
    return true;
  });
}

/**
 * Déduplique filtered() en construisant une "fiche virtuelle" par superviseur.
 *
 * Problèmes corrigés :
 * 1. Noms en double par casse différente ("DUPONT" vs "Dupont") → normalisation
 *    avant la clé de déduplication.
 * 2. Superviseurs multi-fiches : chaque fiche couvre des ZCs DIFFÉRENTES sur
 *    des jours différents → prendre uniquement la dernière fiche perdait toutes
 *    les ZCs des autres jours (ZD assignées sous-comptées de ~40%).
 *
 * Stratégie :
 * - ZC / département : agrégation par (sup_normalisé + nom_ZC/dept),
 *   valeurs de la date la plus récente pour cette ZC.
 * - Champs globaux (RH, TIC, appréciation…) : valeurs de la fiche la plus
 *   récente (snapshot courant, pas de cumul).
 */
function dedupedFiltered() {
  const normName = s => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const rows = filtered();
  const byNorm = new Map();

  rows.forEach(r => {
    const norm = normName(r['grp_profil/nom_superviseur'] || ('_id_' + r['_id']));
    const date = r['grp_date/date_fiche'] || (r['_submission_time'] || '').split('T')[0] || '';

    if (!byNorm.has(norm)) {
      byNorm.set(norm, { latestDate: '', latestFiche: r, zcMap: {}, deptMap: {} });
    }
    const sup = byNorm.get(norm);

    // Fiche la plus récente → champs globaux (RH, TIC, appréciation…)
    if (date >= sup.latestDate) {
      sup.latestDate  = date;
      sup.latestFiche = r;
    }

    // Par ZC : garder les valeurs de la date la plus récente pour cette ZC
    // (couvre le cas où la même ZC est re-soumise sur plusieurs dates)
    (r['grp_1b/rep_zc'] || []).forEach(zc => {
      const n = zc['grp_1b/rep_zc/zc_nom']; if (!n) return;
      if (!sup.zcMap[n] || date >= (sup.zcMap[n]._date || ''))
        sup.zcMap[n] = { ...zc, _date: date };
    });

    // Par département (SR) : idem
    (r['grp_1a/rep_dept'] || []).forEach(dep => {
      const n = dep['grp_1a/rep_dept/dept_nom']; if (!n) return;
      if (!sup.deptMap[n] || date >= (sup.deptMap[n]._date || ''))
        sup.deptMap[n] = { ...dep, _date: date };
    });
  });

  // Fiche virtuelle : champs globaux de la dernière soumission +
  // toutes les ZC/depts uniques (une entrée par ZC, valeur la plus récente)
  return [...byNorm.values()].map(sup => ({
    ...sup.latestFiche,
    'grp_1b/rep_zc':   Object.values(sup.zcMap),
    'grp_1a/rep_dept': Object.values(sup.deptMap),
  }));
}

// ── Helpers ZD (évite la répétition dans chaque render) ─────────────────
// Priorité : lignes rep_zc (129/130 fiches) ou rep_dept → sinon champ tot_ (peu renseigné)
function getZdAsgn(r) {
  let vZC = 0;
  (r['grp_1b/rep_zc']  ||[]).forEach(z => vZC += toInt(z['grp_1b/rep_zc/zc_zd_assignees']));
  if (vZC) return vZC;
  let vDept = 0;
  (r['grp_1a/rep_dept']||[]).forEach(d => vDept += toInt(d['grp_1a/rep_dept/dept_zd_assignees']));
  if (vDept) return vDept;
  return toInt(r['grp_1b/tot_zd_sd'] || r['grp_1a/tot_zd_sr']);
}
function getMajAch(r) {
  let vZC = 0;
  (r['grp_1b/rep_zc']  ||[]).forEach(z => vZC += toInt(z['grp_1b/rep_zc/zc_maj_achevees']));
  if (vZC) return vZC;
  let vDept = 0;
  (r['grp_1a/rep_dept']||[]).forEach(d => vDept += toInt(d['grp_1a/rep_dept/dept_maj_achevees']));
  if (vDept) return vDept;
  return toInt(r['grp_1b/tot_maj_sd'] || r['grp_1a/tot_maj_sr']);
}
function getDenAch(r) {
  let vZC = 0;
  (r['grp_1b/rep_zc']  ||[]).forEach(z => vZC += toInt(z['grp_1b/rep_zc/zc_den_achevees']));
  if (vZC) return vZC;
  let vDept = 0;
  (r['grp_1a/rep_dept']||[]).forEach(d => vDept += toInt(d['grp_1a/rep_dept/dept_den_achevees']));
  if (vDept) return vDept;
  return toInt(r['grp_1b/tot_den_sd'] || r['grp_1a/tot_den_sr']);
}
function getMajEnc(r) {
  let v = 0;
  (r['grp_1b/rep_zc']  ||[]).forEach(z => v += toInt(z['grp_1b/rep_zc/zc_maj_encours']));
  (r['grp_1a/rep_dept']||[]).forEach(d => v += toInt(d['grp_1a/rep_dept/dept_maj_encours']));
  return v;
}
function getDenEnc(r) {
  let v = 0;
  (r['grp_1b/rep_zc']  ||[]).forEach(z => v += toInt(z['grp_1b/rep_zc/zc_den_encours']));
  (r['grp_1a/rep_dept']||[]).forEach(d => v += toInt(d['grp_1a/rep_dept/dept_den_encours']));
  return v;
}

// ── Filtres administratifs ───────────────────────────────────────────────
function populateAdminFilters() {
  _fillSelect('filterRegion', '', 'Toutes régions',
    [...new Set(allData.map(r => r['grp_profil/region']).filter(Boolean))].sort(),
    v => REGION_NAMES[v] || v);
  _cascadeAdmin();
}

function onAdminFilter(level) {
  activeRegion = byId('filterRegion').value;
  if (level === 'region') { activeDept = ''; activeArr = ''; activeZC = ''; }
  if (level === 'dept')   { activeArr  = ''; activeZC  = ''; }
  if (level === 'arr')    { activeZC   = ''; }
  activeDept = byId('filterDept').value;
  activeArr  = byId('filterArr').value;
  activeZC   = byId('filterZC').value;
  _cascadeAdmin();
  _updateAdminUI();
  renderAll();
}

function clearAdminFilter() {
  activeRegion = activeDept = activeArr = activeZC = '';
  ['filterRegion','filterDept','filterArr','filterZC'].forEach(id => { const el = byId(id); if (el) el.value = ''; });
  _cascadeAdmin();
  _updateAdminUI();
  renderAll();
}

function _cascadeAdmin() {
  // Département : filtré par région
  const baseR = activeRegion ? allData.filter(r => r['grp_profil/region'] === activeRegion) : allData;
  _fillSelect('filterDept', activeDept, 'Tous départements',
    [...new Set(baseR.map(r => r['grp_profil/departement']).filter(Boolean))].sort());

  // Arrondissement : filtré par région + département
  const baseD = activeDept ? baseR.filter(r => r['grp_profil/departement'] === activeDept) : baseR;
  _fillSelect('filterArr', activeArr, 'Tous arrondissements',
    [...new Set(baseD.map(r => r['grp_profil/arrondissement']).filter(Boolean))].sort());

  // ZC : filtrée par région + département + arrondissement
  const baseA = activeArr ? baseD.filter(r => r['grp_profil/arrondissement'] === activeArr) : baseD;
  const allZCs = [];
  baseA.forEach(r => (r['grp_1b/rep_zc']||[]).forEach(z => {
    const n = z['grp_1b/rep_zc/zc_nom']; if (n) allZCs.push(n);
  }));
  _fillSelect('filterZC', activeZC, 'Toutes ZC',
    [...new Set(allZCs)].sort((a,b) => String(a).localeCompare(String(b), undefined, {numeric:true})),
    v => `ZC ${v}`);
}

function _fillSelect(id, currentVal, placeholder, values, labelFn) {
  const el = byId(id); if (!el) return;
  el.innerHTML = `<option value="">${placeholder}</option>`
    + values.map(v => `<option value="${v}" ${v===currentVal?'selected':''}>${labelFn ? labelFn(v) : v}</option>`).join('');
}

function _updateAdminUI() {
  const hasFilter = activeRegion || activeDept || activeArr || activeZC;
  const btn = byId('clearAdminBtn');
  if (btn) btn.style.display = hasFilter ? '' : 'none';
  const cnt = filtered().length;
  const countEl = byId('adminFilterCount');
  if (countEl) countEl.textContent = hasFilter ? `${cnt} fiche${cnt>1?'s':''}` : '';
}

/** Changer le filtre profil et re-rendre */
function setProfileFilter(val, btn) {
  activeProfile = val;
  document.querySelectorAll('.profile-btn').forEach(b => {
    const isActive = b.dataset.profile === val;
    b.classList.toggle('active', isActive);
    if (isActive) {
      b.classList.remove('btn-outline-light');
      b.classList.add('btn-warning', 'text-dark');
    } else {
      b.classList.add('btn-outline-light');
      b.classList.remove('btn-warning', 'text-dark');
    }
  });
  renderAll();
}

// ── Démarrage ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setStatus('loading');
  start();
});

async function start() {
  try {
    splash('Lecture des données…');
    const resp = await fetch('./data/submissions.json');
    if (!resp.ok) throw new Error(
      resp.status === 404
        ? 'Fichier data/submissions.json introuvable.\nLancez le workflow GitHub Actions.'
        : `Erreur HTTP ${resp.status}`
    );
    const json = await resp.json();
    allData = json.results || [];

    if (json.fetched_at) {
      const d = new Date(json.fetched_at);
      const label = d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })
                  + ' ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) + ' UTC';
      setText('lastSyncLabel', `Sync : ${label}`);
      setText('footer-sync', label);
    }

    byId('totalBadge').textContent = `${allData.length} fiche${allData.length > 1 ? 's' : ''}`;
    setStatus('online');
    populateAdminFilters();
    renderAll();
    hideSplash();
  } catch (err) {
    splashError(err.message);
  }
}

async function reloadData() {
  showBar(true);
  byId('refreshBtn').disabled = true;
  setStatus('loading');
  try {
    const resp = await fetch('./data/submissions.json?t=' + Date.now());
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    allData = json.results || [];
    byId('totalBadge').textContent = `${allData.length} fiche${allData.length > 1 ? 's' : ''}`;
    if (json.fetched_at) {
      const d = new Date(json.fetched_at);
      setText('lastSyncLabel', 'Sync : ' + d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short' })
                             + ' ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }));
    }
    setStatus('online');
    populateAdminFilters();
    renderAll();
  } catch(err) {
    setStatus('error');
    alert('Erreur rechargement : ' + err.message);
  } finally {
    showBar(false);
    byId('refreshBtn').disabled = false;
  }
}

function renderAll() {
  if (!allData.length) return;
  renderOverview();
  renderTerritoire();
  renderAvancement();
  renderRH();
  renderDifficultes();
  renderRawTable();
}

/** Badge couleur selon profil */
function profileBadgeHtml(profil) {
  if (profil === 'SR') return '<span class="badge-alerte badge-ok" style="font-size:.68rem">SR</span>';
  if (profil === 'SD') return '<span class="badge-alerte badge-warn" style="font-size:.68rem">SD</span>';
  return `<span class="badge-alerte" style="font-size:.68rem;background:#e2e8f0;color:#334155">${profil}</span>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  TAB 1 — VUE D'ENSEMBLE
// ═══════════════════════════════════════════════════════════════════════════
function renderOverview() {
  const d = dedupedFiltered();

  // ── Badge filtre actif ──
  const filterBadgeEl = byId('ops-filter-badge');
  if (filterBadgeEl) {
    if (activeProfile === 'SR')
      filterBadgeEl.innerHTML = '<span class="filter-badge-sr"><i class="fas fa-user-shield me-1"></i>Filtre : Superviseurs Régionaux</span>';
    else if (activeProfile === 'SD')
      filterBadgeEl.innerHTML = '<span class="filter-badge-sd"><i class="fas fa-user-tie me-1"></i>Filtre : Superviseurs Départementaux</span>';
    else
      filterBadgeEl.innerHTML = '<span class="filter-badge-all"><i class="fas fa-layer-group me-1"></i>Tous profils</span>';
  }

  // ── Identités ──
  const superviseurs = new Set(d.map(r => r['grp_profil/nom_superviseur']).filter(Boolean));
  const regions      = new Set(d.map(r => r['grp_profil/region']).filter(Boolean));
  const sr           = d.filter(r => r['grp_profil/profil'] === 'SR').length;
  const sd           = d.filter(r => r['grp_profil/profil'] === 'SD').length;

  const dates     = d.map(r => r['grp_date/date_fiche']).filter(Boolean).sort();
  const dateFirst = dates[0] || '—';
  const dateLast  = dates[dates.length - 1] || '—';

  const fmtD = s => { if (!s || s === '—') return '—';
    return new Date(s + 'T00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'long' }); };
  const fmtDfull = s => { if (!s || s === '—') return '—';
    return new Date(s + 'T00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }); };

  setText('ops-period',    `du ${fmtD(dateFirst)} au ${fmtDfull(dateLast)}`);
  setText('ops-nb-sup',    superviseurs.size);
  setText('ops-nb-regions',regions.size);
  setText('ops-nb-fiches', d.length);

  // ── Totaux ZD ──
  // SR : rep_dept ; SD : rep_zc
  let totalZdAsgn = 0, totalMajAch = 0, totalMajEnc = 0;
  let totalDenAch = 0, totalDenEnc = 0;

  d.forEach(r => {
    totalZdAsgn += getZdAsgn(r);
    totalMajAch += getMajAch(r);
    totalMajEnc += getMajEnc(r);
    totalDenAch += getDenAch(r);
    totalDenEnc += getDenEnc(r);
  });

  const txMaj = pct(totalMajAch, totalZdAsgn);
  const txDen = pct(totalDenAch, totalZdAsgn);

  // Badge % inline — affiché à droite du chiffre principal d'un KPI
  const pctBadge = (val, color) =>
    `<span style="font-size:.5em;font-weight:700;vertical-align:middle;margin-left:4px;` +
    `background:${color}18;color:${color};border-radius:4px;padding:1px 5px">${val}%</span>`;
  const rateColor = r => parseFloat(r) >= 80 ? '#16a34a' : parseFloat(r) >= 50 ? '#d97706' : '#dc2626';

  // ── RH ──
  let totalAgPrevus = 0, totalAgOp = 0, totalAgAbs = 0, totalDesist = 0;
  let totalReserv = 0, totalNonPaInteg = 0, totalZdSansCouv = 0;
  d.forEach(r => {
    totalAgPrevus   += toInt(r['grp_rh/rh_agents_prevus']);
    totalAgOp       += toInt(r['grp_rh/rh_agents_operationnels']);
    totalAgAbs      += toInt(r['grp_rh/rh_absents']);
    totalDesist     += toInt(r['grp_rh/rh_desistements']);
    totalReserv     += toInt(r['grp_rh/rh_reservistes']);
    totalNonPaInteg += toInt(r['grp_rh/calc_non_integraux']);
    totalZdSansCouv += toInt(r['grp_rh/rh_zd_sans_couverture']);
  });

  // ── TIC ──
  let ticTotal = 0, ticPanne = 0, ticReseau = 0, ticGPS = 0, ticApp = 0;
  d.forEach(r => {
    ticPanne  += toInt(r['grp_diff/tic_smartphones_panne']);
    ticReseau += toInt(r['grp_diff/tic_sans_reseau']);
    ticGPS    += toInt(r['grp_diff/tic_gps_defaillant']);
    ticApp    += toInt(r['grp_diff/tic_app_non_jour']);
  });
  ticTotal = ticPanne + ticReseau + ticGPS + ticApp;

  // ── Incidents ──
  const incidents = d.filter(r => r['grp_diff/incident_securite'] === 'oui').length;

  // ── Appréciation ──
  const apprecCount = { satisfaisant:0, perfectible:0, intervention_urgente:0 };
  d.forEach(r => {
    const a = r['grp_appreciation/appreciation_globale'];
    if (a && apprecCount[a] !== undefined) apprecCount[a]++;
  });

  // ─────── AFFICHAGE KPIs ───────
  const txOp  = pct(totalAgOp,       totalAgPrevus);
  const pctNP = totalAgPrevus > 0 ? parseFloat(pct(totalNonPaInteg, totalAgPrevus)).toFixed(0) : 0;
  const pctAbs= totalAgPrevus > 0 ? parseFloat(pct(totalAgAbs,       totalAgPrevus)).toFixed(0) : 0;
  const pctDes= totalAgPrevus > 0 ? parseFloat(pct(totalDesist,      totalAgPrevus)).toFixed(0) : 0;
  const pctZdSC = totalZdAsgn > 0 ? parseFloat(pct(totalZdSansCouv, totalZdAsgn)).toFixed(0) : 0;

  setText('kpi-sup', superviseurs.size);
  setText('kpi-sup-sub', `${sr} SR · ${sd} SD · ${regions.size} région${regions.size > 1 ? 's' : ''}`);

  // ZD assignées — sous-titre avec les deux taux synthétisés
  byId('kpi-zd-total').innerHTML =
    totalZdAsgn.toLocaleString('fr-FR') + pctBadge(txMaj, rateColor(txMaj));
  setText('kpi-zd-total-sub', `MAJ achevées · Dénom. : ${txDen}%`);

  // MAJ achevées — badge % taux MAJ
  byId('kpi-maj-ach').innerHTML =
    totalMajAch.toLocaleString('fr-FR') + pctBadge(txMaj, rateColor(txMaj));
  setText('kpi-maj-ach-sub', `sur ${totalZdAsgn} ZD assignées · en cours : ${totalMajEnc}`);

  // Dénombrement achevé — badge % taux Dénom.
  byId('kpi-den-ach').innerHTML =
    totalDenAch.toLocaleString('fr-FR') + pctBadge(txDen, rateColor(txDen));
  setText('kpi-den-ach-sub', `sur ${totalZdAsgn} ZD assignées · en cours : ${totalDenEnc}`);

  // Agents opérationnels — badge % présence
  byId('kpi-agents-op').innerHTML =
    totalAgOp.toLocaleString('fr-FR') + pctBadge(txOp, rateColor(txOp));
  setText('kpi-agents-op-sub', `taux présence · ${totalAgAbs} absent${totalAgAbs>1?'s':''} (${pctAbs}%) · ${totalDesist} désist.`);

  // Non payés — badge % des prévus
  byId('kpi-non-payes').innerHTML =
    totalNonPaInteg.toLocaleString('fr-FR') + (pctNP > 0 ? pctBadge(pctNP, '#dc2626') : '');
  setText('kpi-non-payes-sub', `des agents prévus · ${totalAgPrevus} prévus`);

  // TIC — badge % agents touchés
  const pctTic = totalAgPrevus > 0 ? parseFloat(pct(ticTotal, totalAgPrevus)).toFixed(0) : 0;
  byId('kpi-tic').innerHTML =
    ticTotal.toLocaleString('fr-FR') + (pctTic > 0 ? pctBadge(pctTic, '#7c3aed') : '');
  setText('kpi-tic-sub', `prob. TIC · Smartphones: ${ticPanne} · Réseau: ${ticReseau} · GPS: ${ticGPS}`);

  // Incidents — badge % superviseurs concernés
  const pctInc = d.length > 0 ? Math.round(incidents / d.length * 100) : 0;
  byId('kpi-incidents').innerHTML =
    incidents + (pctInc > 0 ? pctBadge(pctInc, '#dc2626') : '');
  setText('kpi-incidents-sub', incidents > 0 ? `${pctInc}% des superviseurs · voir Difficultés` : 'Aucun incident signalé');

  // ─────── ALERTES ───────
  let alertHtml = '';

  if (totalNonPaInteg > 0) {
    const topNP = d
      .filter(r => toInt(r['grp_rh/calc_non_integraux']) > 0)
      .sort((a, b) => toInt(b['grp_rh/calc_non_integraux']) - toInt(a['grp_rh/calc_non_integraux']))
      .slice(0, 5)
      .map(r => `${r['grp_profil/nom_superviseur'] || '?'} : ${r['grp_rh/calc_non_integraux']}`)
      .join(' &nbsp;|&nbsp; ');
    alertHtml += `<div class="alert-item critique">
      <div class="alert-item-header">
        <span class="alert-badge critique">P1 CRITIQUE</span>
        <span class="alert-item-title">${totalNonPaInteg.toLocaleString('fr-FR')} agents non intégralement payés
          <small style="font-weight:400;opacity:.8">(${pctNP}% des prévus)</small></span>
      </div>
      <div class="alert-item-detail">${topNP}</div>
    </div>`;
  }

  if (incidents > 0) {
    const incDet = d.filter(r => r['grp_diff/incident_securite'] === 'oui')
      .map(r => `${r['grp_profil/nom_superviseur'] || '?'} (${r['grp_date/date_fiche'] || '?'})`)
      .join(' · ');
    alertHtml += `<div class="alert-item critique">
      <div class="alert-item-header">
        <span class="alert-badge critique">P1 URGENT</span>
        <span class="alert-item-title">${incidents} incident${incidents>1?'s':''} sécuritaire${incidents>1?'s':''} signalé${incidents>1?'s':''}
          <small style="font-weight:400;opacity:.8">(${pctInc}% des superviseurs)</small></span>
      </div>
      <div class="alert-item-detail">${incDet}</div>
    </div>`;
  }

  if (totalZdSansCouv > 0) {
    alertHtml += `<div class="alert-item urgent">
      <div class="alert-item-header">
        <span class="alert-badge urgent">P1 URGENT</span>
        <span class="alert-item-title">${totalZdSansCouv} ZD sans couverture ce jour
          <small style="font-weight:400;opacity:.8">(${pctZdSC}% des assignées)</small></span>
      </div>
      <div class="alert-item-detail">Assigner des agents ou réservistes immédiatement</div>
    </div>`;
  }

  const txMajNum = parseFloat(txMaj);
  if (txMajNum < 50 && totalZdAsgn > 0) {
    alertHtml += `<div class="alert-item urgent">
      <div class="alert-item-header">
        <span class="alert-badge urgent">P2 ÉLEVÉ</span>
        <span class="alert-item-title">Taux MAJ faible : ${txMaj}% — ${totalMajAch} / ${totalZdAsgn} ZD achevées</span>
      </div>
      <div class="alert-item-detail">Accélérer la mise à jour des cartouches · Dénom. : ${txDen}%</div>
    </div>`;
  }

  if (ticTotal > 0) {
    alertHtml += `<div class="alert-item info">
      <div class="alert-item-header">
        <span class="alert-badge info">P2 TIC</span>
        <span class="alert-item-title">${ticTotal} problèmes TIC signalés
          <small style="font-weight:400;opacity:.8">(${pctTic}% des agents)</small></span>
      </div>
      <div class="alert-item-detail">Smartphones: ${ticPanne} · Réseau: ${ticReseau} · GPS: ${ticGPS} · Applis: ${ticApp}</div>
    </div>`;
  }

  if (totalDesist > 0) {
    alertHtml += `<div class="alert-item urgent">
      <div class="alert-item-header">
        <span class="alert-badge urgent">P2 RH</span>
        <span class="alert-item-title">${totalDesist} désistement${totalDesist>1?'s':''} définitif${totalDesist>1?'s':''} (cumul)
          <small style="font-weight:400;opacity:.8">(${pctDes}% des prévus)</small></span>
      </div>
      <div class="alert-item-detail">${totalReserv} réserviste${totalReserv!==1?'s':''} déployé${totalReserv!==1?'s':''}</div>
    </div>`;
  }

  if (!alertHtml) {
    alertHtml = `<div class="alert-item ok">
      <div class="alert-item-header"><span class="alert-badge ok">OK</span>
        <span class="alert-item-title">Aucune alerte critique détectée</span></div>
    </div>`;
  }
  byId('alertes-body').innerHTML = alertHtml;

  // ─────── APPRÉCIATION ───────
  const apprecCfg = [
    { key:'satisfaisant',         label:'Satisfaisante',        color:'#16a34a' },
    { key:'perfectible',          label:'Perfectible',          color:'#d97706' },
    { key:'intervention_urgente', label:'Intervention urgente',  color:'#dc2626' },
  ];
  const totalAppr = Object.values(apprecCount).reduce((s, v) => s + v, 0);
  let appHtml = `<div style="font-size:.72rem;font-weight:700;color:#374151;margin-bottom:6px;text-transform:uppercase">
    Appréciation <span style="font-weight:400;color:#64748b">(${totalAppr} fiche${totalAppr>1?'s':''})</span></div>`;
  apprecCfg.forEach(({ key, label, color }) => {
    const cnt = apprecCount[key] || 0;
    if (!cnt) return;
    const p = totalAppr > 0 ? Math.round(cnt / totalAppr * 100) : 0;
    appHtml += `<div class="apprec-bar-item">
      <div class="apprec-bar-label">
        <span style="color:${color};font-weight:600">${label}</span>
        <span style="color:${color}">${cnt} (${p}%)</span>
      </div>
      <div class="apprec-bar-track"><div class="apprec-bar-fill" style="width:${p}%;background:${color}"></div></div>
    </div>`;
  });
  byId('appreciation-body').innerHTML = appHtml;

  // ─────── TABLEAU SUPERVISEURS ───────
  const profileLabel = activeProfile === 'SR' ? 'Superviseurs Régionaux (SR)'
                     : activeProfile === 'SD' ? 'Superviseurs Départementaux (SD)'
                     : 'Tous superviseurs';
  let tHtml = `<div style="font-size:.72rem;color:#64748b;margin-bottom:.5rem">
    <i class="fas fa-filter me-1"></i>${profileLabel} · ${d.length} fiche${d.length>1?'s':''}
  </div>`;
  if (!d.length) {
    tHtml += `<div class="text-muted small p-3 text-center">Aucune fiche pour ce profil.</div>`;
    byId('superviseurs-body').innerHTML = tHtml;
  } else {
  tHtml += `<table class="sup-table">
    <thead><tr>
      <th>Superviseur</th><th>Profil</th><th>Région</th><th>ZD Asgn.</th>
      <th>MAJ ach. / %</th><th>Dénom. ach. / %</th>
      <th>Agents op.</th><th>Non payés</th><th>TIC</th><th>Appréciation</th>
    </tr></thead><tbody>`;

  d.sort((a, b) => {
    const npa = toInt(a['grp_rh/calc_non_integraux']);
    const npb = toInt(b['grp_rh/calc_non_integraux']);
    return npb - npa;
  }).forEach(r => {
    const nom    = r['grp_profil/nom_superviseur'] || '—';
    const profil = r['grp_profil/profil'] || '—';
    const reg    = REGION_NAMES[r['grp_profil/region']] || r['grp_profil/region'] || '—';
    const date   = r['grp_date/date_fiche'] || '—';

    const zdAsgn = getZdAsgn(r);
    const majAch = getMajAch(r);
    const denAch = getDenAch(r);

    const txMajR = zdAsgn > 0 ? Math.round(majAch / zdAsgn * 100) : 0;
    const txDenR = zdAsgn > 0 ? Math.round(denAch / zdAsgn * 100) : 0;
    const majColor = txMajR >= 80 ? '#16a34a' : txMajR >= 50 ? '#d97706' : '#dc2626';
    const denColor = txDenR >= 80 ? '#16a34a' : txDenR >= 50 ? '#d97706' : '#dc2626';

    const agOp  = toInt(r['grp_rh/rh_agents_operationnels']);
    const agPr  = toInt(r['grp_rh/rh_agents_prevus']);
    const txOpR = agPr > 0 ? Math.round(agOp / agPr * 100) : 0;
    const np    = toInt(r['grp_rh/calc_non_integraux']);
    const tic   = toInt(r['grp_diff/tic_smartphones_panne']) + toInt(r['grp_diff/tic_sans_reseau']) +
                  toInt(r['grp_diff/tic_gps_defaillant']) + toInt(r['grp_diff/tic_app_non_jour']);
    const appr  = r['grp_appreciation/appreciation_globale'] || '—';
    const apprColor = appr === 'satisfaisant' ? '#16a34a'
                    : appr === 'perfectible'  ? '#d97706'
                    : appr === 'intervention_urgente' ? '#dc2626' : '#94a3b8';

    tHtml += `<tr>
      <td><strong>${nom}</strong><br><span style="color:#94a3b8;font-size:.68rem">${date}</span></td>
      <td><span class="badge-alerte ${profil === 'SR' ? 'badge-ok' : 'badge-warn'}">${profil}</span></td>
      <td style="font-size:.72rem">${reg}</td>
      <td style="font-weight:700">${zdAsgn || '—'}</td>
      <td>
        <div class="prog-wrap">
          <span style="color:${majColor};font-weight:700;min-width:28px">${txMajR}%</span>
          <div class="prog-bar-sm"><div class="prog-bar-fill" style="width:${txMajR}%;background:${majColor}"></div></div>
          <span style="font-size:.68rem;color:#64748b">${majAch}</span>
        </div>
      </td>
      <td>
        <div class="prog-wrap">
          <span style="color:${denColor};font-weight:700;min-width:28px">${txDenR}%</span>
          <div class="prog-bar-sm"><div class="prog-bar-fill" style="width:${txDenR}%;background:${denColor}"></div></div>
          <span style="font-size:.68rem;color:#64748b">${denAch}</span>
        </div>
      </td>
      <td>${agOp}/${agPr} <span style="color:#64748b;font-size:.68rem">(${txOpR}%)</span></td>
      <td><span class="badge-alerte ${np > 0 ? 'badge-danger' : 'badge-ok'}">${np > 0 ? np + ' NP' : 'OK'}</span></td>
      <td><span class="badge-alerte ${tic > 0 ? 'badge-warn' : 'badge-ok'}">${tic > 0 ? tic : 'OK'}</span></td>
      <td><span style="color:${apprColor};font-weight:600;font-size:.72rem">${appr}</span></td>
    </tr>`;
  });
  tHtml += '</tbody></table>';
  byId('superviseurs-body').innerHTML = tHtml;
  } // end else

  // ─────── ACTIONS REQUISES ───────
  const actions = [];
  if (totalNonPaInteg > 0)
    actions.push({ n:1, p:'P1 CRITIQUE', c:'#dc2626',
      t:`PAIEMENT — ${totalNonPaInteg} agents non intégralement payés`,
      d:'Virement immédiat pour tous les frais en retard', f:'Coord. Nat. / 24h' });
  if (incidents > 0)
    actions.push({ n:actions.length+1, p:'P1 URGENT', c:'#dc2626',
      t:`SÉCURITÉ — ${incidents} incident${incidents>1?'s':''} à traiter`,
      d:'Rapport détaillé + mesures sécurisation', f:'Coord. Nat. / 24h' });
  if (totalZdSansCouv > 0)
    actions.push({ n:actions.length+1, p:'P1 URGENT', c:'#d97706',
      t:`COUVERTURE — ${totalZdSansCouv} ZD sans agent`,
      d:'Déployer réservistes ou redistribuer les équipes', f:'Sup. Terrain / 24h' });
  if (txMajNum < 50 && totalZdAsgn > 0)
    actions.push({ n:actions.length+1, p:'P2 ÉLEVÉ', c:'#d97706',
      t:`AVANCEMENT MAJ — ${txMaj}% seulement`,
      d:'Renforcer le suivi journalier des équipes', f:'Sup. / 48h' });
  if (ticTotal > 0)
    actions.push({ n:actions.length+1, p:'P2 TIC', c:'#7c3aed',
      t:`TIC — ${ticTotal} problème${ticTotal>1?'s':''} matériel`,
      d:`Smartphones: ${ticPanne} · Réseau: ${ticReseau} · GPS: ${ticGPS}`, f:'Support Tech. / 48h' });
  while (actions.length < 4)
    actions.push({ n:actions.length+1, p:'P3 SUIVI', c:'#64748b',
      t:'SUIVI RÉGULIER', d:'Vérifier la synchronisation des données quotidiennement', f:'Coord. / continu' });

  byId('actions-body').innerHTML = actions.slice(0,4).map(a => `
    <div class="col-12 col-md-6 col-lg-3">
      <div class="action-card" style="--action-color:${a.c}">
        <div class="action-card-header">
          <div class="action-number">${a.n}</div>
          <span class="action-priority">${a.p}</span>
        </div>
        <div class="action-title">${a.t}</div>
        <div class="action-desc">${a.d}</div>
        <div class="action-footer">${a.f}</div>
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
//  TAB 2 — VUE TERRITORIALE
// ═══════════════════════════════════════════════════════════════════════════
function renderTerritoire() {
  const data = dedupedFiltered();
  const body = byId('territoire-body');
  const countEl = byId('terr-count');
  if (!body) return;

  if (!data.length) {
    if (countEl) countEl.textContent = '0';
    body.innerHTML = '<div class="text-muted small p-4 text-center"><i class="fas fa-map me-2"></i>Aucune donnée pour cette sélection.</div>';
    return;
  }
  if (countEl) countEl.textContent = `${data.length} fiche${data.length>1?'s':''}`;

  // ── Construire l'arborescence Région → Département → Arrondissement ──
  const tree = {};
  data.forEach(r => {
    const reg  = r['grp_profil/region']        || '—';
    const dept = r['grp_profil/departement']   || '—';
    const arr  = r['grp_profil/arrondissement'] || '—';
    if (!tree[reg])         tree[reg] = {};
    if (!tree[reg][dept])   tree[reg][dept] = {};
    if (!tree[reg][dept][arr]) tree[reg][dept][arr] = [];
    tree[reg][dept][arr].push(r);
  });

  const colBar = (pct, color) => `
    <div class="prog-wrap">
      <span style="color:${color};font-weight:700;min-width:30px;font-size:.72rem">${pct}%</span>
      <div class="prog-bar-sm"><div class="prog-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
  const barColor = p => p >= 80 ? '#16a34a' : p >= 50 ? '#d97706' : '#dc2626';

  let html = '';

  Object.keys(tree).sort().forEach(reg => {
    const regName  = REGION_NAMES[reg] || reg;
    const regRows  = Object.values(tree[reg]).flatMap(d => Object.values(d).flat());
    const rZd  = regRows.reduce((s,r) => s+getZdAsgn(r), 0);
    const rMaj = regRows.reduce((s,r) => s+getMajAch(r), 0);
    const rDen = regRows.reduce((s,r) => s+getDenAch(r), 0);
    const rAgOp  = regRows.reduce((s,r) => s+toInt(r['grp_rh/rh_agents_operationnels']), 0);
    const rAgPr  = regRows.reduce((s,r) => s+toInt(r['grp_rh/rh_agents_prevus']), 0);
    const rTxMaj = rZd > 0 ? Math.round(rMaj/rZd*100) : 0;
    const rTxDen = rZd > 0 ? Math.round(rDen/rZd*100) : 0;

    html += `<div class="terr-region">
      <div class="terr-region-header">
        <i class="fas fa-globe-africa"></i>
        <span class="terr-region-name">${regName}</span>
        <div class="terr-stats ms-auto">
          <span class="terr-stat">ZD&nbsp;<strong>${rZd}</strong></span>
          <span class="terr-stat">MAJ&nbsp;<strong style="color:${barColor(rTxMaj)}">${rTxMaj}%</strong></span>
          <span class="terr-stat">Dénom.&nbsp;<strong style="color:${barColor(rTxDen)}">${rTxDen}%</strong></span>
          <span class="terr-stat">Agents&nbsp;<strong>${rAgOp}/${rAgPr}</strong></span>
          <span class="terr-stat">${regRows.length}&nbsp;fiche${regRows.length>1?'s':''}</span>
        </div>
      </div>`;

    Object.keys(tree[reg]).sort().forEach(dept => {
      const deptRows = Object.values(tree[reg][dept]).flat();
      const dZd  = deptRows.reduce((s,r) => s+getZdAsgn(r), 0);
      const dMaj = deptRows.reduce((s,r) => s+getMajAch(r), 0);
      const dDen = deptRows.reduce((s,r) => s+getDenAch(r), 0);
      const dTxMaj = dZd > 0 ? Math.round(dMaj/dZd*100) : 0;
      const dTxDen = dZd > 0 ? Math.round(dDen/dZd*100) : 0;

      html += `<div class="terr-dept">
        <div class="terr-dept-header">
          <i class="fas fa-building"></i>
          <span class="terr-dept-name">${dept}</span>
          <span class="terr-dept-stats ms-auto">
            ZD: ${dZd} &nbsp;·&nbsp;
            MAJ: <strong style="color:${barColor(dTxMaj)}">${dMaj} (${dTxMaj}%)</strong> &nbsp;·&nbsp;
            Dénom.: <strong style="color:${barColor(dTxDen)}">${dDen} (${dTxDen}%)</strong> &nbsp;·&nbsp;
            ${deptRows.length} sup.
          </span>
        </div>`;

      Object.keys(tree[reg][dept]).sort().forEach(arr => {
        const arrRows = tree[reg][dept][arr];
        const aZd  = arrRows.reduce((s,r) => s+getZdAsgn(r), 0);
        const aMaj = arrRows.reduce((s,r) => s+getMajAch(r), 0);
        const aDen = arrRows.reduce((s,r) => s+getDenAch(r), 0);
        const aTxMaj = aZd > 0 ? Math.round(aMaj/aZd*100) : 0;
        const aTxDen = aZd > 0 ? Math.round(aDen/aZd*100) : 0;

        html += `<div class="terr-arr">
          <div class="terr-arr-header">
            <i class="fas fa-map-pin"></i>
            <span class="terr-arr-name">${arr}</span>
            <span style="font-size:.69rem;color:var(--muted);margin-left:.25rem">
              · ZD: ${aZd} · MAJ: <strong style="color:${barColor(aTxMaj)}">${aTxMaj}%</strong>
              · Dénom.: <strong style="color:${barColor(aTxDen)}">${aTxDen}%</strong>
            </span>
            <span class="terr-arr-count ms-auto">${arrRows.length} superviseur${arrRows.length>1?'s':''}</span>
          </div>
          <div class="table-responsive">
          <table class="sup-table">
            <thead><tr>
              <th>Superviseur</th><th>Profil</th><th>Date</th>
              <th>ZD Asgn.</th>
              <th>MAJ ach. %</th><th>Dénom. ach. %</th>
              <th>Agents op./prév.</th><th>Non payés</th><th>Appréciation</th>
            </tr></thead>
            <tbody>`;

        arrRows.forEach(r => {
          const nom   = r['grp_profil/nom_superviseur'] || '—';
          const prof  = r['grp_profil/profil'] || '—';
          const date  = r['grp_date/date_fiche'] || '—';
          const zdA   = getZdAsgn(r), majA = getMajAch(r), denA = getDenAch(r);
          const tMaj  = zdA > 0 ? Math.round(majA/zdA*100) : 0;
          const tDen  = zdA > 0 ? Math.round(denA/zdA*100) : 0;
          const agOp  = toInt(r['grp_rh/rh_agents_operationnels']);
          const agPr  = toInt(r['grp_rh/rh_agents_prevus']);
          const np    = toInt(r['grp_rh/calc_non_integraux']);
          const appr  = r['grp_appreciation/appreciation_globale'] || '—';
          const aC    = appr==='satisfaisant'?'#16a34a':appr==='perfectible'?'#d97706':appr==='intervention_urgente'?'#dc2626':'#94a3b8';

          html += `<tr>
            <td><strong>${nom}</strong></td>
            <td>${profileBadgeHtml(prof)}</td>
            <td style="font-size:.7rem;color:var(--muted)">${date}</td>
            <td style="font-weight:700">${zdA||'—'}</td>
            <td>${colBar(tMaj, barColor(tMaj))}</td>
            <td>${colBar(tDen, barColor(tDen))}</td>
            <td>${agOp}/${agPr}</td>
            <td><span class="badge-alerte ${np>0?'badge-danger':'badge-ok'}">${np>0?np+' NP':'OK'}</span></td>
            <td><span style="color:${aC};font-weight:600;font-size:.72rem">${appr}</span></td>
          </tr>`;

          // ── Lignes ZC (détail pour SD) ──
          (r['grp_1b/rep_zc']||[]).forEach(zc => {
            const zNom = zc['grp_1b/rep_zc/zc_nom'] || '?';
            const zZd  = toInt(zc['grp_1b/rep_zc/zc_zd_assignees']);
            const zMaj = toInt(zc['grp_1b/rep_zc/zc_maj_achevees']);
            const zMajE= toInt(zc['grp_1b/rep_zc/zc_maj_encours']);
            const zDen = toInt(zc['grp_1b/rep_zc/zc_den_achevees']);
            const zDenE= toInt(zc['grp_1b/rep_zc/zc_den_encours']);
            const zTMaj= zZd>0?Math.round(zMaj/zZd*100):0;
            const zTDen= zZd>0?Math.round(zDen/zZd*100):0;
            const obs  = zc['grp_1b/rep_zc/zc_observations'] || '';
            html += `<tr class="terr-zc-row">
              <td colspan="2"><i class="fas fa-layer-group me-1" style="color:var(--accent)"></i>ZC ${zNom}${obs?' — <em>'+obs+'</em>':''}</td>
              <td></td>
              <td>${zZd}</td>
              <td>
                ${colBar(zTMaj, barColor(zTMaj))}
                <span style="font-size:.66rem;color:var(--muted)">enc.: ${zMajE}</span>
              </td>
              <td>
                ${colBar(zTDen, barColor(zTDen))}
                <span style="font-size:.66rem;color:var(--muted)">enc.: ${zDenE}</span>
              </td>
              <td colspan="3" style="color:var(--muted);font-size:.68rem">
                MAJ NE: ${Math.max(0,zZd-zMaj-zMajE)} · Dénom. NE: ${Math.max(0,zZd-zDen-zDenE)}
              </td>
            </tr>`;
          });

          // ── Lignes Département (détail pour SR) ──
          (r['grp_1a/rep_dept']||[]).forEach(dep => {
            const dNom = dep['grp_1a/rep_dept/dept_nom'] || 'Département';
            const dZd  = toInt(dep['grp_1a/rep_dept/dept_zd_assignees']);
            const dMaj = toInt(dep['grp_1a/rep_dept/dept_maj_achevees']);
            const dMajE= toInt(dep['grp_1a/rep_dept/dept_maj_encours']);
            const dDen = toInt(dep['grp_1a/rep_dept/dept_den_achevees']);
            const dDenE= toInt(dep['grp_1a/rep_dept/dept_den_encours']);
            const dTMaj= dZd>0?Math.round(dMaj/dZd*100):0;
            const dTDen= dZd>0?Math.round(dDen/dZd*100):0;
            const obs  = dep['grp_1a/rep_dept/dept_observations'] || '';
            html += `<tr class="terr-zc-row">
              <td colspan="2"><i class="fas fa-city me-1" style="color:var(--info)"></i>${dNom}${obs?' — <em>'+obs+'</em>':''}</td>
              <td></td>
              <td>${dZd}</td>
              <td>
                ${colBar(dTMaj, barColor(dTMaj))}
                <span style="font-size:.66rem;color:var(--muted)">enc.: ${dMajE}</span>
              </td>
              <td>
                ${colBar(dTDen, barColor(dTDen))}
                <span style="font-size:.66rem;color:var(--muted)">enc.: ${dDenE}</span>
              </td>
              <td colspan="3" style="color:var(--muted);font-size:.68rem">
                MAJ NE: ${Math.max(0,dZd-dMaj-dMajE)} · Dénom. NE: ${Math.max(0,dZd-dDen-dDenE)}
              </td>
            </tr>`;
          });
        });

        html += `</tbody></table></div></div>`; // fin arr
      });
      html += `</div>`; // fin dept
    });
    html += `</div>`; // fin region
  });

  body.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════════════
//  TAB 3 — AVANCEMENT ZD
// ═══════════════════════════════════════════════════════════════════════════
function renderAvancement() {
  // Barres MAJ par superviseur
  const rows = dedupedFiltered().map(r => {
    const nom    = r['grp_profil/nom_superviseur'] || '?';
    const profil = r['grp_profil/profil'] || '?';
    return { nom, profil,
      zdAsgn: getZdAsgn(r), majAch: getMajAch(r), majEnc: getMajEnc(r),
      denAch: getDenAch(r), denEnc: getDenEnc(r) };
  }).sort((a, b) => {
    const pa = a.zdAsgn > 0 ? a.majAch / a.zdAsgn : 0;
    const pb = b.zdAsgn > 0 ? b.majAch / b.zdAsgn : 0;
    return pb - pa;
  });

  const makeBar = (nom, profil, ach, enc, total, colorAch, colorEnc) => {
    const pAch = total > 0 ? Math.round(ach / total * 100) : 0;
    const pEnc = total > 0 ? Math.round(enc / total * 100) : 0;
    const clr  = pAch >= 80 ? '#16a34a' : pAch >= 50 ? '#0891b2' : pAch > 0 ? '#d97706' : '#dc2626';
    return `<div class="bar-item">
      <div class="bar-label">
        <span style="font-weight:600">${nom} <span style="color:#94a3b8;font-size:.68rem">(${profil})</span></span>
        <span style="color:${clr};font-weight:700">${ach}/${total} — ${pAch}%</span>
      </div>
      <div style="height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden;display:flex">
        <div style="width:${pAch}%;background:${colorAch};transition:width .4s"></div>
        <div style="width:${pEnc}%;background:${colorEnc};opacity:.5;transition:width .4s"></div>
      </div>
      <div style="font-size:.67rem;color:#94a3b8;margin-top:2px">En cours : ${enc}</div>
    </div>`;
  };

  byId('avancement-maj-body').innerHTML = rows.map(r =>
    makeBar(r.nom, r.profil, r.majAch, r.majEnc, r.zdAsgn, '#16a34a', '#a3e635')).join('') || '<p class="text-muted small">Aucune donnée</p>';

  byId('avancement-den-body').innerHTML = rows.map(r =>
    makeBar(r.nom, r.profil, r.denAch, r.denEnc, r.zdAsgn, '#7c3aed', '#c084fc')).join('') || '<p class="text-muted small">Aucune donnée</p>';

  // Tableau détaillé ZC/Département
  let detHtml = `<table class="sup-table">
    <thead><tr>
      <th>Superviseur</th><th>Profil</th><th>ZC / Dept</th>
      <th>ZD Asgn.</th><th>MAJ ach.</th><th>MAJ enc.</th><th>MAJ NE</th>
      <th>Dénom. ach.</th><th>Dénom. enc.</th><th>Dénom. NE</th><th>Observations</th>
    </tr></thead><tbody>`;

  dedupedFiltered().forEach(r => {
    const nom = r['grp_profil/nom_superviseur'] || '?';
    const profil = r['grp_profil/profil'] || '?';

    const zcs = (r['grp_1b/rep_zc'] || []);
    const depts = (r['grp_1a/rep_dept'] || []);

    if (zcs.length === 0 && depts.length === 0) {
      detHtml += `<tr><td colspan="11" class="text-muted small">${nom} — pas de détail ZC</td></tr>`;
      return;
    }

    zcs.forEach(zc => {
      const zdA = toInt(zc['grp_1b/rep_zc/zc_zd_assignees']);
      const mA  = toInt(zc['grp_1b/rep_zc/zc_maj_achevees']);
      const mE  = toInt(zc['grp_1b/rep_zc/zc_maj_encours']);
      const mNE = Math.max(0, zdA - mA - mE);
      const dA  = toInt(zc['grp_1b/rep_zc/zc_den_achevees']);
      const dE  = toInt(zc['grp_1b/rep_zc/zc_den_encours']);
      const dNE = Math.max(0, zdA - dA - dE);
      const obs = zc['grp_1b/rep_zc/zc_observations'] || '—';
      detHtml += `<tr>
        <td style="font-size:.72rem">${nom}</td>
        <td><span class="badge-alerte badge-warn">SD</span></td>
        <td style="font-weight:600">${zc['grp_1b/rep_zc/zc_nom'] || '?'}</td>
        <td>${zdA}</td>
        <td style="color:#16a34a;font-weight:700">${mA}</td><td>${mE}</td><td style="color:#dc2626">${mNE}</td>
        <td style="color:#7c3aed;font-weight:700">${dA}</td><td>${dE}</td><td style="color:#dc2626">${dNE}</td>
        <td style="font-size:.7rem;color:#64748b;max-width:180px">${obs}</td>
      </tr>`;
    });

    depts.forEach(dep => {
      const zdA = toInt(dep['grp_1a/rep_dept/dept_zd_assignees']);
      const mA  = toInt(dep['grp_1a/rep_dept/dept_maj_achevees']);
      const mE  = toInt(dep['grp_1a/rep_dept/dept_maj_encours']);
      const mNE = Math.max(0, zdA - mA - mE);
      const dA  = toInt(dep['grp_1a/rep_dept/dept_den_achevees']);
      const dE  = toInt(dep['grp_1a/rep_dept/dept_den_encours']);
      const dNE = Math.max(0, zdA - dA - dE);
      const obs = dep['grp_1a/rep_dept/dept_observations'] || '—';
      detHtml += `<tr>
        <td style="font-size:.72rem">${nom}</td>
        <td><span class="badge-alerte badge-ok">SR</span></td>
        <td style="font-weight:600">Département</td>
        <td>${zdA}</td>
        <td style="color:#16a34a;font-weight:700">${mA}</td><td>${mE}</td><td style="color:#dc2626">${mNE}</td>
        <td style="color:#7c3aed;font-weight:700">${dA}</td><td>${dE}</td><td style="color:#dc2626">${dNE}</td>
        <td style="font-size:.7rem;color:#64748b;max-width:180px">${obs}</td>
      </tr>`;
    });
  });
  detHtml += '</tbody></table>';
  byId('detail-zc-body').innerHTML = detHtml;
}

// ═══════════════════════════════════════════════════════════════════════════
//  TAB 3 — RESSOURCES HUMAINES
// ═══════════════════════════════════════════════════════════════════════════
function renderRH() {
  let prevus=0, op=0, abs=0, desist=0, reserv=0, payes=0, nonPa=0, zdSansCouv=0;
  let tp=0, trf=0, tpd=0, tsal=0;
  dedupedFiltered().forEach(r => {
    prevus     += toInt(r['grp_rh/rh_agents_prevus']);
    op         += toInt(r['grp_rh/rh_agents_operationnels']);
    abs        += toInt(r['grp_rh/rh_absents']);
    desist     += toInt(r['grp_rh/rh_desistements']);
    reserv     += toInt(r['grp_rh/rh_reservistes']);
    payes      += toInt(r['grp_rh/rh_payes_integral']);
    nonPa      += toInt(r['grp_rh/calc_non_integraux']);
    zdSansCouv += toInt(r['grp_rh/rh_zd_sans_couverture']);
    tp         += toInt(r['grp_rh/nb_agents_transport']);
    trf        += toInt(r['grp_rh/nb_agents_formation'] || 0);
    tpd        += toInt(r['grp_rh/nb_agents_perdiem']);
    tsal       += toInt(r['grp_rh/nb_agents_salaire']);
  });

  setText('rh-prevus', prevus.toLocaleString('fr-FR'));
  setText('rh-operationnels', op.toLocaleString('fr-FR'));
  setText('rh-op-sub', `${pct(op, prevus)}% opérationnels`);
  setText('rh-absents', abs.toLocaleString('fr-FR'));
  setText('rh-desistements', desist.toLocaleString('fr-FR'));
  setText('rh-reservistes-sub', `${reserv} réserviste${reserv!==1?'s':''} déployé${reserv!==1?'s':''}`);

  // Paiements
  const paymItems = [
    { label:'Agents payés intégralement', val:payes, color:'#16a34a' },
    { label:'Agents non intégralement payés', val:nonPa, color:'#dc2626' },
    { label:'Sans transport / carburant', val:tp, color:'#d97706' },
    { label:'Sans perdiem / subsistance', val:tpd, color:'#d97706' },
    { label:'Sans frais de formation', val:trf, color:'#7c3aed' },
    { label:'Sans salaire', val:tsal, color:'#dc2626' },
  ];
  byId('rh-paiements-body').innerHTML = paymItems.map(({ label, val, color }) => {
    const p2 = prevus > 0 ? Math.round(val / prevus * 100) : 0;
    return `<div class="bar-item">
      <div class="bar-label"><span>${label}</span><span style="color:${color};font-weight:700">${val} (${p2}%)</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${p2}%;background:${color}"></div></div>
    </div>`;
  }).join('');

  // Couverture
  byId('rh-couverture-body').innerHTML = `
    <div class="diff-row"><span>Agents opérationnels auj.</span><span class="diff-val ${op > 0 ? '' : 'danger'}">${op}</span></div>
    <div class="diff-row"><span>Agents absents auj.</span><span class="diff-val ${abs > 0 ? 'warn' : 'zero'}">${abs}</span></div>
    <div class="diff-row"><span>Désistements cumulés</span><span class="diff-val ${desist > 0 ? 'warn' : 'zero'}">${desist}</span></div>
    <div class="diff-row"><span>Réservistes déployés</span><span class="diff-val">${reserv}</span></div>
    <div class="diff-row"><span>ZD sans couverture ce jour</span><span class="diff-val ${zdSansCouv > 0 ? 'danger' : 'zero'}">${zdSansCouv}</span></div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  TAB 4 — DIFFICULTÉS
// ═══════════════════════════════════════════════════════════════════════════
function renderDifficultes() {
  let ticPanne=0, ticReseau=0, ticGPS=0, ticApp=0;
  let accTotal=0, accRefus=0, accAbs=0, accSec=0, accLang=0, accRum=0, accTerr=0, accLead=0;
  let matBot=0, matTorch=0, matChas=0, matCasq=0, matPolo=0, matSac=0;
  let incidents = 0;

  dedupedFiltered().forEach(r => {
    ticPanne  += toInt(r['grp_diff/tic_smartphones_panne']);
    ticReseau += toInt(r['grp_diff/tic_sans_reseau']);
    ticGPS    += toInt(r['grp_diff/tic_gps_defaillant']);
    ticApp    += toInt(r['grp_diff/tic_app_non_jour']);
    accTotal  += toInt(r['grp_diff/acces_agents_concernes']);
    accRefus  += toInt(r['grp_diff/nb_acces_refus']);
    accAbs    += toInt(r['grp_diff/nb_acces_absences']);
    accSec    += toInt(r['grp_diff/nb_acces_securite']);
    accLang   += toInt(r['grp_diff/nb_acces_langue']);
    accRum    += toInt(r['grp_diff/nb_acces_rumeurs']);
    accTerr   += toInt(r['grp_diff/nb_acces_terrain']);
    accLead   += toInt(r['grp_diff/nb_acces_leaders']);
    matBot    += toInt(r['grp_diff/nb_mat_bottes']);
    matTorch  += toInt(r['grp_diff/nb_mat_torches']);
    matChas   += toInt(r['grp_diff/nb_mat_chasubles']);
    matCasq   += toInt(r['grp_diff/nb_mat_casquettes']);
    matPolo   += toInt(r['grp_diff/nb_mat_polos']);
    matSac    += toInt(r['grp_diff/nb_mat_sacs']);
    if (r['grp_diff/incident_securite'] === 'oui') incidents++;
  });

  const diffRow = (label, val) => {
    const cls = val === 0 ? 'zero' : val < 5 ? 'warn' : 'danger';
    return `<div class="diff-row"><span>${label}</span><span class="diff-val ${cls}">${val}</span></div>`;
  };

  byId('diff-tic-body').innerHTML = `
    ${diffRow('Smartphones en panne', ticPanne)}
    ${diffRow('Appareils sans réseau', ticReseau)}
    ${diffRow('GPS défaillants', ticGPS)}
    ${diffRow('Applications non à jour', ticApp)}
    <hr class="my-2">
    ${diffRow('Incidents sécuritaires', incidents)}`;

  byId('diff-acces-body').innerHTML = `
    <div class="diff-row"><span><strong>Agents concernés (total)</strong></span><span class="diff-val ${accTotal>0?'warn':'zero'}">${accTotal}</span></div>
    ${diffRow('Refus des ménages', accRefus)}
    ${diffRow('Absences répétées des ménages', accAbs)}
    ${diffRow('Raisons sécuritaires', accSec)}
    ${diffRow('Barrière linguistique', accLang)}
    ${diffRow('Rumeurs / méfiance', accRum)}
    ${diffRow('Terrain difficile', accTerr)}
    ${diffRow('Leaders non coopératifs', accLead)}`;

  byId('diff-materiel-body').innerHTML = `
    ${diffRow('Sans bottes', matBot)}
    ${diffRow('Sans torches / lampes', matTorch)}
    ${diffRow('Sans chasubles', matChas)}
    ${diffRow('Sans casquettes', matCasq)}
    ${diffRow('Sans polos / tenues', matPolo)}
    ${diffRow('Sans sacs à dos', matSac)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  TAB 5 — DONNÉES BRUTES
// ═══════════════════════════════════════════════════════════════════════════
function renderRawTable() {
  const data = filtered();
  if (!data.length) {
    setText('data-count', '0 soumission');
    const table = byId('rawTable');
    if ($.fn.DataTable.isDataTable(table)) $(table).DataTable().destroy();
    table.innerHTML = '<tbody><tr><td class="text-muted small p-3">Aucune fiche pour ce profil.</td></tr></tbody>';
    return;
  }
  const cols = [
    'grp_date/date_fiche','grp_profil/profil','grp_profil/nom_superviseur',
    'grp_profil/region','grp_profil/departement','grp_profil/num_zs',
    'grp_1b/tot_zd_sd','grp_1b/tot_maj_sd','grp_1b/tot_den_sd',
    'grp_1b/tx_maj_sd','grp_1b/tx_den_sd',
    'grp_rh/rh_agents_prevus','grp_rh/rh_agents_operationnels','grp_rh/calc_non_integraux',
    'grp_appreciation/appreciation_globale','grp_recap/recap_alerte_globale'
  ];
  const labels = ['Date','Profil','Superviseur','Région','Département','ZS',
    'ZD Asgn.','MAJ Ach.','Dénom. Ach.','Tx MAJ%','Tx Dénom%',
    'Ag. Prévus','Ag. Op.','Non Payés','Appréciation','Alerte'];

  const profileLabel = activeProfile === 'SR' ? ' · SR uniquement' : activeProfile === 'SD' ? ' · SD uniquement' : '';
  setText('data-count', `${data.length} soumission${data.length>1?'s':''}${profileLabel}`);

  const table = byId('rawTable');
  if ($.fn.DataTable.isDataTable(table)) $(table).DataTable().destroy();
  table.innerHTML = '<thead><tr>' + labels.map(l => `<th>${l}</th>`).join('') + '</tr></thead><tbody>'
    + data.map(r => '<tr>' + cols.map(c => `<td>${r[c] ?? '—'}</td>`).join('') + '</tr>').join('')
    + '</tbody>';

  $(table).DataTable({
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/fr-FR.json' },
    pageLength: 25, responsive: true, dom: 'Bfrtip',
    order: [[0, 'desc']]
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  Navigation onglets
// ═══════════════════════════════════════════════════════════════════════════
function switchTab(name, el) {
  ['overview','territoire','avancement','rh','difficultes','data'].forEach(t => {
    const el2 = byId('tab-' + t);
    if (el2) el2.style.display = t === name ? '' : 'none';
  });
  document.querySelectorAll('.tab-bar .nav-link').forEach(a => a.classList.remove('active'));
  if (el) el.classList.add('active');
}

// ── UI Helpers ───────────────────────────────────────────────────────────
function splash(msg)      { const m = byId('splashMsg'); if (m) m.textContent = msg; }
function hideSplash()     { const s = byId('splashScreen'); if (s) { s.style.opacity='0'; s.style.transition='opacity .4s'; setTimeout(() => s.style.display='none', 400); } }
function splashError(msg) { splash('❌ ' + msg); const s = byId('splashScreen'); if (s) s.style.background='#7f1d1d'; }
function showBar(v)       { const b = byId('progressBar'); if (b) b.style.display = v ? '' : 'none'; }
function setStatus(s) {
  const dot = byId('statusDot');
  if (!dot) return;
  dot.className = 'status-dot ' + s;
}

// ── Thème sombre / clair ─────────────────────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem('sup-theme') || 'light';
  applyTheme(saved);
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('sup-theme', mode);
  const icon = byId('themeIcon');
  if (icon) {
    icon.className = mode === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
  // Rafraîchir DataTables si initialisé (thème change les couleurs de fond)
  const rt = byId('rawTable');
  if (rt && $.fn && $.fn.DataTable && $.fn.DataTable.isDataTable(rt)) {
    renderRawTable();
  }
}
