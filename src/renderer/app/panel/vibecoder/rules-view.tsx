/** rules-view — l'étape Invariants du créateur (note 0.16.0-ecran-essentiel) : les règles critiques de la note, une par
 *  ligne « → invariant » (ruleGroups, core/vibecoder). En titre, le texte de la ligne tel que l'utilisateur l'a écrit et
 *  son état (écrite : ses tests sont rouges ; prouvée ; non prouvée) ; dessous, le résultat de la preuve pour cette
 *  ligne, mis en forme (MarkdownView) : le mutant qui l'a prouvée, replié, que le badge « prouvée » ouvre et replie (un
 *  bouton, seulement s'il y a un détail) ; pourquoi elle remonte à l'utilisateur, toujours visible (il ne s'affiche qu'ici), puis les tests
 *  qui la gardent, en pseudo-code (leur titre, le pseudo-code coloré, pseudoLines ; leur point d'attention), chacun
 *  avec Ouvrir dans l'éditeur en icône discrète. Un test d'avant la branche qui garde déjà la ligne (l'alignement le
 *  nomme, il n'est pas au relevé) : son chemin et son titre, sans pseudo-code. Une ligne sans test : « aucun test ». Les tests qui ne gardent aucune
 *  ligne : un dernier groupe, « Autres tests ». Un test pas encore lu : son titre, « lecture en cours » (le moteur lance
 *  la lecture lui-même). Quel test garde quelle ligne : d'après l'alignement (la sortie liens.md, passée à ruleGroups),
 *  sinon la citation de sa lecture. 💬 sur une règle la cite dans le champ de la conversation (act.prefill('comment',
 *  la ligne)) ; 💬 sur un test cite son titre ; l'un et l'autre seulement si l'action 💬 est au relevé. Chaque test a Validé / À revoir (CaseVerdict, act.mark de sa cible
 *  « case:<chemin>:<clé> ») : les notes de l'utilisateur sur ce qu'il a lu — Validé n'est jamais exigé, À revoir
 *  retient le moteur (journey) ; en tête, où il en est : « 10 tests · 6 validés · 1 à revoir · 3 à lire ».
 *  En tête, l'alignement (align.md) par FeedbackView : ses écarts [toi] en avant, les [agent] repliés avec leur nombre,
 *  rien quand tout est aligné.
 *  Aucun bouton d'action, ni Tout valider ni Rien à écrire, aucune barre, ni code ni éditeur ; sans ligne « → invariant » dans la note : une phrase, « La note ne demande aucun
 *  invariant ». L'en-tête d'étape (StepHead) est rendu par invariants-view.
 *  RulesView(p: StepProps): ReactNode ; Pseudo({ code }) : le pseudo-code coloré, Attention({ text, lang, t,
 *  onOpenLink, children? }) : l'encart du point d'attention (son infobulle dit ce que veut dire « Attention »).
 *  La revue essentielle (note 0.16.0-revue-essentielle) : le relecteur a la même vue (view.flow 'review'), à l'arrêt des
 *  règles — une règle par ligne « → invariant », ses tests en pseudo-code, « aucun test », « Autres tests », le compte
 *  en tête, l'alignement en tête (son align.md n'a pas d'étiquette : montré tel quel, rien n'y est replié), le point
 *  d'attention de chaque test. Ce qui change pour lui :
 *  - pas de preuve : aucun état sur une règle (ni « écrite », ni « prouvée », ni « non prouvée »), aucun détail au clic ;
 *  - un test d'avant la branche que la PR modifie (CaseView.fromBase) : dit sur ce test, « modifié par la PR » ;
 *  - Validé / À revoir sur chaque test (la même marque) ; À revoir propose « Ajouter une remarque au brouillon », qui
 *    ouvre la zone de remarque du test, sans rien ajouter ;
 *  - la 💬 d'une règle, d'un test, d'une ligne de l'alignement ouvre dessous une zone de remarque pour le brouillon de
 *    revue (CommentBox ; Ajouter : act.draft, remark, sur sa cible — « rule: <la ligne> », « case:<chemin>:<clé> »,
 *    « align: <la ligne> »), la zone s'ouvre là où l'on a cliqué (une seule à la fois) ; celle du point d'attention y verse l'attention (withAttention) sans rien effacer ; rien
 *    n'entre au brouillon sans Ajouter ; elle ne cite jamais dans la conversation ;
 *  - sous chaque règle et chaque test, ses remarques déjà au brouillon (remarksAt, DraftRemarks).
 *  Le créateur : sa vue, ses états de preuve, sa 💬 qui cite dans la conversation, inchangés.
 *  Ne connaît pas : le pont (rappels passés), le brouillon entier (ses remarques, par cible), le verdict de la revue.
 *  Utilisé par : invariants-view (RulesView). */
import { useMemo, useState, type ReactNode } from 'react';
import { excerpt, progress, pseudoLines, remark, remarksAt, ruleGroups, withAttention, type RuleCase, type RuleState, type Strings } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';
import { CommentBox } from './comment-box';
import { DraftRemarks } from './draft-remarks';
import { FeedbackView } from './feedback-view';
import { Icon, IconButton } from './icons';
import { InlineMd, MarkdownView } from './markdown-view';
import type { StepProps } from './step-views';
import { CaseVerdict } from './validation';
import './invariants-view.css';   // le pseudo-code (vc-pseudo, vc-tk-*) et l'encart d'attention, comme les cartes du relecteur
import './rules-view.css';

const fr = {
  state: { written: 'écrite', proved: 'prouvée', unproved: 'non prouvée' } as Record<RuleState, string>,
  noTest: 'aucun test',
  others: 'Autres tests',
  reading: 'lecture en cours',
  stale: 'lecture périmée',
  staleOff: 'Lecture périmée : le test a changé depuis, il attend sa relecture avant d\'être validé',
  warning: 'Attention',
  warningHelp: 'Attention : le relecteur pense que ce test ne vérifie pas vraiment ce qu\'il annonce (mock, boucle, assertion faible…). Ce n\'est pas un échec : une piste pour votre relecture.',
  quote: 'Citer cette règle dans le champ',
  quoteTest: 'Citer ce test dans le champ',
  remarkRule: 'Une remarque sur cette règle, au brouillon de revue',
  remarkTest: 'Une remarque sur ce test, au brouillon de revue',
  remarkAttention: 'Reprendre ce point d\'attention dans une remarque, au brouillon de revue',
  showProof: 'Voir la preuve : le mutant qui a fait échouer le test',
  hideProof: 'Replier la preuve',
  count: (total: number, ok: number, ko: number) => `${total} test${total > 1 ? 's' : ''} · ${ok} validé${ok > 1 ? 's' : ''} · ${ko} à revoir · ${total - ok - ko} à lire`,
  none: 'La note ne demande aucun invariant.',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    state: { written: 'written', proved: 'proved', unproved: 'unproved' },
    noTest: 'no test',
    others: 'Other tests',
    reading: 'reading in progress',
    stale: 'outdated reading',
    staleOff: 'Outdated reading: the test changed since, it awaits a new reading before it can be approved',
    warning: 'Warning',
    warningHelp: 'Warning: the reviewer thinks this test does not really check what it claims (mock, loop, weak assertion…). It is not a failure: a lead for your review.',
    quote: 'Quote this rule in the field',
    quoteTest: 'Quote this test in the field',
    remarkRule: 'A remark on this rule, to the review draft',
    remarkTest: 'A remark on this test, to the review draft',
    remarkAttention: 'Take this warning into a remark, to the review draft',
    showProof: 'Show the proof: the mutant that made the test fail',
    hideProof: 'Fold the proof',
    count: (total: number, ok: number, ko: number) => `${total} test${total > 1 ? 's' : ''} · ${ok} approved · ${ko} to review · ${total - ok - ko} to read`,
    none: 'The note asks for no invariant.',
  },
};

export function RulesView({ view, t, act }: StepProps): ReactNode {
  const s = S[view.lang];
  const liens = view.outputs['liens.md']?.text;
  const { rules, others } = useMemo(() => ruleGroups(view, liens), [view.note, view.invariants, view.proof, liens]);
  const align = view.outputs['align.md'];
  const seen = useMemo(() => progress(view.invariants), [view.invariants]);   // où l'utilisateur en est de sa lecture
  const quote = view.actions.some((a) => a.id === 'comment') ? (q: string) => act.prefill('comment', q) : undefined;
  // La preuve d'une règle prouvée : repliée, « prouvée » l'ouvre (par ligne) ; celle d'une règle non prouvée attend l'utilisateur : toujours là.
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const toggle = (line: string) => setShown((p) => { const n = new Set(p); if (!n.delete(line)) n.add(line); return n; });
  // Relecteur : une seule zone de remarque ouverte (at : où, le même test peut être sous deux règles ; target : la cible
  // du brouillon ; text : ce qu'elle contient, le point d'attention s'y ajoute). Rien n'entre au brouillon sans Ajouter.
  const rev = view.flow === 'review';
  const [box, setBox] = useState<{ at: string; target: string; text: string } | null>(null);
  const openBox = (at: string, target: string, add?: string) => setBox((b) => { const text = b?.at === at ? b.text : ''; return { at, target, text: add ? withAttention(text, add) : text }; });
  const toggleBox = (at: string, target: string) => (box?.at === at ? setBox(null) : openBox(at, target));
  const boxView = (at: string) => (rev && box?.at === at ? (
    <CommentBox t={t} value={box.text} onChange={(text) => setBox({ ...box, text })} onCancel={() => setBox(null)}
      onSave={(text) => { act.draft({ add: remark(box.target, text) }); setBox(null); }} />
  ) : null);
  const remarksView = (target: string) => {
    const here = rev ? remarksAt(view.draft, target) : [];
    return here.length ? <DraftRemarks remarks={here} t={t} onDraft={act.draft} onOpenLink={act.openLink} /> : null;
  };
  const test = ({ file, index, view: c }: RuleCase, where: string) => {
    const r = c.stale ? null : c.reading;   // périmée : ni son pseudo-code ni son point d'attention, ils parlent de l'ancien bloc
    const target = `case:${file.path}:${c.key ?? c.title}`, at = `${where}:${target}`;
    return (
      <article key={`${file.id}:${index}`} className="vc-rule-case">
        <div className="vc-rule-case-head">
          <h4>{c.title}</h4>
          {rev && c.fromBase ? <span className="vc-rule-changed"><Icon name="warn" />{t.essentialReview.changedByPr}</span> : null}
          <CaseVerdict state={c.mark} lang={view.lang} onMark={(v) => act.mark(target, v)} onRemark={rev ? () => openBox(at, target) : undefined} off={c.stale ? s.staleOff : undefined} />
          {rev ? <IconButton icon="comment" label={s.remarkTest} pressed={box?.at === at} onClick={() => toggleBox(at, target)} />
            : quote ? <IconButton icon="comment" label={s.quoteTest} onClick={() => quote(c.title)} /> : null}
          <IconButton icon="open" label={t.openTitle} onClick={() => act.open(file.id, file.lines[index])} />
        </div>
        {r ? <Pseudo code={r.pseudo} /> : <p className="vc-rule-reading">{c.stale ? s.stale : s.reading}</p>}
        {r?.warning ? (
          <Attention text={r.warning} lang={view.lang} t={t} onOpenLink={act.openLink}>
            {rev ? <span style={{ marginLeft: 'auto' }}><IconButton icon="comment" label={s.remarkAttention} onClick={() => openBox(at, target, r.warning ?? '')} /></span> : null}
          </Attention>
        ) : null}
        {remarksView(target)}
        {boxView(at)}
      </article>
    );
  };
  return (
    <div className="vc-rules">
      {align ? <FeedbackView md={align.text} t={t} onOpenLink={act.openLink} onQuote={rev ? (q) => openBox('align', `align: ${excerpt(q, 80)}`) : quote} /> : null}
      {boxView('align')}
      {seen.total ? <p className="vc-rules-count">{s.count(seen.total, seen.ok, seen.ko)}</p> : null}
      {rules.length ? null : <p className="vc-rules-none">{s.none}</p>}
      {rules.map((r, i) => (
        <section key={i} className="vc-rule" data-state={rev ? undefined : r.state}>
          <div className="vc-rule-head">
            <h3 className="vc-rule-line">{r.line}</h3>
            {rev ? null : r.state === 'proved' && r.detail ? (
              <button type="button" className="vc-rule-state" aria-expanded={shown.has(r.line)} title={shown.has(r.line) ? s.hideProof : s.showProof}
                onClick={() => toggle(r.line)}>{s.state[r.state]}</button>
            ) : <span className="vc-rule-state">{s.state[r.state]}</span>}
            {rev ? <IconButton icon="comment" label={s.remarkRule} pressed={box?.at === `r${i}`} onClick={() => toggleBox(`r${i}`, `rule: ${r.line}`)} />
              : quote ? <IconButton icon="comment" label={s.quote} onClick={() => quote(r.line)} /> : null}
          </div>
          {remarksView(`rule: ${r.line}`)}
          {boxView(`r${i}`)}
          {!rev && r.detail && (r.state !== 'proved' || shown.has(r.line)) ? (
            <div className="vc-rule-proof"><MarkdownView md={r.detail} t={t} onOpenLink={act.openLink} /></div>
          ) : null}
          {r.elsewhere.map((e) => <p key={`${e.path}:${e.title}`} className="vc-rule-elsewhere vc-mono">{e.path} · {e.title}</p>)}
          {r.cases.length ? r.cases.map((c) => test(c, `r${i}`)) : r.elsewhere.length ? null : <p className="vc-rule-notest">{s.noTest}</p>}
        </section>
      ))}
      {others.length ? (
        <section className="vc-rules-others">
          <h3>{s.others}</h3>
          {others.map((c) => test(c, 'o'))}
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
