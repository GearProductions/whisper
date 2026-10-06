/** sessions — les conversations d'un dossier, relues dans les transcriptions
 *  de Claude Code : le fil d'une session, son intitulé, les sessions du
 *  dossier (de l'appli comme d'un terminal ; pas des worktrees, qu'on ne
 *  pourrait pas reprendre d'ici). Seules les sessions de CE dossier (I-22).
 *  Ne connaît pas : Electron ; SDK et realpath injectés.
 *  Utilisé par : app/controllers/agents, app/controllers/conversation. */
import { oneLine } from 'helpers';
import { splitReply } from './reply';
import type { AgentConfig, Sdk, SdkMessage } from './types';

export type ThreadEntry =
  | { role: 'user'; text: string; images: SdkMessage[]; time: number | null }
  | { role: 'assistant'; text: string; audio?: string; tools: { tool: string; input: unknown }[]; time?: number | null }
  | { role: 'system'; kind: 'compact' | 'output'; text: string; time: number | null };
export type Thread = ThreadEntry[] & { contextTokens?: number | null };

// Les chemins sous lesquels Claude Code a pu ranger les sessions du dossier.
// Il prend le chemin réel du dossier où il est lancé ; sous Fedora Atomic,
// /home est un lien vers /var/home sur l'hôte, mais un dossier monté dans une
// distrobox : selon l'endroit où tournent l'appli et Claude Code, le même
// dossier s'écrit de deux façons.
export function sessionDirs(dir: string, realpath: (p: string) => string) {
  const out = [dir];
  try { out.push(realpath(dir)); } catch { /* dossier disparu */ }
  for (const d of [...out]) {
    if (d.startsWith('/home/')) out.push(`/var${d}`);
    if (d.startsWith('/var/home/')) out.push(d.slice(4));
  }
  return [...new Set(out)];
}

// Heure d'un message de la transcription (champ non documenté du SDK : null s'il manque).
const timeOf = (m: SdkMessage) => { const t = Date.parse(m.timestamp); return Number.isFinite(t) ? t : null; };

// Toute une session, relue dans sa transcription. Une commande tapée
// (« /compact ») s'affiche telle quelle ; sa sortie et le résumé laissé par une
// compaction, comme des messages « système ». `contextTokens` : le contexte
// occupé lors de la dernière réponse, null s'il n'y en a pas. Les messages
// successifs d'un même tour de l'agent (texte, outil, texte…) sont regroupés ;
// les échanges internes (résultats d'outils, sous-agents) sont écartés.
export function parseThread(messages: SdkMessage[]): Thread {
  const out: ThreadEntry[] = [];
  let contextTokens: number | null = null;
  for (const m of messages) {
    // Les messages « méta » (consignes internes) sont écartés — sauf le résumé
    // laissé par une compaction, qui en est un.
    if (m.parent_tool_use_id || ((m.is_meta || m.isMeta) && !m.isCompactSummary)) continue;
    const content = m.message && m.message.content;
    const blocks: SdkMessage[] = typeof content === 'string' ? [{ type: 'text', text: content }] : Array.isArray(content) ? content : [];
    if (m.type === 'user') {
      const images = blocks.filter((b) => b.type === 'image' && b.source && b.source.type === 'base64').map((b) => b.source);
      const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      const tag = (name: string) => { const x = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(text); return x ? x[1].trim() : null; };
      // Une compaction rend caduque la mesure de la dernière réponse.
      if (m.isCompactSummary || tag('command-name') === '/compact') contextTokens = null;
      if (m.isCompactSummary) out.push({ role: 'system', kind: 'compact', text, time: timeOf(m) });
      else if (tag('command-name') !== null) out.push({ role: 'user', text: `${tag('command-name')} ${tag('command-args') || ''}`.trim(), images: [], time: timeOf(m) });
      else if (tag('local-command-stdout') !== null || tag('local-command-stderr') !== null) {
        const output = [tag('local-command-stdout'), tag('local-command-stderr')].filter(Boolean).join('\n');
        if (output) out.push({ role: 'system', kind: 'output', text: output, time: timeOf(m) });
      } else if (text || images.length) out.push({ role: 'user', text, images, time: timeOf(m) });
    } else if (m.type === 'assistant') {
      const u = m.message && m.message.usage;
      if (u) contextTokens = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.output_tokens || 0);
      let last = out[out.length - 1];
      if (!last || last.role !== 'assistant') { last = { role: 'assistant', text: '', tools: [] }; out.push(last); }
      last.time = timeOf(m) || last.time;
      for (const b of blocks) {
        if (b.type === 'text' && b.text.trim()) last.text += `${last.text ? '\n\n' : ''}${b.text.trim()}`;
        if (b.type === 'tool_use') last.tools.push({ tool: b.name, input: b.input });
      }
    }
  }
  const result: Thread = out.map((e) => (e.role === 'assistant' ? { ...e, ...splitReply(e.text) } : e));
  result.contextTokens = contextTokens;
  return result;
}

export function createSessions({ loadSdk, realpath }: { loadSdk(): Promise<Sdk>; realpath(p: string): string }) {
  // Le premier résultat non vide de `fn(dossier)`, sous les chemins possibles.
  async function firstFound<T>(agent: AgentConfig, fn: (dir: string) => Promise<T>, empty: T): Promise<T> {
    for (const dir of sessionDirs(agent.dir, realpath)) {
      try {
        const res = await fn(dir);
        if (res && (!Array.isArray(res) || res.length)) return res;
      } catch { /* pas sous ce chemin */ }
    }
    return empty;
  }

  return {
    // Intitulé d'une session, comme dans Claude Code : titre donné ou généré, à
    // défaut le premier message. '' si introuvable.
    async sessionTitle(agent: AgentConfig, sessionId: string) {
      const sdk = await loadSdk();
      return oneLine((await firstFound(agent, async (dir) => sdk.getSessionInfo!(sessionId, { dir }), {} as SdkMessage | null) || {}).summary);
    },

    // Les sessions du dossier, de la plus récente à la plus ancienne.
    async sessions(agent: AgentConfig) {
      const sdk = await loadSdk();
      const seen = new Map<string, { sessionId: string; title: string; lastModified: number }>();
      for (const dir of sessionDirs(agent.dir, realpath)) {
        let list: SdkMessage[] = [];
        try { list = await sdk.listSessions!({ dir, includeWorktrees: false, limit: 200 }); } catch { /* pas sous ce chemin */ }
        for (const s of list) if (!seen.has(s.sessionId)) seen.set(s.sessionId, { sessionId: s.sessionId, title: oneLine(s.summary), lastModified: s.lastModified });
      }
      return [...seen.values()].sort((a, b) => b.lastModified - a.lastModified);
    },

    // Toute une session de l'agent (la sienne en cours par défaut). [] sans session.
    async thread(agent: AgentConfig, sessionId: string | null = agent.sessionId): Promise<Thread> {
      if (!sessionId) return [];
      const sdk = await loadSdk();
      return parseThread(await firstFound(agent, (dir) => sdk.getSessionMessages!(sessionId, { dir }), [] as SdkMessage[]));
    },
  };
}

export type Sessions = ReturnType<typeof createSessions>;
