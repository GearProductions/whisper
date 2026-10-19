/** questions — la réponse à une question ouverte de l'agent, telle qu'elle
 *  part avec « Envoyer les réponses » : une réponse proposée choisie,
 *  « Conseille-moi » ou « Je te laisse trancher », puis la précision libre.
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder (questions-view, vibe-coder). */
import type { VibeLang, VibeQuestion } from 'technicals/bridge';

// choice : le rang d'une réponse proposée, 'advise' (Conseille-moi), 'decide' (Je te laisse trancher), ou rien.
export type Answer = { choice: number | 'advise' | 'decide' | null; free: string };
// Les réponses en cours, par texte de question (une question réécrite à l'identique garde la sienne).
export type Answers = Record<string, Answer>;

const SAY: Record<VibeLang, Record<'advise' | 'decide', string>> = {
  fr: { advise: 'Conseille-moi : que recommandes-tu, et pourquoi ?', decide: 'Je te laisse trancher.' },
  en: { advise: 'Advise me: what do you recommend, and why?', decide: 'Your call.' },
};

// Le choix, puis la précision (« — »), sur une ligne ; '' sans rien (le
// principal écrit alors « (pas de réponse) »).
export function answerText(q: VibeQuestion, a: Answer | undefined, lang: VibeLang): string {
  if (!a) return '';
  const choice = typeof a.choice === 'number' ? q.options[a.choice] ?? '' : a.choice ? SAY[lang][a.choice] : '';
  return [choice, a.free].map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' — ');
}

// Une réponse par question, dans leur ordre (VibeArgs.answers).
export const answersOf = (questions: VibeQuestion[], answers: Answers, lang: VibeLang) =>
  questions.map((q) => answerText(q, Object.hasOwn(answers, q.text) ? answers[q.text] : undefined, lang));
