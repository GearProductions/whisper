/** reads — les lectures des commandes (status, next, actions, runs, procs, logs),
 *  chacune une fonction pure du relevé (VibeView) : les courses, les processus,
 *  les actions grisées ou masquées y sont déjà calculés, on les remet en forme
 *  pour le schéma de la commande (resources/vibecoder/commands.json). Jamais
 *  l'id du robot de l'agent (view.agentId).
 *  Ne connaît pas : Electron, le disque, les portes.
 *  Utilisé par : ses tests ; l'exécuteur (étape 2). */
import type { VibeFlow, VibeStepId, VibeView } from 'shared/bridge';
import { DIRECT_ACTIONS, DIRECT_ONLY, LOCKING, ownRun, readArgs, type ActionDef } from 'core/vibecoder';

export type Status = {
  branch: string | null; base: string | null; flow: VibeFlow; step: VibeStepId | null; note: string | null;
  pr: { number: number; title: string; url: string; state: 'OPEN' | 'CLOSED' | 'MERGED' | null } | null;
  vibe: boolean; running: { action: string; state: string; since: number }[];
};

export const statusOf = (view: VibeView): Status => ({
  branch: view.repo?.branch ?? null,
  base: view.repo?.base ?? null,
  flow: view.flow,
  step: view.steps.find((s) => s.status === 'current')?.id ?? null,
  note: view.note?.path ?? null,   // relatif au dossier : le relevé ne connaît pas son chemin absolu
  pr: view.pr && { number: view.pr.number, title: view.pr.title, url: view.pr.url, state: view.pr.state },
  vibe: !!view.vibe,
  running: (view.runs ?? []).filter((r) => LOCKING.includes(r.state)).map((r) => ({ action: r.id, state: r.state, since: r.since })),
});

/** proposed : ni masquées ni grisées ; disabled : les grisées qui ne sont pas masquées, avec leur raison. */
export const nextOf = (view: VibeView) => {
  const shown = view.actions.filter((a) => !a.hidden);
  return {
    proposed: shown.filter((a) => !a.disabled).map((a) => ({ action: a.id, primary: a.primary })),
    disabled: shown.flatMap((a) => (a.disabled ? [{ action: a.id, reason: a.disabled }] : [])),
  };
};

/** Les actions que le relevé montre (ses ids, filtrées par parcours et par skills), dans l'ordre du catalogue `defs`. */
export const actionsOf = (view: VibeView, defs: ActionDef[]) => {
  const known = new Set(view.actions.map((a) => a.id));
  return defs.filter((d) => known.has(d.id)).map((d) => ({
    action: d.id,
    step: d.step,
    run: ownRun(d),
    direct: DIRECT_ONLY.includes(d.id) ? 'only' as const : DIRECT_ACTIONS.includes(d.id) ? 'also' as const : null,
    args: readArgs(d) as string[],
  }));
};

/** Les plus anciennes d'abord (le relevé donne la plus récente d'abord). */
export const runsOf = (view: VibeView) => [...(view.runs ?? [])].reverse().map((r) => ({
  action: r.id, label: r.label, who: r.who, state: r.state, since: r.since, end: r.end, reply: r.reply, permission: r.permission,
}));

export const procsOf = (view: VibeView) => (view.processes ?? []).map((p) => ({
  name: p.name, run: p.run, status: p.status, since: p.since, exit: p.exit,
}));

/** La fin du journal, telle que le relevé la coupe (LOG_BYTES, côté appli) ; null : pas de processus de ce nom. */
export const logsOf = (view: VibeView, name: string) => {
  const p = view.processes?.find((q) => q.name === name);
  return p ? { name: p.name, log: p.log } : null;
};
