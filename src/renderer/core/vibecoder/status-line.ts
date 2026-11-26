/** status-line — la ligne qui dit où en est le parcours du créateur (note 0.16.0-ecran-essentiel) : une seule phrase,
 *  dans la langue du relevé — ce que le système est en train de faire, ou ce qu'il attend de l'utilisateur.
 *  statusLine(view: VibeView): StatusLine | null
 *  Dans l'ordre, la première qui vaut : pas de note rédigée (« Demandez la note à l'agent, dans la conversation ») ;
 *  des questions ouvertes, à toute étape, le moteur en route ou pas (« 2 questions : répondez dans le questionnaire ») ;
 *  la note sans son ✓ (« Vérifiez, puis validez la note » ; déjà commitée, la pause 'note' : « La note a changé : elle
 *  attend sa validation ») ; des tests notés « À revoir » (la pause 'withdrawn:invariants', un cas 'ko' au relevé :
 *  « 1 test à revoir : dites à l'agent quoi corriger ») ; un ✓ d'étape retiré à la main qui tient (la pause
 *  'withdrawn:<étape>' : la ligne nomme l'étape) ; le moteur en route (« Le système écrit les modules » : d'après la course en cours, sinon l'étape en
 *  cours) ; une pause (« Regardez vos règles, puis reprenez » — revenue parce que des tests ont changé depuis leur
 *  validation : « Des tests ont changé : regardez vos règles, puis reprenez » —, « Essayez l'appli, puis reprenez ») ; la PR ouverte
 *  (« La PR est ouverte, la CI tourne », la CI en échec, « La PR est verte : à vous de la fusionner », fusionnée,
 *  fermée sans être fusionnée : « La PR est fermée » ; un état inconnu vaut ouverte, comme pr-view) ;
 *  sinon le moteur arrêté hors d'une pause (« Le système est arrêté : reprenez »).
 *  yours : la ligne attend l'utilisateur (une question, la note, une pause, un ✓ retiré, la PR verte, le moteur
 *  arrêté) ; false : le système travaille. Un relevé en erreur : null (aucune ligne).
 *  over : le parcours est fini, il n'y a rien à reprendre (la PR verte et chaque étape faite ; fusionnée ; fermée) :
 *  breadcrumb ne pose pas Reprendre à côté. Une étape pas faite (une correction en cours), la CI en cours ou en échec : pas over.
 *  La revue essentielle (note 0.16.0-revue-essentielle) : le relecteur a sa ligne lui aussi (plus null), d'après ce que
 *  le relevé sait déjà. Dans l'ordre, la première qui vaut : pas de PR chargée (« Choisissez la PR à relire, dans la vue
 *  des branches ») ; le dossier ailleurs que sur sa tête (« Passez sur la branche de la PR ») ; une lecture de la revue
 *  en cours (« Le système lit : la note, le code… », d'après view.runs, leurs libellés ; yours false) ; des lectures à
 *  lancer (view.prepare pas vide : « Préparez la revue ») ; la note pas jugée (« Lisez la note, puis jugez-la ») ; des
 *  tests sans verdict (leur nombre : « 3 tests à juger ») ; des cases du plan pas cochées, ou pas de plan (« Essayez
 *  l'appli : 2 cases à cocher ») ; la revue pas publiée (« Publiez la revue ») ; publiée : « La revue est publiée »,
 *  over. Chaque arrêt d'après son état au relevé (steps), jamais recalculé ici. Un relevé en erreur : null, comme avant.
 *  Le créateur : ses lignes, inchangées.
 *  Ne connaît pas : le DOM, React, le pont, le bouton du moteur ni « Préparer la revue » (breadcrumb les pose à côté).
 *  Utilisé par : app/panel/vibecoder (breadcrumb). */
import type { VibeStepId, VibeView } from 'technicals/bridge';
import { t } from './i18n';
import { progress } from './invariants';
import { parseCi } from './outputs';
import { runningRuns } from './screen';

export type StatusLine = { text: string; yours: boolean; over?: true };

// Le relecteur : chaque arrêt d'après son état au relevé (steps), jamais recalculé ici.
function reviewerLine(view: VibeView): StatusLine {
  const l = t(view.lang).essentialReview.statusLine;
  const yours = (text: string): StatusLine => ({ text, yours: true });
  if (!view.pr) return yours(l.choosePr);
  if (view.repo && view.repo.branch !== view.pr.head) return yours(l.switchBranch);
  const running = runningRuns(view.runs ?? []);
  if (running.length) return { text: l.reading(running.map((r) => r.label).join(', ')), yours: false };
  if (view.prepare?.length) return yours(l.prepare);
  const notDone = (id: VibeStepId) => view.steps.find((x) => x.id === id)?.status !== 'done';
  if (notDone('note')) return yours(l.judgeNote);
  if (notDone('invariants')) { const p = progress(view.invariants); return yours(l.toJudge(p.total - p.ok - p.ko)); }
  if (notDone('revue')) return yours(l.tryApp((view.screen ?? []).filter((c) => c.done !== true).length));
  if (notDone('pr')) return yours(l.publish);
  return { text: l.published, yours: false, over: true };
}

export function statusLine(view: VibeView): StatusLine | null {
  if (view.error) return null;
  if (view.flow === 'review') return reviewerLine(view);
  const s = t(view.lang);
  const l = s.statusLine;
  const yours = (text: string): StatusLine => ({ text, yours: true });
  const pause = view.pause ?? null;
  if (!view.note?.filled) return yours(l.noNote);
  if (view.questions.length) return yours(l.questions(view.questions.length));
  // l'étape Note d'après le relevé, pas la marque brute : une fois un module commencé, la note « changed » compte encore
  if (view.steps.find((x) => x.id === 'note')?.status !== 'done') return yours(pause === 'note' ? s.pause.note : l.verifyNote);
  // un test noté « À revoir » retient le parcours à la pause de l'étape Invariants : la ligne dit combien, et à qui le dire
  const ko = pause === 'withdrawn:invariants' ? progress(view.invariants).ko : 0;
  if (ko) return yours(l.toReview(ko));
  if (pause?.startsWith('withdrawn:')) return yours(s.pause[pause as keyof typeof s.pause]);
  if (view.vibe) {
    const run = runningRuns(view.runs ?? [])[0];
    const step = view.steps.find((x) => x.status === 'current');
    const progress = run?.progress ? s.runProgress(run.progress) : '';
    const what = run ? s.statusLine.run(`${run.label}${progress ? ` · ${progress}` : ''}`) : step ? l.step[step.id] : l.working;
    return { text: what, yours: false };
  }
  // la pause après les invariants revenue : des tests ont changé depuis que l'utilisateur les a laissés passer (leur ✓ « changed »)
  if (pause === 'invariants' && view.steps.find((x) => x.id === 'invariants')?.check?.state === 'changed') return yours(l.relook);
  if (pause === 'invariants' || pause === 'modules') return yours(l.pause[pause]);
  if (view.pr && (!view.pr.state || view.pr.state === 'OPEN')) {   // état inconnu : ouverte, comme pr-view
    const ci = parseCi(view.outputs['ci.md']?.text ?? '');
    if (ci?.state === 'ok') return view.steps.every((x) => x.status === 'done') ? { ...yours(l.green), over: true } : yours(l.green);
    return { text: ci?.state === 'ko' ? l.ciFailed : l.ciRunning, yours: false };
  }
  if (view.pr?.state === 'MERGED') return { text: l.merged, yours: false, over: true };
  if (view.pr?.state === 'CLOSED') return { text: l.closed, yours: false, over: true };
  return yours(l.stopped);
}
