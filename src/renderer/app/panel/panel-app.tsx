/** panel-app — l'écran de l'appli : VibeCoder, pour l'agent affiché (son relevé,
 *  `conv:vibe`, sur sa conversation en cours), ou l'accueil (NoAgent) quand il
 *  n'y a aucun agent. La conversation de l'agent (`conv:thread`, envoyée par le
 *  principal à l'ouverture, à chaque changement et au fil d'un tour) est la
 *  colonne de droite de VibeCoder (affichée ou masquée, sa largeur : retenues
 *  ici, pour tous les agents) ; le volet des tâches de fond est son onglet
 *  Tâches. Tant que le relevé de l'agent affiché n'est pas là, rien n'est
 *  montré. Une action prend le texte que l'écran lui donne (le champ de son
 *  étape, une remarque) ; seul un message de la conversation (Demander sans
 *  modifier, Où j'en suis ?, Proposer les commandes) prend celui du champ de
 *  la conversation (vidé une fois parti), ou y prépare un message. La dictée
 *  (le micro du champ, maintenu ; createDictation) rend le texte de whisper à
 *  la zone de texte qui a le clavier (champ d'étape, commentaire, réponse
 *  libre ; pas un éditeur de code ni un champ d'une ligne), sous sa longueur,
 *  sinon au champ de la conversation ; sa phase (erreur, aucune parole) va à
 *  la ligne d'état du champ ; le micro de chaque champ d'agent de VibeCoder (contexte Mic ; une image jointe s'agrandit par le contexte Zoom,
 *  prompt-tools) est celui-là, et il donne le clavier à son champ. Écouter lit une réponse par son rang
 *  (createSpeechPlayer), le bip suit le réglage du son.
 *  La colle : seul fichier du panneau qui connaît le pont (window.conv) ; il
 *  tient le brouillon de chaque conversation et la saisie de VibeCoder de
 *  chaque agent (createKept). Voir le code : le fichier de module suivi
 *  (`conv:vibeCode`), suivre et enregistrer reliés au pont ; un autre fichier
 *  suivi, ou aucun, efface le texte du précédent (vibe-coder cesse de suivre
 *  quand l'agent ou l'étape change). Un dépôt de fichiers sur la page rejoint la
 *  conversation, sauf sous une zone qui le prend elle-même (`[data-own-drop]` :
 *  l'arborescence des artefacts entière, via vibeAct.drop(files, dossier), qui passe les File
 *  au pont et l'id du dossier d'arrivée, jamais un chemin) ; un glisser interne de
 *  l'arborescence (aucun File), lâché où que ce soit, ne joint rien.
 *  Le « @ » du champ : le Composer reçoit les artefacts du seul agent affiché
 *  (vibeShown : même clé que le relevé).
 *  Changement d'agent : l'écran garde la dernière paire fil + relevé cohérente
 *  jusqu'à l'arrivée des deux du nouvel agent (held) : jamais de page vide.
 *  Les agents (`agents:state`, onAgents) : l'agent affiché au sélecteur de VibeCoder, les raccourcis de
 *  core/switcher (Ctrl+K la palette, Ctrl+Tab l'agent d'avant, Ctrl+N un nouvel agent, Ctrl+Maj+B les
 *  branches), la palette et ses mouvements (afficher, lancer une action par son id, branches, ajouter),
 *  les robots des agents dans l'en-tête de VibeCoder (agent-notices : clic, l'afficher ; l'affiché, la
 *  palette ; clic droit, son menu) et le bip de la réponse (660 Hz, réglage Bip) quand un autre agent se met
 *  à attendre, finit ou échoue (beepFor, F-55 : seul ce qui vient d'apparaître, quitter un agent ne bipe pas),
 *  l'historique à la place du fil dans la colonne de VibeCoder (🕘), ⚙ Réglages : la page des réglages
 *  (SettingsPage, par-dessus l'écran) ouverte par conv.settings(null), les micros énumérés ici (listInputs) ;
 *  un réglage ou une commande (onSet, onRun) passe par conv.settings(op), qui rend la page relue, montrée à
 *  la place de l'affichée ; un micro choisi (onMic) par conv.setDevice.
 *  Les pièces jointes des champs de VibeCoder : leurs File passent par la même lecture que celle de la
 *  conversation (piecesOf) ; le trombone d'un champ (vibeAct.attach) retient ce champ, le choix du
 *  dialogue (onAttached) va à lui seul, sinon (le trombone de la conversation) au champ de la conversation.
 *  Ne connaît pas : le principal autrement que par le pont. Utilisé par : main.tsx. */
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  appendDictation, createDrafts, createPermissionGuard, EMPTY, followsEnd, IMAGE_TYPES, isBusy, revoke, titleOf, toDraft,
  withAttached, withPieces, type Draft, type Piece,
} from 'core/conversation';
import { createDictation, type Phase } from 'core/dictation';
import { beepFor, lastShown, recent, shortcut, type PaletteMove, type Scope } from 'core/switcher';
import { createSpeechPlayer } from 'core/speech';
import { createKept, t as vibeStrings, withPrefill } from 'core/vibecoder';
import type { AgentsState, Attached, Command, ConvApi, MicDevice, Notice, ProbeResult, SendResult, SettingsOp, SettingsView, Session, Thread, VibeArgs, VibeCode, VibeView } from 'technicals/bridge';
import { beep, listInputs, openMic, record } from 'technicals/audio';
import { dictationField, dictationText, imagePng } from 'technicals/dom';
import {
  ArchivedBar, Composer, ContextDetail, HistoryList, Lightbox, NoticeBar, showsWorking, TasksPane, ThreadContent,
  type ThreadActions,
} from './components';
import { AgentNotices, Mic, NoAgent, Zoom, Palette, SettingsPage, SkillsBar, VibeCoder, type Side, type VibeActs } from './vibecoder';

const REPLY_FREQ = 660; // le bip d'une réponse (F-55), celui de l'ancienne icône
const STATUS_MS = 10000; // un message de l'appli (téléchargement…) s'efface seul
const AT_END_PX = 40;

type Overlay = 'none' | 'context';

export function PanelApp({ conv }: { conv: ConvApi }) {
  const [data, setData] = useState<Thread | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [overlay, setOverlayState] = useState<Overlay>('none');
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [zoom, setZoomState] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [vibe, setVibe] = useState<VibeView | null>(null);
  const [vibeSide, setVibeSide] = useState<Side>({ open: true, width: 400 });
  const [vibeCode, setVibeCode] = useState<VibeCode | null>(null);
  const [agents, setAgents] = useState<AgentsState | null>(null);  // null jusqu'au premier conv:agents
  const heard = useRef(new Set<string>());                          // les signaux déjà entendus, de tous les agents (beepFor)
  const [palette, setPalette] = useState<Scope | null>(null);        // ouverte : sa portée
  const [branchesAsk, setBranchesAsk] = useState(0);                // +1 : VibeCoder ouvre ses branches
  const [historyOpen, setHistoryOpen] = useState(false);            // l'historique dans la colonne de VibeCoder
  const [settings, setSettings] = useState<{ view: SettingsView; mics: MicDevice[] } | null>(null); // la page des réglages, ouverte
  const attachTo = useRef<((what: Attached) => void) | null>(null);  // le champ qui a ouvert le trombone ; null : la conversation

  const [drafts] = useState(createDrafts);
  const [kept] = useState(createKept); // la saisie de VibeCoder, par agent
  const [guard] = useState(() => createPermissionGuard());
  const commands = useRef(new Map<string, Command[]>()).current;
  const current = useRef<Thread | null>(null);  // la conversation affichée, pour les écoutes
  const overlayRef = useRef<Overlay>('none');
  const recents = useRef<string[]>([]);         // les agents affichés, du dernier au plus ancien (Ctrl+Tab)
  const shownRef = useRef<string | null>(null);
  const toEnd = useRef(false);                  // descendre le fil après ce rendu
  const focusEnd = useRef(false);               // dictée reçue : focus, curseur à la fin
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const el = { thread: useRef<HTMLElement>(null), input: useRef<HTMLTextAreaElement>(null) };

  // La lecture à voix haute (Écouter) : seule une erreur se dit, dans la ligne d'état.
  const [player] = useState(() => createSpeechPlayer({
    api: conv, newContext: () => new AudioContext(), onChange: (p, message) => { if (p === 'error') setStatus(message || 'La lecture a échoué.'); },
  }));
  // La dictée (micro du champ, maintenu) : le texte de whisper, ajouté au champ pour être relu.
  const [micPhase, setMicPhase] = useState<Phase>('idle');
  const [dictation] = useState(() => createDictation({
    api: conv,
    openMic: (cfg) => openMic(cfg, (id, label) => conv.setDevice(id, label)),
    record,
    beep: (cfg, freq) => { if (cfg.sound !== false) beep(freq); },
    stopSpeaking: player.stop,
    setPhase: (p, message) => { setMicPhase(p); if (message || p === 'starting') setStatus(message ?? ''); },
    onText: (text) => {
      // Une autre zone de texte a le clavier (champ d'étape, commentaire, réponse libre) : la dictée
      // s'y insère à la place de la sélection, sous sa longueur (son onChange suit) ; plus de place : rien.
      const f = dictationField(document.activeElement, el.input.current);
      const s = f && dictationText(f, text);
      if (f && (!s || document.execCommand('insertText', false, s))) return;
      focusEnd.current = true;
      setDraft((d) => ({ ...d, text: appendDictation(d.text, text) }));
    },
  }));

  const zoomRef = useRef<string | null>(null);
  const setOverlay = (o: Overlay) => { overlayRef.current = o; setOverlayState(o); };
  const setZoom = (src: string | null) => { zoomRef.current = src; setZoomState(src); };
  const live = !!data && data.live;
  // VibeCoder : le relevé de l'agent affiché, que le fil montre sa conversation en cours ou une ancienne
  // (clé `<agent>:<session>`, ouverte par l'historique : l'écran reste) ; sinon, la vue habituelle.
  const vibeShown = vibe && data && (data.key === vibe.agentId || data.key.startsWith(`${vibe.agentId}:`)) ? vibe : null;
  // En changeant d'agent, le fil et le relevé du nouveau n'arrivent pas ensemble : d'ici là, l'écran
  // garde la dernière paire cohérente (pas de page vide entre les deux : en-tête et agents restent).
  const held = useRef<{ view: VibeView; thread: Thread } | null>(null);
  if (vibeShown && data) held.current = { view: vibeShown, thread: data };
  const screen = held.current;
  const archived = <ArchivedBar data={data} onCurrent={() => conv.current()} onResume={() => conv.resume()} />;

  // Des File en pièces jointes (pour la conversation comme pour chaque champ de VibeCoder) : une image
  // collée n'a pas de chemin et part en image ; un autre fichier sans chemin ne peut pas être joint.
  async function piecesOf(files: File[]): Promise<Piece[]> {
    setStatus('');
    const added: Piece[] = [];
    for (const file of files) {
      if (IMAGE_TYPES.includes(file.type)) {
        const { type, data } = await imagePng(file);   // redessinée par le navigateur : le principal la lira
        added.push({ kind: 'image', name: file.name || 'image collée', type, data, url: URL.createObjectURL(file) });
        continue;
      }
      const path = conv.pathFor(file);
      if (!path) setStatus(`${file.name || 'Fichier'} : impossible à joindre ici, déposez-le depuis le gestionnaire de fichiers.`);
      else added.push({ kind: 'file', name: file.name, path });
    }
    return added;
  }

  async function addFiles(files: File[]) {
    if (!current.current?.live) return; // ancienne conversation : rien à envoyer
    const added = await piecesOf(files);
    setDraft((d) => ({ ...d, pieces: withPieces(d.pieces, added) }));
  }

  // Les écoutes du pont : posées pendant le premier rendu (synchrone, cf.
  // main.tsx), avant de dire au principal que la page est prête.
  useLayoutEffect(() => {
    conv.onThread((d) => {
      const thread = el.thread.current;   // null tant que le relevé de l'agent n'est pas là
      const before = current.current;
      const atEnd = !!thread && thread.scrollHeight - thread.scrollTop - thread.clientHeight < AT_END_PX;
      const switched = d.key !== (before && before.key);
      if (switched) {
        const from = before && before.key;
        setDraft((cur) => drafts.switchTo(from, cur, d.key));
        setStatus('');
        setOverlay('none');
        setHistoryOpen(false);
      }
      guard.show(d.permission ? d.permission.key : null);
      toEnd.current = followsEnd(before, d, { atEnd, working: showsWorking(d) });
      current.current = d;
      setData(d);
    });
    conv.onNotice((n) => {
      clearTimeout(noticeTimer.current);
      setNotice(n);
      if (n && n.kind === 'status') noticeTimer.current = setTimeout(() => setNotice(null), STATUS_MS);
    });
    conv.onFocusInput(() => el.input.current?.focus());
    conv.onVibe(setVibe);
    conv.onVibeCode(setVibeCode);
    conv.onAgents((s) => {
      shownRef.current = s.shown;
      if (s.shown) recents.current = recent(recents.current, s.shown);
      recents.current = recents.current.filter((id) => s.agents.some((a) => a.id === id));
      setAgents(s);
      // Un autre agent vient d'attendre, de finir ou d'échouer (F-55) : le bip de la réponse, comme l'ancienne icône
      // (réglage Bip) ; seul ce qui vient d'apparaître bipe (beepFor : quitter un agent ne fait pas sonner son signal).
      const heardNow = beepFor(heard.current, s.agents, s.shown);
      if (heardNow.beep) conv.getConfig().then((cfg) => { if (cfg.sound !== false) beep(REPLY_FREQ); });
      heard.current = heardNow.heard;
    });
    conv.onAttached((what) => {
      const into = attachTo.current;
      attachTo.current = null;
      if (into) return into(what);
      setDraft((d) => ({ ...d, pieces: withAttached(d.pieces, what) }));
      el.input.current?.focus();
    });

    // Tout le panneau accepte le dépôt (le champ s'allume). Sans preventDefault,
    // un fichier lâché remplacerait la page ; du texte lâché dans le champ s'y insère.
    let depth = 0;
    const drag = (on: boolean) => setDragging(on && !!current.current?.live);
    document.addEventListener('dragenter', () => { depth += 1; drag(true); });
    document.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) drag(false); });
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
      depth = 0;
      drag(false);
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length || e.target !== el.input.current) e.preventDefault();
      // L'arborescence des artefacts prend son dépôt elle-même (act.drop) : ne pas le joindre aussi à la conversation.
      // Un glisser interne n'a aucun File : rien à joindre.
      const own = e.target instanceof Element && !!e.target.closest('[data-own-drop]');
      if (files.length && !own) addFiles(files);
    });
    document.addEventListener('keydown', (e) => {
      const short = shortcut({ key: e.key, ctrl: e.ctrlKey, shift: e.shiftKey });
      if (short) {
        e.preventDefault();
        if (short === 'palette') setPalette('all');
        else if (short === 'last') { const id = lastShown(recents.current, shownRef.current); if (id) conv.showAgent(id); }
        else if (short === 'new-agent') conv.addAgent();
        else setBranchesAsk((n) => n + 1);
        return;
      }
      if (e.key !== 'Escape') return;
      if (zoomRef.current) setZoom(null);
      else if (overlayRef.current !== 'none') setOverlay('none');
    });
    conv.ready();
  }, []);

  useLayoutEffect(() => {
    if (!data) return;
    document.title = `${titleOf(data)} — ${data.name}`;
    if (toEnd.current && el.thread.current) { el.thread.current.scrollTop = el.thread.current.scrollHeight; toEnd.current = false; }
  }, [data]);

  useLayoutEffect(() => {
    if (!focusEnd.current) return;
    focusEnd.current = false;
    const input = el.input.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [draft]);

  // VibeCoder monté : le fil, monté avec lui, repart du bas.
  const vibeOn = !!vibeShown;
  useLayoutEffect(() => { if (el.thread.current) el.thread.current.scrollTop = el.thread.current.scrollHeight; }, [vibeOn]);

  // 🕘 dans la colonne de VibeCoder : la liste des conversations du dossier à la place du fil.
  async function toggleHistory() {
    if (historyOpen) { setHistoryOpen(false); return; }
    setHistoryOpen(true);
    setSessions(null);
    setSessions(await conv.history());
  }

  // Un mouvement de la palette (elle est fermée ici) : jamais de texte libre, des ids d'action et leurs arguments.
  function paletteMove(m: PaletteMove) {
    setPalette(null);
    if ('show' in m) conv.showAgent(m.show);
    else if ('run' in m) vibeRun(m.run, m.args);
    else if ('open' in m) setBranchesAsk((n) => n + 1);
    else conv.addAgent();
  }

  async function showContext() {
    setOverlay('context');
    setProbe(null);
    const res = await conv.probe();
    if (overlayRef.current !== 'context') return;
    if (res.commands && current.current?.dir) commands.set(current.current.dir, res.commands);
    setProbe(res);
  }

  async function send() {
    const d = current.current;
    const text = draft.text.trim();
    if ((!text && !draft.pieces.length) || sending || !d || isBusy(d.status)) return;
    setSending(true);
    let res = null;
    try { res = await conv.send(toDraft(text, draft.pieces)); } catch { res = null; }
    setSending(false);
    if (res && res.ok) {
      revoke(draft.pieces);
      setDraft(EMPTY);
      drafts.drop(current.current && current.current.key);
      setStatus('');
      if (el.thread.current) el.thread.current.scrollTop = el.thread.current.scrollHeight;
    } else {
      setStatus((res && res.error) || 'L\'envoi a échoué.');
    }
  }

  // VibeCoder : une action du relevé. 'prefill' : préparée dans le champ ;
  // 'send' : envoyée, avec le texte que la vue donne (args.text : le champ de
  // l'étape, une remarque). Sans lui, un message de la conversation dont le
  // gabarit prend un texte emporte celui du champ de la conversation (exigé et
  // vide : on le demande ; envoyé : le champ se vide, ses pièces jointes
  // restent). true : partie.
  async function vibeRun(id: string, args: VibeArgs = {}): Promise<boolean> {
    const a = vibe?.actions.find((x) => x.id === id);
    if (!vibe || !a || sending) return false;
    if (a.kind === 'prefill') { vibePrefill(id, ''); return false; }
    const field = args.text === undefined && (a.needs === 'text' || a.usesText) ? draft.text.trim() : '';
    if (a.needs === 'text' && !field && !args.text?.trim()) {
      setStatus(vibeStrings(vibe.lang).needText);
      if (args.text === undefined) el.input.current?.focus();
      return false;
    }
    setStatus('');
    setSending(true);
    let res: SendResult | null = null;
    try { res = await conv.vibeRun(id, field ? { ...args, text: field } : args); } catch { res = null; }
    setSending(false);
    if (res && res.ok) {
      if (field) setDraft((d) => ({ ...d, text: '' }));
      if (el.thread.current) el.thread.current.scrollTop = el.thread.current.scrollHeight;
      return true;
    }
    setStatus((res && res.error) || vibeStrings(vibe.lang).sendFailed);
    return false;
  }

  // Une action 'prefill' : son texte, ce qu'on cite à la place de {{quote}},
  // ajouté au champ (withPrefill ; block : un bloc de code, en entier), à compléter puis envoyer.
  function vibePrefill(id: string, quote: string, block = false) {
    const a = vibe?.actions.find((x) => x.id === id && x.kind === 'prefill');
    if (!a) return;
    focusEnd.current = true;
    setStatus('');
    setDraft((d) => ({ ...d, text: withPrefill(d.text, a.text || '', quote, block) }));
  }

  // Voir le code : enregistrer le fichier suivi ; refusé, le motif comme une action qui n'est pas partie.
  async function vibeSave(id: string, text: string) {
    let res: SendResult | null = null;
    try { res = await conv.vibeSave(id, text); } catch { res = null; }
    if (!res?.ok) setStatus((res && res.error) || vibeStrings(vibe?.lang ?? 'fr').sendFailed);
    return !!res?.ok;
  }

  // Artefacts : des fichiers déposés dans l'arborescence, copiés dans le dossier visé (son id, sinon la racine) ;
  // refusé, le motif comme vibeSave.
  async function vibeDrop(files: File[], folder?: string) {
    let res: SendResult | null = null;
    try { res = await conv.vibeDrop(files, folder); } catch { res = null; }
    if (!res?.ok) setStatus((res && res.error) || vibeStrings(vibe?.lang ?? 'fr').sendFailed);
  }

  const vibeAct: VibeActs = {
    run: vibeRun, prefill: vibePrefill, set: conv.vibeSet, mark: conv.vibeMark, draft: conv.vibeDraft, open: conv.vibeOpen,
    follow: (id) => { setVibeCode(null); conv.vibeFollow(id); }, save: vibeSave, drop: vibeDrop,
    openLink: conv.openLink, refresh: conv.vibeRefresh, pieces: piecesOf,
    attach: (into) => { attachTo.current = into; conv.attach(); }, process: conv.vibeProcess, runOp: conv.vibeRunOp,
  };

  const act: ThreadActions = {
    openLink: conv.openLink,
    showFile: conv.showFile,
    listen: player.play,
    zoom: setZoom,
    answer: (decision, key) => guard.answer(key, decision, conv.answer),
  };

  // ⚙ Réglages : la page, relue ; un réglage ou une commande la remplace par la page rendue.
  const openSettings = async () => setSettings({ view: await conv.settings(null), mics: await listInputs() });
  const changeSettings = async (op: SettingsOp | null) => { const view = await conv.settings(op); setSettings((s) => s && { ...s, view }); };

  const toggleContext = () => { if (overlay === 'context') setOverlay('none'); else showContext(); };
  const toggleTasks = () => setTasksOpen((o) => !o);

  // Le message de l'appli, le fil (et ses volets), le champ : la colonne de la conversation de VibeCoder.
  const noticeBar = <NoticeBar notice={notice} onClose={() => setNotice(null)} />;
  const body = (
    <div id="body">
      <main id="thread" className="scroll" ref={el.thread}>
        {data ? <ThreadContent key={data.key} data={data} act={act} /> : null}
      </main>
      <ContextDetail open={overlay === 'context'} probe={probe}
        canCompact={live && !isBusy(data!.status)}
        onCompact={async () => {
          const sent = await conv.send({ text: '/compact', images: [], files: [], selection: '' });
          if (sent && sent.ok) setOverlay('none');
          return sent;
        }} />
    </div>
  );
  const composer = (
    <Composer draft={draft} live={live} name={data?.name || ''} busy={!!data && isBusy(data.status)} sending={sending}
      setText={(text) => setDraft((d) => ({ ...d, text }))}
      removePiece={(p) => { revoke([p]); setDraft((d) => ({ ...d, pieces: d.pieces.filter((x) => x !== p) })); }}
      artifacts={vibeShown?.artifacts} artifactsDir={vibeShown?.artifactsDir}
      status={status} setStatus={setStatus} dir={data?.dir || ''} commands={commands} probe={conv.probe}
      onSend={send} onAttach={() => { attachTo.current = null; conv.attach(); }} onFiles={addFiles} input={el.input} />
  );

  const noAgent = !!agents && !agents.agents.length;
  const tr = vibeStrings(vibe?.lang ?? 'fr');
  return (
    <div id="app"
      className={dragging ? 'dragging' : undefined} style={data ? { '--accent': data.color } as CSSProperties : undefined}>
      {noAgent ? <>{noticeBar}<NoAgent t={tr} onAdd={conv.addAgent} /></> : null}
      <div style={{ display: noAgent ? 'none' : 'contents' }}>
      {screen ? (
        <Mic.Provider value={{ phase: micPhase, down: dictation.start, up: dictation.stop }}>
        <Zoom.Provider value={setZoom}>
        <VibeCoder key={screen.view.agentId} view={screen.view} thread={screen.thread} act={vibeAct} tasksOpen={tasksOpen} code={vibeCode}
          tasks={<TasksPane tasks={screen.thread.tasks ?? []} onOpenLink={conv.openLink} onShowFile={conv.showFile} />}
          contextOpen={overlay === 'context'} onGauge={toggleContext} onTasks={toggleTasks}
          onSearch={() => setPalette('all')}
          onSettings={openSettings} branchesAsk={branchesAsk}
          others={agents ? <AgentNotices agents={agents.agents} shown={agents.shown} t={tr}
            onShow={conv.showAgent} onOpen={() => setPalette('agents')} onMenu={conv.agentMenu} onAdd={conv.addAgent} /> : undefined}
          historyOpen={historyOpen} onHistory={toggleHistory}
          history={<HistoryList open inline sessions={sessions} onOpen={(id) => { setHistoryOpen(false); conv.open(id); }} />}
          side={vibeSide} onSide={setVibeSide} kept={kept}>
          {noticeBar}
          {archived}
          {body}
          <SkillsBar view={screen.view} busy={isBusy(screen.thread.status)} onRun={vibeRun} />
          {composer}
        </VibeCoder>
        </Zoom.Provider>
        </Mic.Provider>
      ) : noticeBar /* avant le relevé : le message de l'appli seul */}
      </div>
      {settings ? <SettingsPage view={settings.view} mics={settings.mics} t={tr} onClose={() => setSettings(null)}
        onSet={(set, value) => changeSettings({ set, value })} onRun={(run) => changeSettings({ run })}
        onMic={async (id, label) => { conv.setDevice(id, label); await changeSettings(null); }} /> : null}
      {palette ? <Palette agents={agents?.agents ?? []} view={vibe} scope={palette} t={tr} onPick={paletteMove} onClose={() => setPalette(null)} /> : null}
      <Lightbox src={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
