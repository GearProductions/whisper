/** muter — couper du son pendant la dictée, puis le rétablir. Deux cibles :
 *  - 'discord' : le FLUX DE CAPTURE de Discord. En appel, dicter enverrait sa
 *    voix à tout le salon. Pas le micro du système (whisper enregistre sur le
 *    même), ni le bouton « muet » de Discord (un micro déjà coupé dans Discord
 *    le reste).
 *  - 'others' : les FLUX DE LECTURE des autres applications. Sur haut-parleurs,
 *    une vidéo ou un appel seraient captés par le micro et transcrits avec la
 *    dictée. Pas la sortie entière : les bips de l'appli restent audibles (ses
 *    propres flux sont écartés par leur processus).
 *  On ne rétablit que ce qu'on a coupé : un flux déjà muet avant la dictée le
 *  reste après (I-11, I-12). Opérations en file : un relâché rapide attend la
 *  coupure. Un outil en échec ne bloque rien (I-29).
 *  Ne connaît pas : PipeWire ni l'assistant Windows (outils passés).
 *  Utilisé par : app/controllers/dictation. */

export type MuteTarget = 'discord' | 'others';
export type StreamProps = Record<string, string | undefined>;

const DISCORD_RE = /discord/i;

// Ce qu'on coupe, par cible. `own` : les processus de l'appli.
export function isWanted(target: MuteTarget, p: StreamProps, own: Set<number>) {
  // Flux de capture AUDIO de Discord (il n'en a qu'en appel ; son partage
  // d'écran est un flux vidéo, écarté). Reconnu à son binaire (« Discord ») ou
  // à son identifiant Flatpak (com.discordapp.Discord) : son nom de flux,
  // « WEBRTC VoiceEngine », ne le désigne pas.
  if (target === 'discord') {
    return p['media.class'] === 'Stream/Input/Audio'
      && [p['application.process.binary'], p['pipewire.access.portal.app_id']].some((v) => DISCORD_RE.test(v || ''));
  }
  // Flux de lecture AUDIO de toutes les applications, sauf les nôtres.
  return p['media.class'] === 'Stream/Output/Audio' && !own.has(Number(p['application.process.id']));
}

// Couper et rétablir, pour une plateforme : résout le nombre de flux dont la
// coupure est confirmée.
export type MutePlatform = {
  mute(target: MuteTarget, own: Set<number>): Promise<number>;
  restore(target: MuteTarget): Promise<unknown>;
};

// Des flux qu'on coupe un par un (PipeWire) : `list` rend ceux de la cible,
// `isMuted` null si le flux est illisible, `setMute` false si refusé.
export type StreamTools = {
  list(target: MuteTarget, own: Set<number>): Promise<string[]>;
  isMuted(id: string): Promise<boolean | null>;
  setMute(id: string, on: boolean): Promise<boolean>;
};

export function createStreamMuter(tools: StreamTools): MutePlatform {
  const muted: Record<MuteTarget, string[]> = { discord: [], others: [] }; // flux que NOUS avons coupés
  return {
    // Résout le nombre de flux dont la coupure est CONFIRMÉE (relue après coup).
    async mute(target, own) {
      let ids: string[];
      try { ids = await tools.list(target, own); } catch { return 0; }
      let confirmed = 0;
      for (const id of ids) {
        const before = await tools.isMuted(id);
        if (before === null || before) continue; // déjà muet : on n'y touche pas
        if (!(await tools.setMute(id, true))) continue;
        muted[target].push(id);
        if (await tools.isMuted(id)) confirmed++;
      }
      return confirmed;
    },
    async restore(target) {
      const ids = muted[target];
      muted[target] = [];
      // Un flux disparu entre-temps (appel quitté, vidéo fermée) fait échouer
      // l'outil : sans importance.
      for (const id of ids) await tools.setMute(id, false).catch(() => false);
    },
  };
}

// `platform` null : système non pris en charge, rien n'est coupé.
export function createMuter(platform: MutePlatform | null) {
  let queue: Promise<unknown> = Promise.resolve(); // dans l'ordre
  const run = <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    const next = queue.then(fn, fn).catch(() => fallback);
    queue = next;
    return next;
  };
  return {
    // `ownPids` : les processus de l'appli, à ne pas couper.
    mute(target: MuteTarget, ownPids: number[]): Promise<number> {
      return platform ? run(() => platform.mute(target, new Set(ownPids)), 0) : Promise.resolve(0);
    },
    restore(target: MuteTarget): Promise<void> {
      return platform ? run(() => platform.restore(target).then(() => undefined), undefined) : Promise.resolve();
    },
  };
}
