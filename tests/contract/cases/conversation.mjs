// Les cas de la conversation, servis par le faux claude : vibe, guide,
// new-request, propose-run — chacune ses refus principaux et, quand l'extérieur
// peut la provoquer, un succès, chacun avec le code de la table. Ce que la table
// appelle busy (la conversation travaille) est rendu disabled (le bouton grisé) ;
// la conversation est tenue par un tour « forme » du faux claude (4 s), dont le
// texte est passé en argument. vibe : jamais offerte à l'extérieur (la note n'est
// validée qu'à l'écran), donc pas de succès ; halted (après l'arrêt de Vibe par
// l'utilisateur, à l'écran) n'a pas de cas : le résumé le liste parmi les codes
// non couverts.
// Ne connaît pas : la page, l'état interne de l'appli.
// Utilisé par : tests/contract/run.mjs.
import { asJson, check, said, refused } from '../bench.mjs';
import { sleep } from '../../main-diff/launch.mjs';

const sent = (r) => r.code === 0 && r.json?.ok === true && !r.json.result?.queued;
const HOLD = '/vibecoder:forme';   // le faux claude retient un tour dont le texte le contient

// La conversation au repos : propose-run est proposée par next (sinon elle est grisée : un tour en cours).
async function idle(here) {
  for (let i = 0; i < 40; i++) {
    const next = await asJson(['next'], here);
    if (next.json?.result?.proposed?.some((a) => a.action === 'propose-run')) return true;
    await sleep(500);
  }
  return false;
}

// Le dépôt sur cette branche (switch-branch part en fond : status est relu jusqu'à ce qu'il la dise).
async function goTo(here, branch) {
  const at = async () => (await asJson(['status'], here)).json?.result?.branch;
  if (await at() === branch) return true;
  await asJson(['switch-branch', `branch=${branch}`], here);
  for (let i = 0; i < 20; i++) {
    if (await at() === branch) return true;
    await sleep(500);
  }
  return false;
}

/** @param {import('../bench.mjs').App} app */
export async function conversation(app) {
  const here = app.projet;

  // Sur la branche de la note : vibe n'est pas offerte (note non validée) ; new-request seulement sur la base.
  check('vibe', 'sur la branche de la note', await goTo(here, 'feat/0.9.0-essai'));
  const vibeArgs = await asJson(['vibe', 'bogus=1'], here);
  check('vibe', 'un argument inconnu : refusé, invalid-args', refused(vibeArgs, 'invalid-args'), said(vibeArgs), 'invalid-args');
  const vibe = await asJson(['vibe'], here);
  check('vibe', 'note non validée (à l\'écran seulement) : refusé, not-offered', refused(vibe, 'not-offered'), said(vibe), 'not-offered');
  const offBase = await asJson(['new-request', 'text=une demande'], here);
  check('new-request', 'hors de la base : refusé, not-offered', refused(offBase, 'not-offered'), said(offBase), 'not-offered');

  // Sur la base : les arguments, puis un succès.
  check('new-request', 'sur la base', await goTo(here, 'main'));
  check('new-request', 'conversation au repos', await idle(here));
  const noText = await asJson(['new-request'], here);
  check('new-request', 'sans texte : refusé, invalid-args', refused(noText, 'invalid-args'), said(noText), 'invalid-args');
  const empty = await asJson(['new-request', 'text='], here);
  check('new-request', 'texte vide : refusé, invalid-args', refused(empty, 'invalid-args'), said(empty), 'invalid-args');
  const long = await asJson(['new-request', `text=${'x'.repeat(20001)}`], here);
  check('new-request', 'texte de plus de 20 000 caractères : refusé, invalid-args', refused(long, 'invalid-args'), said(long), 'invalid-args');
  const unknown = await asJson(['new-request', 'text=une demande', 'bogus=1'], here);
  check('new-request', 'un argument inconnu : refusé, invalid-args', refused(unknown, 'invalid-args'), said(unknown), 'invalid-args');
  const request = await asJson(['new-request', 'text=une demande'], here);
  check('new-request', 'une demande part à l\'orchestrateur', sent(request), said(request));
  check('propose-run', 'conversation au repos', await idle(here));

  // propose-run : par la commande, l'envoi rend la main aussitôt (la proposition se lit à l'écran).
  const bogus = await asJson(['propose-run', 'bogus=1'], here);
  check('propose-run', 'un argument inconnu : refusé, invalid-args', refused(bogus, 'invalid-args'), said(bogus), 'invalid-args');
  const long2 = await asJson(['propose-run', `text=${'x'.repeat(20001)}`], here);
  check('propose-run', 'texte de plus de 20 000 caractères : refusé, invalid-args', refused(long2, 'invalid-args'), said(long2), 'invalid-args');
  const propose = await asJson(['propose-run', `text=${HOLD}`], here);
  check('propose-run', 'la demande part, la conversation travaille (tour retenu 4 s)', sent(propose), said(propose));
  await sleep(500);   // le tour a commencé : le relevé voit la conversation occupée

  // La conversation travaille : rien de plus ne part (la table : busy ; l'appli : l'action est grisée, disabled).
  const proposeBusy = await asJson(['propose-run'], here);
  check('propose-run', 'la conversation travaille : refusé, disabled', refused(proposeBusy, 'disabled'), said(proposeBusy), 'disabled');
  const requestBusy = await asJson(['new-request', 'text=une autre demande'], here);
  check('new-request', 'la conversation travaille : refusé, disabled', refused(requestBusy, 'disabled'), said(requestBusy), 'disabled');
  const actions = await asJson(['actions'], here);
  const hasGuide = !!actions.json?.result?.some((a) => a.action === 'guide');
  if (hasGuide) {
    const guideBusy = await asJson(['guide', 'text=où en suis-je ?'], here);
    check('guide', 'la conversation travaille : refusé, disabled', refused(guideBusy, 'disabled'), said(guideBusy), 'disabled');
  }
  check('guide', 'la conversation revient au repos', await idle(here));

  // guide : offerte seulement avec le skill gear-guide (celui de l'utilisateur, hors du profil du banc).
  const guideArgs = await asJson(['guide', 'bogus=1'], here);
  check('guide', 'un argument inconnu : refusé, invalid-args', refused(guideArgs, 'invalid-args'), said(guideArgs), 'invalid-args');
  const guide = await asJson(['guide', 'text=où en suis-je ?'], here);
  if (hasGuide) check('guide', 'la question part à l\'orchestrateur', sent(guide), said(guide));
  else check('guide', 'sans le skill gear-guide : refusé, not-offered', refused(guide, 'not-offered'), said(guide), 'not-offered');
  check('guide', 'conversation au repos à la fin', await idle(here));
}
