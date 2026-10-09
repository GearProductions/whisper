/** sent — le message que vous venez d'envoyer, montré dans le fil tant que la
 *  transcription de Claude Code ne le contient pas (elle ne l'écrit qu'une fois
 *  Claude Code lancé) ; ensuite, la transcription fait foi.
 *  Ne connaît pas : le SDK, Electron. Pur. Utilisé par : app/controllers/conversation. */
import type { OutgoingMessage, Thread } from 'core/agents';

// `since` : début du tour. Déjà écrit : un message « user » depuis, ou, sans
// heure dans la transcription, le même texte.
export function withSent(thread: Thread, sent: OutgoingMessage | null, since: number | null): Thread {
  if (!sent || !since) return thread;
  const text = sent.text || '';
  if (thread.some((e) => e.role === 'user' && (e.time === null ? e.text === text : e.time >= since))) return thread;
  const images = (sent.images || []).map((i) => ({ type: 'base64', media_type: i.mediaType, data: i.data }));
  return Object.assign([...thread, { role: 'user' as const, text, images, time: since }], { contextTokens: thread.contextTokens });
}
