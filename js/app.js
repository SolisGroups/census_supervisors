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
let allData = [];

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
  renderAvancement();
  renderRH();
  renderDifficultes();
  renderRawTable();
}

// ═══════════════════════════════════════════════════════════════════════════
//  TAB 1 — VUE D'ENSEMBLE
// ═══════════════════════════════════════════════════════════════════════════
function renderOverview() {
  const d = allData;

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
    // Niveau SR (rep_dept)
    (r['grp_1a/rep_dept'] || []).forEach(dep => {
      totalZdAsgn  += toInt(dep['grp_1a/rep_dept/dept_zd_assignees']);
      totalMajAch  += toInt(dep['grp_1a/rep_dept/dept_maj_achevees']);
      totalMajEnc  += toInt(dep['grp_1a/rep_dept/dept_maj_encours']);
      totalDenAch  += toInt(dep['grp_1a/rep_dept/dept_den_achevees']);
      totalDenEnc  += toInt(dep['grp_1a/rep_dept/dept_den_encours']);
    });
    // Niveau SD (rep_zc)
    (r['grp_1b/rep_zc'] || []).forEach(zc => {
      totalZdAsgn  += toInt(zc['grp_1b/rep_zc/zc_zd_assignees']);
      totalMajAch  += toInt(zc['grp_1b/rep_zc/zc_maj_achevees']);
      totalMajEnc  += toInt(zc['grp_1b/rep_zc/zc_maj_encours']);
      totalDenAch  += toInt(zc['grp_1b/rep_zc/zc_den_achevees']);
      totalDenEnc  += toInt(zc['grp_1b/rep_zc/zc_den_encours']);
    });
    // Totaux calculés fiche (fallback si repeats vides)
    if (!(r['grp_1a/rep_dept'] || []).length && !(r['grp_1b/rep_zc'] || []).length) {
      totalZdAsgn += toInt(r['grp_1b/tot_zd_sd'] || r['grp_1a/tot_zd_sr']);
      totalMajAch += toInt(r['grp_1b/tot_maj_sd'] || r['grp_1a/tot_maj_sr']);
      totalDenAch += toInt(r['grp_1b/tot_den_sd'] || r['grp_1a/tot_den_sr']);
    }
  });

  const txMaj = pct(totalMajAch, totalZdAsgn);
  const txDen = pct(totalDenAch, totalZdAsgn);

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
  const apprecCount = { satisfaisant:0, acceptable:0, difficile:0, tres_difficile:0, bloquee:0 };
  d.forEach(r => {
    const a = r['grp_appreciation/appreciation_globale'];
    if (a && apprecCount[a] !== undefined) apprecCount[a]++;
  });

  // ─────── AFFICHAGE KPIs ───────
  setText('kpi-sup', superviseurs.size);
  setText('kpi-sup-sub', `${sr} SR · ${sd} SD · ${regions.size} région${regions.size > 1 ? 's' : ''}`);

  setText('kpi-zd-total', totalZdAsgn.toLocaleString('fr-FR'));
  setText('kpi-zd-total-sub', `MAJ : ${txMaj}% · Dénom. : ${txDen}%`);

  setText('kpi-maj-ach', totalMajAch.toLocaleString('fr-FR'));
  setText('kpi-maj-ach-sub', `${txMaj}% · en cours : ${totalMajEnc} · total assignées : ${totalZdAsgn}`);

  setText('kpi-den-ach', totalDenAch.toLocaleString('fr-FR'));
  setText('kpi-den-ach-sub', `${txDen}% · en cours : ${totalDenEnc} · total assignées : ${totalZdAsgn}`);

  setText('kpi-agents-op', totalAgOp.toLocaleString('fr-FR'));
  const txOp = pct(totalAgOp, totalAgPrevus);
  setText('kpi-agents-op-sub', `${txOp}% opérationnels · ${totalAgAbs} absent${totalAgAbs>1?'s':''} · ${totalDesist} désist.`);

  setText('kpi-non-payes', totalNonPaInteg.toLocaleString('fr-FR'));
  setText('kpi-non-payes-sub', `sur ${totalAgPrevus} agents prévus`);

  setText('kpi-tic', ticTotal.toLocaleString('fr-FR'));
  setText('kpi-tic-sub', `Smartphones: ${ticPanne} · Réseau: ${ticReseau} · GPS: ${ticGPS}`);

  setText('kpi-incidents', incidents);
  setText('kpi-incidents-sub', incidents > 0 ? 'Voir onglet Difficultés' : 'Aucun incident signalé');

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
        <span class="alert-item-title">${totalNonPaInteg.toLocaleString('fr-FR')} agents non intégralement payés</span>
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
        <span class="alert-item-title">${incidents} incident${incidents>1?'s':''} sécuritaire${incidents>1?'s':''} signalé${incidents>1?'s':''}</span>
      </div>
      <div class="alert-item-detail">${incDet}</div>
    </div>`;
  }

  if (totalZdSansCouv > 0) {
    alertHtml += `<div class="alert-item urgent">
      <div class="alert-item-header">
        <span class="alert-badge urgent">P1 URGENT</span>
        <span class="alert-item-title">${totalZdSansCouv} ZD sans couverture ce jour</span>
      </div>
      <div class="alert-item-detail">Assigner des agents ou réservistes immédiatement</div>
    </div>`;
  }

  const txMajNum = parseFloat(txMaj);
  if (txMajNum < 50 && totalZdAsgn > 0) {
    alertHtml += `<div class="alert-item urgent">
      <div class="alert-item-header">
        <span class="alert-badge urgent">P2 ÉLEVÉ</span>
        <span class="alert-item-title">Taux MAJ faible : ${txMaj}% (${totalMajAch}/${totalZdAsgn} ZD)</span>
      </div>
      <div class="alert-item-detail">Accélérer la mise à jour des cartouches</div>
    </div>`;
  }

  if (ticTotal > 0) {
    alertHtml += `<div class="alert-item info">
      <div class="alert-item-header">
        <span class="alert-badge info">P2 TIC</span>
        <span class="alert-item-title">${ticTotal} problèmes TIC signalés</span>
      </div>
      <div class="alert-item-detail">Smartphones en panne: ${ticPanne} · Sans réseau: ${ticReseau} · GPS: ${ticGPS} · Applis: ${ticApp}</div>
    </div>`;
  }

  if (totalDesist > 0) {
    alertHtml += `<div class="alert-item urgent">
      <div class="alert-item-header">
        <span class="alert-badge urgent">P2 RH</span>
        <span class="alert-item-title">${totalDesist} désistement${totalDesist>1?'s':''} définitif${totalDesist>1?'s':''} (cumul)</span>
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
    { key:'satisfaisant',   label:'Satisfaisante',    color:'#16a34a' },
    { key:'acceptable',     label:'Acceptable',       color:'#0891b2' },
    { key:'difficile',      label:'Difficile',        color:'#d97706' },
    { key:'tres_difficile', label:'Très difficile',   color:'#ea580c' },
    { key:'bloquee',        label:'Bloquée',          color:'#dc2626' },
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
  let tHtml = `<table class="sup-table">
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

    // ZD depuis calculs fiche
    let zdAsgn = toInt(r['grp_1b/tot_zd_sd'] || r['grp_1a/tot_zd_sr']);
    let majAch = toInt(r['grp_1b/tot_maj_sd'] || r['grp_1a/tot_maj_sr']);
    let denAch = toInt(r['grp_1b/tot_den_sd'] || r['grp_1a/tot_den_sr']);
    if (!zdAsgn) {
      (r['grp_1b/rep_zc'] || []).forEach(z => {
        zdAsgn += toInt(z['grp_1b/rep_zc/zc_zd_assignees']);
        majAch += toInt(z['grp_1b/rep_zc/zc_maj_achevees']);
        denAch += toInt(z['grp_1b/rep_zc/zc_den_achevees']);
      });
      (r['grp_1a/rep_dept'] || []).forEach(dep => {
        zdAsgn += toInt(dep['grp_1a/rep_dept/dept_zd_assignees']);
        majAch += toInt(dep['grp_1a/rep_dept/dept_maj_achevees']);
        denAch += toInt(dep['grp_1a/rep_dept/dept_den_achevees']);
      });
    }

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
    const apprColor = appr === 'satisfaisant' ? '#16a34a' : appr === 'acceptable' ? '#0891b2' :
                      appr === 'difficile' ? '#d97706' : appr.includes('difficult') ? '#ea580c' : '#dc2626';

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
//  TAB 2 — AVANCEMENT ZD
// ═══════════════════════════════════════════════════════════════════════════
function renderAvancement() {
  // Barres MAJ par superviseur
  const rows = allData.map(r => {
    const nom = r['grp_profil/nom_superviseur'] || '?';
    const profil = r['grp_profil/profil'] || '?';
    let zdAsgn = toInt(r['grp_1b/tot_zd_sd'] || r['grp_1a/tot_zd_sr']);
    let majAch = toInt(r['grp_1b/tot_maj_sd'] || r['grp_1a/tot_maj_sr']);
    let majEnc = 0, denAch = toInt(r['grp_1b/tot_den_sd'] || r['grp_1a/tot_den_sr']);
    let denEnc = 0;
    if (!zdAsgn) {
      (r['grp_1b/rep_zc']||[]).forEach(z => {
        zdAsgn += toInt(z['grp_1b/rep_zc/zc_zd_assignees']);
        majAch += toInt(z['grp_1b/rep_zc/zc_maj_achevees']);
        majEnc += toInt(z['grp_1b/rep_zc/zc_maj_encours']);
        denAch += toInt(z['grp_1b/rep_zc/zc_den_achevees']);
        denEnc += toInt(z['grp_1b/rep_zc/zc_den_encours']);
      });
      (r['grp_1a/rep_dept']||[]).forEach(dep => {
        zdAsgn += toInt(dep['grp_1a/rep_dept/dept_zd_assignees']);
        majAch += toInt(dep['grp_1a/rep_dept/dept_maj_achevees']);
        majEnc += toInt(dep['grp_1a/rep_dept/dept_maj_encours']);
        denAch += toInt(dep['grp_1a/rep_dept/dept_den_achevees']);
        denEnc += toInt(dep['grp_1a/rep_dept/dept_den_encours']);
      });
    }
    return { nom, profil, zdAsgn, majAch, majEnc, denAch, denEnc };
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

  allData.forEach(r => {
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
  allData.forEach(r => {
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

  allData.forEach(r => {
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
  if (!allData.length) return;
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

  setText('data-count', `${allData.length} soumission${allData.length>1?'s':''}`);

  const table = byId('rawTable');
  if ($.fn.DataTable.isDataTable(table)) $(table).DataTable().destroy();
  table.innerHTML = '<thead><tr>' + labels.map(l => `<th>${l}</th>`).join('') + '</tr></thead><tbody>'
    + allData.map(r => '<tr>' + cols.map(c => `<td>${r[c] ?? '—'}</td>`).join('') + '</tr>').join('')
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
  ['overview','avancement','rh','difficultes','data'].forEach(t => {
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
