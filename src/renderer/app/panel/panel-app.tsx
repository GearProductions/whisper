/** panel-app — le panneau des conversations, attaché à l'icône : une
 *  conversation à la fois, celle du robot sélectionné (les robots servent
 *  d'onglets) ; aucun robot sélectionné : le contexte « Dictée », le dernier
 *  texte dicté et Copier. Le volet des tâches de fond, à droite du fil.
 *  Réduit : le dernier échange, à la hauteur de son contenu ; agrandi : tout
 *  le fil et l'historique. Le principal envoie la conversation (`conv:thread`)
 *  à l'ouverture, à chaque changement et au fil d'un tour. Un agent en
 *  VibeCoder (son relevé, `conv:vibe`, sur sa conversation en cours) :
 *  l'écran VibeCoder à la place de l'en-tête et du corps, la même
 *  conversation dans sa colonne de droite (affichée ou masquée, sa largeur :
 *  retenues ici, pour tous les agents) ; une action y prend le texte du champ
 *  s'il lui en faut un (vidé une fois parti), ou y prépare un message.
 *  La colle : seul fichier du panneau qui connaît le pont (window.conv) ; il
 *  tient le brouillon de chaque conversation.
 *  Ne connaît pas : l'icône, la bulle. Utilisé par : main.tsx. */
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  appendDictation, createDrafts, createPermissionGuard, EMPTY, followsEnd, IMAGE_TYPES, isBusy, revoke, titleOf, toDraft,
  withAttached, withFile, type Draft, type Piece,
} from 'core/conversation';
import { t as vibeStrings, withPrefill } from 'core/vibecoder';
import type { Command, ConvApi, Notice, ProbeResult, SendResult, Session, Thread, VibeArgs, VibeView } from 'technicals/bridge';
import { compactHeight } from 'technicals/dom';
import {
  ArchivedBar, Composer, ContextDetail, Header, HistoryList, Lightbox, NoticeBar, showsWorking, TasksPane, ThreadContent,
  type ThreadActions,
} from './components';
import { SkillsBar, VibeCoder, type Side, type VibeActs } from './vibecoder';

const STATUS_MS = 10000; // un message de l'appli (téléchargement…) s'efface seul
const AT_END_PX = 40;

type Overlay = 'none' | 'history' | 'context';

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

  const [drafts] = useState(createDrafts);
  const [guard] = useState(() => createPermissionGuard());
  const commands = useRef(new Map<string, Command[]>()).current;
  const current = useRef<Thread | null>(null);  // la conversation affichée, pour les écoutes
  const overlayRef = useRef<Overlay>('none');
  const toEnd = useRef(false);                  // descendre le fil après ce rendu
  const focusEnd = useRef(false);               // dictée reçue : focus, curseur à la fin
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const el = {
    header: useRef<HTMLElement>(null), notice: useRef<HTMLDivElement>(null), archived: useRef<HTMLDivElement>(null),
    thread: useRef<HTMLElement>(null), context: useRef<HTMLElement>(null), composer: useRef<HTMLElement>(null),
    input: useRef<HTMLTextAreaElement>(null),
  };

  const zoomRef = useRef<string | null>(null);
  const setOverlay = (o: Overlay) => { overlayRef.current = o; setOverlayState(o); };
  const setZoom = (src: string | null) => { zoomRef.current = src; setZoomState(src); };
  const live = !!data && data.live;
  // VibeCoder : le relevé de l'agent affiché, sur sa conversation en cours (sinon, la vue habituelle).
  const vibeShown = vibe && data && data.live && data.key === vibe.agentId ? vibe : null;

  // Réduit (comme avant la première conversation) : la hauteur de son contenu,
  // que le principal donne au panneau.
  const reportHeight = () => {
    if (vibeShown || (current.current?.mode || 'compact') !== 'compact') return;
    setTimeout(() => {
      conv.height(compactHeight({
        fixed: [el.header.current, el.notice.current, el.archived.current, el.composer.current],
        contextPanel: el.context.current, thread: el.thread.current!,
      }));
    }, 0);
  };

  async function addFiles(files: File[]) {
    if (!current.current?.live) return; // ancienne conversation : rien à envoyer
    setStatus('');
    const added: (Piece | { kind: 'path'; name: string; path: string })[] = [];
    for (const file of files) {
      // Une image collée n'a pas de chemin : elle part en image ; un autre
      // fichier sans chemin ne peut pas être joint.
      if (IMAGE_TYPES.includes(file.type)) {
        added.push({ kind: 'image', name: file.name || 'image collée', type: file.type, data: await file.arrayBuffer(), url: URL.createObjectURL(file) });
        continue;
      }
      const path = conv.pathFor(file);
      if (!path) setStatus(`${file.name || 'Fichier'} : impossible à joindre ici, déposez-le depuis le gestionnaire de fichiers.`);
      else added.push({ kind: 'path', name: file.name, path });
    }
    setDraft((d) => ({ ...d, pieces: added.reduce<Piece[]>((all, p) => (p.kind === 'path' ? withFile(all, p.path, p.name) : [...all, p]), d.pieces) }));
  }

  // Les écoutes du pont : posées pendant le premier rendu (synchrone, cf.
  // main.tsx), avant de dire au principal que la page est prête.
  useLayoutEffect(() => {
    conv.onThread((d) => {
      const thread = el.thread.current!;
      const before = current.current;
      const atEnd = thread.scrollHeight - thread.scrollTop - thread.clientHeight < AT_END_PX;
      const switched = d.key !== (before && before.key);
      if (switched) {
        const from = before && before.key;
        setDraft((cur) => drafts.switchTo(from, cur, d.key));
        setStatus('');
        setOverlay('none');
      } else if (d.mode === 'compact' && overlayRef.current === 'history') setOverlay('none');
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
    // La dictée, panneau ouvert sur cet agent : ajoutée au champ, à relire.
    conv.onDictation((text) => {
      focusEnd.current = true;
      setDraft((d) => ({ ...d, text: appendDictation(d.text, text) }));
    });
    conv.onFocusInput(() => el.input.current!.focus());
    conv.onVibe(setVibe);
    conv.onAttached((what) => {
      setDraft((d) => ({ ...d, pieces: withAttached(d.pieces, what) }));
      el.input.current!.focus();
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
      if (files.length) addFiles(files);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (zoomRef.current) setZoom(null);
      else if (overlayRef.current !== 'none') setOverlay('none');
    });
    conv.ready();
  }, []);

  useLayoutEffect(() => {
    if (!data) return;
    document.title = `${titleOf(data)} — ${data.name}`;
    if (toEnd.current) { el.thread.current!.scrollTop = el.thread.current!.scrollHeight; toEnd.current = false; }
  }, [data]);

  useLayoutEffect(() => {
    if (!focusEnd.current) return;
    focusEnd.current = false;
    const input = el.input.current!;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [draft]);

  useLayoutEffect(reportHeight);

  // VibeCoder ouvert ou refermé : le fil, monté de nouveau, repart du bas.
  const vibeOn = !!vibeShown;
  useLayoutEffect(() => { el.thread.current!.scrollTop = el.thread.current!.scrollHeight; }, [vibeOn]);

  async function showHistory() {
    setOverlay('history');
    setSessions(null);
    const list = await conv.history();
    if (overlayRef.current === 'history') setSessions(list);
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
      el.thread.current!.scrollTop = el.thread.current!.scrollHeight;
    } else {
      setStatus((res && res.error) || 'L\'envoi a échoué.');
    }
  }

  // VibeCoder : une action du relevé. 'prefill' : préparée dans le champ ;
  // 'send' : envoyée à l'agent, avec le texte du champ si son gabarit le prend
  // (exigé et vide : on le demande ; envoyé : le champ se vide, ses pièces
  // jointes restent).
  async function vibeRun(id: string, args: VibeArgs = {}) {
    const a = vibe?.actions.find((x) => x.id === id);
    if (!vibe || !a || sending) return;
    if (a.kind === 'prefill') { vibePrefill(id, ''); return; }
    const text = a.needs === 'text' || a.usesText ? draft.text.trim() : '';
    if (a.needs === 'text' && !text) { setStatus(vibeStrings(vibe.lang).needText); el.input.current!.focus(); return; }
    setStatus('');
    setSending(true);
    let res: SendResult | null = null;
    try { res = await conv.vibeRun(id, text ? { ...args, text } : args); } catch { res = null; }
    setSending(false);
    if (res && res.ok) {
      if (text) setDraft((d) => ({ ...d, text: '' }));
      el.thread.current!.scrollTop = el.thread.current!.scrollHeight;
    } else {
      setStatus((res && res.error) || vibeStrings(vibe.lang).sendFailed);
    }
  }

  // Une action 'prefill' : son texte, ce qu'on cite à la place de {{quote}},
  // ajouté au champ (withPrefill), à compléter puis envoyer.
  function vibePrefill(id: string, quote: string) {
    const a = vibe?.actions.find((x) => x.id === id && x.kind === 'prefill');
    if (!a) return;
    focusEnd.current = true;
    setStatus('');
    setDraft((d) => ({ ...d, text: withPrefill(d.text, a.text || '', quote) }));
  }

  const vibeAct: VibeActs = {
    run: vibeRun, prefill: vibePrefill, set: conv.vibeSet, mark: conv.vibeMark, draft: conv.vibeDraft, open: conv.vibeOpen,
    openLink: conv.openLink, refresh: conv.vibeRefresh,
  };

  const act: ThreadActions = {
    openLink: conv.openLink,
    showFile: conv.showFile,
    listen: conv.speak,
    copy: conv.copy,
    zoom: setZoom,
    answer: (decision, key) => guard.answer(key, decision, conv.answer),
  };

  const toggleContext = () => { if (overlay === 'context') setOverlay('none'); else showContext(); };
  const toggleTasks = () => setTasksOpen((o) => !o);

  // Le message de l'appli, le fil (et ses volets), le champ : à leur place dans
  // la vue habituelle, ou dans la colonne de la conversation de VibeCoder.
  const noticeBar = <NoticeBar notice={notice} onClose={() => setNotice(null)} ref={el.notice} />;
  const body = (
    <div id="body">
      <main id="thread" className="scroll" ref={el.thread}>
        {data ? <ThreadContent key={data.key} data={data} act={act} /> : null}
      </main>
      {tasksOpen && data?.tasks ? <TasksPane tasks={data.tasks} onOpenLink={conv.openLink} onShowFile={conv.showFile} /> : null}
      <HistoryList open={overlay === 'history'} sessions={sessions} onOpen={(id) => { setOverlay('none'); conv.open(id); }} />
      <ContextDetail open={overlay === 'context'} probe={probe} ref={el.context}
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
      status={status} setStatus={setStatus} dir={data?.dir || ''} commands={commands} probe={conv.probe}
      onSend={send} onAttach={() => conv.attach()} onFiles={addFiles} onLayout={reportHeight}
      ref={el.composer} input={el.input} />
  );

  return (
    <div id="app" data-view={data ? (data.dictation ? 'dictation' : 'agent') : undefined} data-mode={data?.mode}
      className={dragging ? 'dragging' : undefined} style={data ? { '--accent': data.color } as CSSProperties : undefined}>
      {vibeShown && data ? (
        <VibeCoder key={vibeShown.agentId} view={vibeShown} thread={data} act={vibeAct} tasksOpen={tasksOpen}
          contextOpen={overlay === 'context'} onGauge={toggleContext} onTasks={toggleTasks} onHide={() => conv.hide()}
          side={vibeSide} onSide={setVibeSide}>
          {noticeBar}
          {body}
          <SkillsBar view={vibeShown} busy={isBusy(data.status)} onRun={vibeRun} />
          {composer}
        </VibeCoder>
      ) : (
        <>
          <Header data={data}
            onGauge={toggleContext}
            onHistory={() => { if (overlay === 'history') setOverlay('none'); else showHistory(); }}
            tasksOpen={tasksOpen} onTasks={toggleTasks}
            onMode={() => conv.setMode(data?.mode === 'compact' ? 'full' : 'compact')}
            onHide={() => conv.hide()} ref={el.header} />
          {noticeBar}
          <ArchivedBar data={data} onCurrent={() => conv.current()} onResume={() => conv.resume()} ref={el.archived} />
          {body}
          {composer}
        </>
      )}
      <Lightbox src={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
