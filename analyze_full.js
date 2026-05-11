const data = require('./data/submissions.json');
const results = data.results || data;
const isOui = v => v === 'oui' || v === '1' || v === 'yes' || v === true;
let s = {
  total_fiches: results.length,
  total_zd_visitees:0,total_zd_achevees:0,total_zd_assignees:0,
  total_zd_segmentees:0,total_zd_regroupees:0,total_zd_croquis:0,
  total_menages:0,total_menages_agric:0,
  total_agents_prevus:0,total_agents_presents:0,total_agents_absents:0,
  total_agents_malades:0,total_agents_desistements:0,total_agents_reservistes:0,
  total_non_payes:0,total_zd_entries:0,
  regions:new Set(),zcs:new Set(),controleurs:new Set(),
  apprec:{bonne:0,difficile:0,bloquee:0},
  diff_mapit:0,diff_gps:0,diff_reseau:0,diff_batterie:0,diff_electricite:0,
  diff_acces:0,diff_adhesion:0,diff_menages_absents:0,diff_refus:0,diff_langue:0,
  maj_achevee:0,donnees_synchro:0,croquis_valides:0,presence_ce:0,presence_ar:0,
};
results.forEach(d => {
  s.total_zd_visitees   += parseInt(d['totaux_zc/total_zd_visitees']  ||0);
  s.total_zd_achevees   += parseInt(d['totaux_zc/total_zd_achevees']  ||0);
  s.total_zd_assignees  += parseInt(d['totaux_zc/total_zd_assignees'] ||0);
  s.total_zd_segmentees += parseInt(d['totaux_zc/total_zd_segmentees']||0);
  s.total_zd_regroupees += parseInt(d['totaux_zc/total_zd_regroupees']||0);
  s.total_zd_croquis    += parseInt(d['totaux_zc/total_zd_croquis']   ||0);
  const reg=d['identification/region'],zc=d['identification/n_zc'],ctrl=d['identification/n_controleur']||d['identification/controleur'];
  if(reg)s.regions.add(reg);if(zc)s.zcs.add(zc);if(ctrl)s.controleurs.add(ctrl);
  const appr=d['bilan/appreciation_globale']||'';
  if(s.apprec[appr]!==undefined)s.apprec[appr]++;
  (d.suivi_zd||[]).forEach(zd => {
    s.total_zd_entries++;
    s.total_agents_prevus+=parseInt(zd['suivi_zd/agents/agents_prevus']||0);
    s.total_agents_presents+=parseInt(zd['suivi_zd/agents/agents_presents']||0);
    s.total_agents_absents+=parseInt(zd['suivi_zd/agents/agents_absents']||0);
    s.total_agents_malades+=parseInt(zd['suivi_zd/agents/agents_malades']||0);
    s.total_agents_desistements+=parseInt(zd['suivi_zd/agents/agents_desistements']||0);
    s.total_agents_reservistes+=parseInt(zd['suivi_zd/agents/agents_reservistes']||0);
    s.total_non_payes+=parseInt(zd['suivi_zd/difficultes/diff_4d/nb_agents_non_payes']||0);
    s.total_menages+=parseInt(zd['suivi_zd/menages/nb_menages']||0);
    s.total_menages_agric+=parseInt(zd['suivi_zd/menages/nb_menages_agric']||0);
    if(isOui(zd['suivi_zd/difficultes/diff_4a/diff_mapit']))s.diff_mapit++;
    if(isOui(zd['suivi_zd/difficultes/diff_4a/diff_gps']))s.diff_gps++;
    if(isOui(zd['suivi_zd/difficultes/diff_4a/diff_reseau']))s.diff_reseau++;
    if(isOui(zd['suivi_zd/difficultes/diff_4a/diff_batterie']))s.diff_batterie++;
    if(isOui(zd['suivi_zd/difficultes/diff_4a/diff_electricite']))s.diff_electricite++;
    if(isOui(zd['suivi_zd/difficultes/diff_4b/diff_acces_phys']))s.diff_acces++;
    if(isOui(zd['suivi_zd/difficultes/diff_4b/diff_adhesion']))s.diff_adhesion++;
    if(isOui(zd['suivi_zd/difficultes/diff_4b/diff_menages_absents']))s.diff_menages_absents++;
    if(isOui(zd['suivi_zd/difficultes/diff_4b/diff_refus']))s.diff_refus++;
    if(isOui(zd['suivi_zd/difficultes/diff_4b/diff_langue']))s.diff_langue++;
    if(isOui(zd['suivi_zd/etat_avancement/maj_achevee']))s.maj_achevee++;
    if(isOui(zd['suivi_zd/etat_avancement/donnees_synchro']))s.donnees_synchro++;
    if(isOui(zd['suivi_zd/etat_avancement/croquis_valides']))s.croquis_valides++;
    if(isOui(zd['suivi_zd/presence/presence_ce']))s.presence_ce++;
    if(isOui(zd['suivi_zd/presence/presence_ar']))s.presence_ar++;
  });
});
s.regions=s.regions.size;s.zcs=s.zcs.size;s.controleurs=s.controleurs.size;
const pctAch=s.total_zd_assignees>0?(s.total_zd_achevees/s.total_zd_assignees*100).toFixed(1):0;
const pctVis=s.total_zd_assignees>0?(s.total_zd_visitees/s.total_zd_assignees*100).toFixed(1):0;
const pctMaj=s.total_zd_entries>0?(s.maj_achevee/s.total_zd_entries*100).toFixed(0):0;
const pctSync=s.total_zd_entries>0?(s.donnees_synchro/s.total_zd_entries*100).toFixed(0):0;
const pctPres=s.total_agents_prevus>0?(s.total_agents_presents/s.total_agents_prevus*100).toFixed(0):0;
console.log("FICHES:",s.total_fiches,"| REGIONS:",s.regions,"| ZC:",s.zcs,"| CONTROLEURS:",s.controleurs);
console.log("ZD assignees:",s.total_zd_assignees,"| visitees:",s.total_zd_visitees,"("+pctVis+"%)","| acheveees:",s.total_zd_achevees,"("+pctAch+"%)");
console.log("MAJ acheveee:",s.maj_achevee,"/",s.total_zd_entries,"("+pctMaj+"%) | Synchro:",s.donnees_synchro,"("+pctSync+"%) | Croquis:",s.croquis_valides);
console.log("MENAGES:",s.total_menages.toLocaleString('fr-FR'),"| Agric:",s.total_menages_agric,"(",s.total_menages>0?(s.total_menages_agric/s.total_menages*100).toFixed(1):0,"%)");
console.log("AGENTS prevus:",s.total_agents_prevus,"| presents:",s.total_agents_presents,"("+pctPres+"%) | absents:",s.total_agents_absents,"| malades:",s.total_agents_malades);
console.log("Desistements:",s.total_agents_desistements,"| Reservistes:",s.total_agents_reservistes,"| Non payes:",s.total_non_payes);
console.log("Presence CE:",s.presence_ce,"/",s.total_zd_entries,"| Presence AR:",s.presence_ar,"/",s.total_zd_entries);
console.log("APPRECIATION — Bonne:",s.apprec.bonne,"| Difficile:",s.apprec.difficile,"| Bloquee:",s.apprec.bloquee);
console.log("DIFF TECH — MapIt:",s.diff_mapit,"| GPS:",s.diff_gps,"| Reseau:",s.diff_reseau,"| Batterie:",s.diff_batterie,"| Electricite:",s.diff_electricite);
console.log("DIFF TERRAIN — Acces:",s.diff_acces,"| Adhesion:",s.diff_adhesion,"| Menages absents:",s.diff_menages_absents,"| Refus:",s.diff_refus,"| Langue:",s.diff_langue);
