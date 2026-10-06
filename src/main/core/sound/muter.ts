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
 *  WirePlumber retient la coupure d'une APPLICATION : un flux coupé qui
 *  disparaît avant d'être rétabli (vidéo finie, onglet fermé) laisserait ses
 *  flux suivants muets. Son identité reste donc « à rétablir », retenue même
 *  après un redémarrage, jusqu'à ce qu'un flux de cette application reparaisse
 *  et soit rétabli (heal). Le dépannage (force) rétablit tout ce qui est coupé
 *  dans la cible, à la demande de l'utilisateur.
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

// L'identité sous laquelle WirePlumber retient la coupure d'un flux : sa
// classe, puis la première propriété présente parmi celles qu'il consulte.
const KEY_PROPS = ['media.role', 'application.id', 'application.name', 'media.name', 'node.name'];
export function streamKey(p: StreamProps) {
  const prop = KEY_PROPS.find((k) => p[k]);
  return prop ? `${p['media.class']}:${prop}:${p[prop]}` : null;
}

// Couper et rétablir, pour une plateforme : `mute` résout le nombre de flux
// dont la coupure est confirmée, `restore` et `force` le nombre de flux rétablis.
export type MutePlatform = {
  mute(target: MuteTarget, own: Set<number>): Promise<number>;
  restore(target: MuteTarget): Promise<unknown>;
  heal?(): Promise<number>;
  force?(target: MuteTarget, own: Set<number>): Promise<number>;
  pending?(): number;
};

// Des flux qu'on coupe un par un (PipeWire) : `list` rend ceux de la cible,
// `isMuted` null si le flux est illisible, `setMute` false si refusé (flux
// disparu). `keyOf` : l'identité d'un flux ; `findByKey` : les flux vivants
// de cette identité.
export type StreamTools = {
  list(target: MuteTarget, own: Set<number>): Promise<string[]>;
  isMuted(id: string): Promise<boolean | null>;
  setMute(id: string, on: boolean): Promise<boolean>;
  keyOf?(id: string): Promise<string | null>;
  findByKey?(key: string): Promise<string[]>;
};

// Les identités à rétablir, gardées d'un lancement à l'autre.
export type PendingStore = { load(): string[]; save(keys: string[]): void };

export function createStreamMuter(tools: StreamTools, store?: PendingStore): MutePlatform {
  const muted: Record<MuteTarget, { id: string; key: string | null }[]> = { discord: [], others: [] }; // flux que NOUS avons coupés
  const pending = new Set<string>(store ? store.load() : []);
  const save = () => { if (store) store.save([...pending]); };
  const unmuteIfMuted = async (id: string) => ((await tools.isMuted(id).catch(() => null)) && (await tools.setMute(id, false).catch(() => false)) ? 1 : 0);

  // Les applications restées muettes dans la mémoire de WirePlumber : dès qu'un
  // de leurs flux est là, il est rétabli. Jamais pendant une dictée : ce
  // qu'elle vient de couper doit le rester.
  async function heal() {
    if (!pending.size || muted.discord.length || muted.others.length || !tools.findByKey) return 0;
    let n = 0;
    for (const key of [...pending]) {
      const ids = await tools.findByKey(key).catch(() => [] as string[]);
      if (!ids.length) continue; // pas encore revenue
      for (const id of ids) n += await unmuteIfMuted(id);
      pending.delete(key);
    }
    save();
    return n;
  }

  async function restore(target: MuteTarget) {
    const list = muted[target];
    muted[target] = [];
    let n = 0;
    for (const { id, key } of list) {
      if (await tools.setMute(id, false).catch(() => false)) n++;
      // Disparu entre-temps (appel quitté, vidéo fermée) : WirePlumber garde sa
      // coupure pour la prochaine fois.
      else if (key) pending.add(key);
    }
    save();
    return n + await heal();
  }

  return {
    // Résout le nombre de flux dont la coupure est CONFIRMÉE (relue après coup).
    async mute(target, own) {
      let ids: string[];
      try { ids = await tools.list(target, own); } catch { return 0; }
      let confirmed = 0;
      for (const id of ids) {
        const before = await tools.isMuted(id);
        if (before === null || before) continue; // déjà muet : on n'y touche pas
        const key = tools.keyOf ? await tools.keyOf(id).catch(() => null) : null;
        if (!(await tools.setMute(id, true))) continue;
        muted[target].push({ id, key });
        if (await tools.isMuted(id)) confirmed++;
      }
      return confirmed;
    },
    restore,
    heal,
    // Dépannage : ce qu'on a coupé, ce qui attend d'être rétabli, et tout flux
    // de la cible encore coupé (exception voulue à I-12, à la demande).
    async force(target, own) {
      let n = await restore(target);
      const ids = await tools.list(target, own).catch(() => [] as string[]);
      for (const id of ids) n += await unmuteIfMuted(id);
      return n;
    },
    pending: () => pending.size,
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
    // Les applications restées muettes (cf. plus haut) : à appeler de temps en temps.
    heal(): Promise<number> {
      return platform && platform.heal ? run(() => platform.heal!(), 0) : Promise.resolve(0);
    },
    // Dépannage : tout rétablir dans la cible. Résout le nombre de flux rétablis.
    force(target: MuteTarget, ownPids: number[]): Promise<number> {
      if (!platform) return Promise.resolve(0);
      const own = new Set(ownPids);
      return run(() => (platform.force ? platform.force(target, own) : platform.restore(target).then(() => 0)), 0);
    },
    pending: () => (platform && platform.pending ? platform.pending() : 0),
  };
}
