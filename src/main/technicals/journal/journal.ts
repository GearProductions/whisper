/** journal — le journal des agents (agents.log) : une ligne par évènement, de
 *  quoi comprendre après coup un agent resté bloqué. Au-delà de JOURNAL_MAX,
 *  l'ancien passe en .old. Un journal impossible n'arrête jamais rien (I-29).
 *  Ne connaît pas : les agents. Utilisé par : app/controllers/agents. */
import fs from 'node:fs';

const JOURNAL_MAX = 1024 * 1024;

export type JournalEntry = (agent: { id: string; name?: string }, event: string, detail?: string) => void;

// `file` : relu à chaque ligne (null : pas de journal).
export function createJournal(file: () => string | null): JournalEntry {
  return (agent, event, detail = '') => {
    const f = file();
    if (!f) return;
    const line = `${new Date().toISOString()}  ${agent.name || agent.id}  ${event}${detail ? `  ${detail}` : ''}\n`;
    try {
      if (fs.existsSync(f) && fs.statSync(f).size > JOURNAL_MAX) fs.renameSync(f, `${f}.old`);
      fs.appendFileSync(f, line);
    } catch { /* journal impossible : on n'arrête pas l'agent pour ça */ }
  };
}
