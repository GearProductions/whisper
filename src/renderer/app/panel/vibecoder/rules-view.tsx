/** rules-view — l'étape Invariants du créateur (note 0.16.0-ecran-essentiel) : les règles critiques de la note, une par
 *  ligne « → invariant » (ruleGroups, core/vibecoder). En titre, le texte de la ligne tel que l'utilisateur l'a écrit et
 *  son état (écrite : ses tests sont rouges ; prouvée ; non prouvée) ; dessous, le résultat de la preuve pour cette
 *  ligne (le mutant qui l'a prouvée, ou pourquoi elle remonte à l'utilisateur : il ne s'affiche qu'ici), puis les tests
 *  qui la gardent, en pseudo-code (leur titre, le pseudo-code coloré, pseudoLines ; leur point d'attention), chacun
 *  avec Ouvrir dans l'éditeur en icône discrète. Un test d'avant la branche qui garde déjà la ligne (l'alignement le
 *  nomme, il n'est pas au relevé) : son chemin et son titre, sans pseudo-code. Une ligne sans test : « aucun test ». Les tests qui ne gardent aucune
 *  ligne : un dernier groupe, « Autres tests ». Un test pas encore lu : son titre, « lecture en cours » (le moteur lance
 *  la lecture lui-même). Quel test garde quelle ligne : d'après l'alignement (la sortie liens.md, passée à ruleGroups),
 *  sinon la citation de sa lecture. 💬 sur une règle la cite dans le champ de la conversation (act.prefill('comment',
 *  la ligne)) ; 💬 sur un test cite son titre (c'est ainsi que l'utilisateur dit « à revoir » en montrant lequel).
 *  En tête, l'alignement (align.md) par FeedbackView : ses écarts [toi] en avant, les [agent] repliés avec leur nombre,
 *  rien quand tout est aligné.
 *  Aucun bouton d'action, aucune validation (ni cas par cas, ni Tout valider, ni Rien à écrire), aucun chiffre en tête,
 *  aucune barre, ni code ni éditeur ; sans ligne « → invariant » dans la note : une phrase, « La note ne demande aucun
 *  invariant ». L'en-tête d'étape (StepHead) est rendu par invariants-view.
 *  RulesView(p: StepProps): ReactNode ; Pseudo({ code }) : le pseudo-code coloré, et Attention({ text, lang, t,
 *  onOpenLink, children? }) : l'encart du point d'attention, repris par les cartes du relecteur
 *  Ne connaît pas : le pont (rappels passés), le relecteur (invariants-view garde sa vue), le brouillon de revue.
 *  Utilisé par : invariants-view (RulesView ; Pseudo, Attention). */
import { useMemo, type ReactNode } from 'react';
import { pseudoLines, ruleGroups, type RuleCase, type RuleState, type Strings } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';
import { FeedbackView } from './feedback-view';
import { Icon, IconButton } from './icons';
import { InlineMd } from './markdown-view';
import type { StepProps } from './step-views';
import './invariants-view.css';   // le pseudo-code (vc-pseudo, vc-tk-*) et l'encart d'attention, comme les cartes du relecteur
import './rules-view.css';

const fr = {
  state: { written: 'écrite', proved: 'prouvée', unproved: 'non prouvée' } as Record<RuleState, string>,
  noTest: 'aucun test',
  others: 'Autres tests',
  reading: 'lecture en cours',
  warning: 'Attention',
  warningHelp: 'Attention : le relecteur pense que ce test ne vérifie pas vraiment ce qu\'il annonce (mock, boucle, assertion faible…). Ce n\'est pas un échec : une piste pour votre relecture.',
  quote: 'Citer cette règle dans le champ',
  quoteTest: 'Citer ce test dans le champ',
  none: 'La note ne demande aucun invariant.',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    state: { written: 'written', proved: 'proved', unproved: 'unproved' },
    noTest: 'no test',
    others: 'Other tests',
    reading: 'reading in progress',
    warning: 'Warning',
    warningHelp: 'Warning: the reviewer thinks this test does not really check what it claims (mock, loop, weak assertion…). It is not a failure: a lead for your review.',
    quote: 'Quote this rule in the field',
    quoteTest: 'Quote this test in the field',
    none: 'The note asks for no invariant.',
  },
};

export function RulesView({ view, t, act }: StepProps): ReactNode {
  const s = S[view.lang];
  const liens = view.outputs['liens.md']?.text;
  const { rules, others } = useMemo(() => ruleGroups(view, liens), [view.note, view.invariants, view.proof, liens]);
  const align = view.outputs['align.md'];
  const quote = view.actions.some((a) => a.id === 'comment') ? (q: string) => act.prefill('comment', q) : undefined;
  const test = ({ file, index, view: c }: RuleCase) => {
    const r = c.reading;
    return (
      <article key={`${file.id}:${index}`} className="vc-rule-case">
        <div className="vc-rule-case-head">
          <h4>{c.title}</h4>
          {quote ? <IconButton icon="comment" label={s.quoteTest} onClick={() => quote(c.title)} /> : null}
          <IconButton icon="open" label={t.openTitle} onClick={() => act.open(file.id, file.lines[index])} />
        </div>
        {r ? <Pseudo code={r.pseudo} /> : <p className="vc-rule-reading">{s.reading}</p>}
        {r?.warning ? <Attention text={r.warning} lang={view.lang} t={t} onOpenLink={act.openLink} /> : null}
      </article>
    );
  };
  return (
    <div className="vc-rules">
      {align ? <FeedbackView md={align.text} t={t} onOpenLink={act.openLink} onQuote={quote} /> : null}
      {rules.length ? null : <p className="vc-rules-none">{s.none}</p>}
      {rules.map((r, i) => (
        <section key={i} className="vc-rule" data-state={r.state}>
          <div className="vc-rule-head">
            <h3 className="vc-rule-line">{r.line}</h3>
            <span className="vc-rule-state">{s.state[r.state]}</span>
            <IconButton icon="comment" label={s.quote} onClick={() => act.prefill('comment', r.line)} />
          </div>
          {r.detail ? <p className="vc-rule-proof">{r.detail}</p> : null}
          {r.elsewhere.map((e) => <p key={`${e.path}:${e.title}`} className="vc-rule-elsewhere vc-mono">{e.path} · {e.title}</p>)}
          {r.cases.length ? r.cases.map(test) : r.elsewhere.length ? null : <p className="vc-rule-notest">{s.noTest}</p>}
        </section>
      ))}
      {others.length ? (
        <section className="vc-rules-others">
          <h3>{s.others}</h3>
          {others.map(test)}
        </section>
      ) : null}
    </div>
  );
}

// Le point d'attention d'un test (r.warning) : l'encart, son aide en infobulle ; children, à droite (le relecteur y met sa
// citation) ; les cartes du relecteur (invariants-view) l'importent d'ici.
export function Attention({ text, lang, t, onOpenLink, children }: { text: string; lang: VibeLang; t: Strings; onOpenLink(url: string): void; children?: ReactNode }) {
  const s = S[lang];
  return (
    <div className="vc-attention" role="note" title={s.warningHelp}>
      <span className="vc-attention-icon"><Icon name="warn" /></span>
      <p><b>{s.warning}</b><InlineMd text={text} t={t} onOpenLink={onOpenLink} /></p>
      {children}
    </div>
  );
}

// Le pseudo-code, ligne à ligne, coloré (pseudoLines) : le rendu des cartes du relecteur aussi (invariants-view l'importe d'ici).
export function Pseudo({ code }: { code: string }) {
  const lines = useMemo(() => pseudoLines(code), [code]);
  return (
    <pre className="vc-pseudo scroll">
      <code>
        {lines.map((l, i) => (
          <span key={i} className="vc-pl" data-assert={l.assert || undefined}>
            {l.parts.map((p, j) => (p.kind === 'text' ? p.text : <span key={j} className={`vc-tk-${p.kind}`}>{p.text}</span>))}
          </span>
        ))}
      </code>
    </pre>
  );
}
