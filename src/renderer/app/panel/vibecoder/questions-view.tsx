/** questions-view — les questions ouvertes de l'agent, au-dessus de la note
 *  (Créer) : une carte par question, numérotée, son badge d'importance à côté (q.level : important en
 *  couleur d'accent, secondaire en retrait ; sans niveau, aucun) ; ses réponses proposées en
 *  pastilles (une seule choisie, un second clic la retire ; écrite en trois parties, optionParts : le
 *  choix en tête, en gras, l'endroit en retrait, le texte cité dans sa couleur — sinon comme avant, en
 *  InlineMd, jamais en HTML), « Conseille-moi »,
 *  « Je te laisse trancher », et une précision libre (un PromptField : Joindre et le micro, sans
 *  Envoyer). « Envoyer les
 *  réponses » les envoie en une fois, une par question dans leur ordre (une
 *  sans réponse : le principal écrit « (pas de réponse) »). Les réponses en
 *  cours sont tenues par vibe-coder : elles survivent à un changement
 *  d'onglet, et le bouton de la prochaine étape envoie les mêmes. Les pièces jointes sont celles du
 *  questionnaire entier (StepPieces, tenues par l'appelant) : une seule liste, montrée dans le champ de
 *  chaque question (Joindre, coller ou déposer partout y ajoute) et envoyée avec « Envoyer les réponses ».
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : note-view. */
import { answersOf, optionParts, type Answer, type Answers, type Strings } from 'core/vibecoder';
import type { VibeLang, VibeQuestion, VibeView } from 'technicals/bridge';
import { InlineMd } from './markdown-view';
import type { VibeActs } from './step-views';
import { PromptField } from './prompt-field';
import { Run, type StepPieces } from './step-parts';
import './questions-view.css';

const fr = {
  title: (n: number) => (n > 1 ? `${n} questions ouvertes` : 'Une question ouverte'),
  help: 'Une réponse par question ; une précision s\'y ajoute.',
  advise: 'Conseille-moi',
  adviseTitle: 'L\'agent donne son conseil et garde la question',
  decide: 'Je te laisse trancher',
  decideTitle: 'L\'agent choisit, et dit ce qu\'il a choisi',
  free: 'Une autre réponse, ou une précision…',
  count: (n: number, of: number) => `${n} / ${of} ${n > 1 ? 'répondues' : 'répondue'}`,
  none: 'aucune réponse',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    title: (n) => (n > 1 ? `${n} open questions` : 'One open question'),
    help: 'One answer per question; a detail is added to it.',
    advise: 'Advise me',
    adviseTitle: 'The agent gives its advice and keeps the question',
    decide: 'Your call',
    decideTitle: 'The agent decides, and says what it chose',
    free: 'Another answer, or a detail…',
    count: (n, of) => `${n} / ${of} answered`,
    none: 'no answer',
  },
};

type Props = { view: VibeView; t: Strings; act: VibeActs; busy: boolean; answers: Answers; onAnswer(question: string, a: Answer): void } & StepPieces;

export function QuestionsView({ view, t, act, busy, answers, onAnswer, pieces, onRemove, onAttach, onFiles }: Props) {
  const s = S[view.lang];
  const texts = answersOf(view.questions, answers, view.lang);
  const given = texts.filter(Boolean).length;
  const send = view.actions.find((a) => a.id === 'answers');
  return (
    <section className="vc-questions" aria-label={s.title(view.questions.length)}>
      <div className="vc-q-head">
        <span className="vc-q-title">{s.title(view.questions.length)}</span>
        <span className="vc-q-help">{s.help}</span>
      </div>
      {view.questions.map((q) => (
        <Question key={q.text} q={q} a={Object.hasOwn(answers, q.text) ? answers[q.text] : undefined} s={s} t={t} act={act}
          pieces={{ pieces, onRemove, onAttach, onFiles }} onChange={(a) => onAnswer(q.text, a)} />
      ))}
      <div className="vc-q-send">
        <span className="vc-q-count" data-all={given === texts.length || undefined}>{s.count(given, texts.length)}</span>
        <Run a={send && (given ? send : { ...send, disabled: send.disabled || s.none })} busy={busy} tone="accent"
          onRun={() => act.run('answers', { answers: texts })} />
      </div>
    </section>
  );
}

type QuestionProps = { q: VibeQuestion; a: Answer | undefined; s: typeof fr; t: Strings; act: VibeActs; pieces: StepPieces; onChange(a: Answer): void };

function Question({ q, a, s, t, act, pieces, onChange }: QuestionProps) {
  const choice = a?.choice ?? null;
  const free = a?.free ?? '';
  const pick = (c: Answer['choice']) => onChange({ choice: c === choice ? null : c, free });
  return (
    <div className="vc-q" data-answered={choice !== null || !!free.trim() || undefined}>
      <div className="vc-q-text"><span className="vc-q-n">{q.n}</span>
        {q.level && <span className="vc-q-level" data-level={q.level}>{t.levels[q.level]}</span>}<span><InlineMd text={q.text} t={t} onOpenLink={act.openLink} /></span></div>
      <div className="vc-q-options" role="group" aria-label={q.text}>
        {q.options.map((o, i) => {
          const md = (text: string) => <InlineMd text={text} t={t} onOpenLink={act.openLink} />;
          const p = optionParts(o);
          return (
            <button key={i} type="button" className="vc-q-opt" aria-pressed={choice === i} onClick={() => pick(i)}>
              {p ? <><strong>{md(p.choice)}</strong> <span className="vc-q-where">{md(p.where)}</span> <span className="vc-q-quote">{md(p.quote)}</span></> : md(o)}
            </button>
          );
        })}
        <button type="button" className="vc-q-opt vc-q-alt" aria-pressed={choice === 'advise'} title={s.adviseTitle} onClick={() => pick('advise')}>
          {s.advise}
        </button>
        <button type="button" className="vc-q-opt vc-q-alt" aria-pressed={choice === 'decide'} title={s.decideTitle} onClick={() => pick('decide')}>
          {s.decide}
        </button>
      </div>
      <div className="vc-q-free">
        <PromptField t={t} text={free} setText={(v) => onChange({ choice, free: v.slice(0, 1500) })} placeholder={s.free} {...pieces} />
      </div>
    </div>
  );
}
