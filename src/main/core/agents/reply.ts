/** reply — une réponse de l'agent : le texte (sans le bloc <audio>) pour le
 *  panneau, le résumé audio pour le lecteur ; sans bloc, le texte dépouillé de
 *  son formatage. Ce sur quoi porte un outil (sa commande, son fichier…).
 *  Pur. Utilisé par : core/agents, core/conversation. */

export function splitReply(reply: unknown) {
  const raw = String(reply || '').trim();
  const m = raw.match(/<audio>([\s\S]*?)<\/audio>/i);
  const text = raw.replace(/<audio>[\s\S]*?<\/audio>/gi, '').trim();
  const plain = (s: string) => s.replace(/```[\s\S]*?```/g, ' ').replace(/[`*_#>|]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ').trim();
  return { text: text || (m ? m[1].trim() : ''), audio: m ? plain(m[1]) : plain(text) };
}

// Ce sur quoi porte un outil : sa commande, son fichier, son adresse…
export const toolTarget = (input: unknown): unknown => {
  const i = (input || {}) as Record<string, unknown>;
  return i.command ?? i.file_path ?? i.notebook_path ?? i.path ?? i.url ?? i.query ?? i.pattern;
};

// La même chose en une ligne courte, pour le journal.
export const shortTarget = (input: unknown) => String(toolTarget(input) ?? '').split('\n')[0].slice(0, 160);
