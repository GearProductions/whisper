/** review-view — l'étape Revue, pour les deux rôles.
 *  L'écran de l'essentiel (note 0.16.0-ecran-essentiel), en créateur : une seule carte. Avant la revue (ni checks.json ni
 *  ponytail.md) : une ligne, « la revue part après votre essai » au rythme par défaut, « la revue part après les modules »
 *  en express (view.express). Après : une ligne par vérification en échec (failedChecks : son nom, la première ligne de
 *  son détail, son étiquette en badge), rien quand tout passe (un avertissement n'est pas un échec) ; checks.json
 *  illisible : la carte le dit, avec le fichier tel quel ; la ponytail review par FeedbackView (ses remarques [toi] en
 *  avant, les [agent] repliées avec leur nombre). Rien à dire : pas de carte. Aucun bouton : ni Lancer les vérifications,
 *  ni Relancer, ni Appliquer, ni case à cocher, ni 💬 ; plus de liste « Avant la PR » (le relevé porte toujours
 *  view.checklist, on ne la montre plus), plus de cartes vides. Le plan de test, s'il y en a un : EcranSection
 *  (« Relire à l'écran »). Le relecteur : inchangé (Relire à l'écran seul).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { failedChecks, parseChecks, tagOf } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';
import { FeedbackView } from './feedback-view';
import { TagBadge } from './tag-badge';
import { StepHead } from './step-parts';
import { EcranSection } from './ecran-view';
import type { StepProps } from './step-views';
import './review-view.css';

const fr = {
  waitDefault: 'La revue part après votre essai.',
  waitExpress: 'La revue part après les modules.',
  unreadable: 'checks.json illisible : le voici tel quel.',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    waitDefault: 'The review starts after your try.',
    waitExpress: 'The review starts after the modules.',
    unreadable: 'checks.json is unreadable: here it is as is.',
  },
};

// La carte du créateur ; null quand il n'y a rien à lui dire.
function ReviewCard(p: StepProps) {
  const { view, t, act } = p;
  const s = S[view.lang];
  const checksOut = view.outputs['checks.json'];
  const ponytail = view.outputs['ponytail.md'];
  const checks = checksOut ? parseChecks(checksOut.text) : null;
  const failed = checks ? failedChecks(checks) : [];
  const feedback = ponytail ? FeedbackView({ md: ponytail.text, t, onOpenLink: act.openLink }) : null;   // appelée : null quand rien à dire
  const parts = [
    !checksOut && !ponytail ? <p key="wait" className="vc-revue-wait">{view.express ? s.waitExpress : s.waitDefault}</p> : null,
    checksOut && !checks ? <div key="bad"><div className="vc-checks-note">{s.unreadable}</div><pre className="vc-code">{checksOut.text}</pre></div> : null,
    failed.length ? (
      <ul key="failed" className="vc-check-list">
        {failed.map((c, i) => {
          const { tag, text } = tagOf(c.detail);
          return (
            <li key={i} data-state="ko" data-tag={tag ?? undefined}>
              <div className="vc-check-row">
                <span className="vc-mark" aria-hidden="true" /><span className="vc-check-name">{c.name}</span>
                {tag ? <TagBadge tag={tag} t={t} /> : null}
                {text ? <span className="vc-check-line">{text.split('\n')[0]}</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
    ) : null,
    feedback ? <div key="feedback">{feedback}</div> : null,
  ].filter(Boolean);
  return parts.length ? <section className="vc-card vc-revue"><div className="vc-card-body">{parts}</div></section> : null;
}

// La Revue des deux rôles ; le relecteur n'a que « Relire à l'écran » (ni vérification, ni ponytail).
export function ReviewView(p: StepProps) {
  return (
    <>
      <StepHead p={p} own={['checks', 'ponytail', 'apply', 'screen']} />
      {p.view.flow === 'create' ? <ReviewCard {...p} /> : null}
      <EcranSection {...p} />
    </>
  );
}
