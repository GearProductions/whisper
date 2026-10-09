/** panel-app — le panneau des conversations, attaché à l'icône : une
 *  conversation à la fois, celle du robot sélectionné (les robots servent
 *  d'onglets) ; aucun robot sélectionné : le contexte « Dictée », le dernier
 *  texte dicté et Copier. Réduit : le dernier échange, à la hauteur de son
 *  contenu ; agrandi : tout le fil et l'historique. Le principal envoie la
 *  conversation (`conv:thread`) à l'ouverture, à chaque changement et au fil
 *  d'un tour. La colle : seul fichier du panneau qui connaît le pont
 *  (window.conv) ; il tient le brouillon de chaque conversation.
 *  Ne connaît pas : l'icône, la bulle. Utilisé par : main.tsx. */
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  appendDictation, createDrafts, createPermissionGuard, EMPTY, followsEnd, IMAGE_TYPES, isBusy, revoke, titleOf, toDraft,
  withAttached, withFile, type Draft, type Piece,
} from 'core/conversation';
import type { Command, ConvApi, Notice, ProbeResult, Session, Thread } from 'technicals/bridge';
import { compactHeight } from 'technicals/dom';
import {
  ArchivedBar, Composer, ContextDetail, Header, HistoryList, Lightbox, NoticeBar, showsWorking, ThreadContent,
  type ThreadActions,
} from './components';

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

  // Réduit (comme avant la première conversation) : la hauteur de son contenu,
  // que le principal donne au panneau.
  const reportHeight = () => {
    if ((current.current?.mode || 'compact') !== 'compact') return;
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

  const act: ThreadActions = {
    openLink: conv.openLink,
    showFile: conv.showFile,
    listen: conv.speak,
    copy: conv.copy,
    zoom: setZoom,
    answer: (decision, key) => guard.answer(key, decision, conv.answer),
  };

  return (
    <div id="app" data-view={data ? (data.dictation ? 'dictation' : 'agent') : undefined} data-mode={data?.mode}
      className={dragging ? 'dragging' : undefined} style={data ? { '--accent': data.color } as CSSProperties : undefined}>
      <Header data={data}
        onGauge={() => { if (overlay === 'context') setOverlay('none'); else showContext(); }}
        onHistory={() => { if (overlay === 'history') setOverlay('none'); else showHistory(); }}
        onMode={() => conv.setMode(data?.mode === 'compact' ? 'full' : 'compact')}
        onHide={() => conv.hide()} ref={el.header} />
      <NoticeBar notice={notice} onClose={() => setNotice(null)} ref={el.notice} />
      <ArchivedBar data={data} onCurrent={() => conv.current()} onResume={() => conv.resume()} ref={el.archived} />
      <div id="body">
        <main id="thread" className="scroll" ref={el.thread}>
          {data ? <ThreadContent key={data.key} data={data} act={act} /> : null}
        </main>
        <HistoryList open={overlay === 'history'} sessions={sessions} onOpen={(id) => { setOverlay('none'); conv.open(id); }} />
        <ContextDetail open={overlay === 'context'} probe={probe} ref={el.context}
          canCompact={live && !isBusy(data!.status)}
          onCompact={async () => {
            const sent = await conv.send({ text: '/compact', images: [], files: [], selection: '' });
            if (sent && sent.ok) setOverlay('none');
            return sent;
          }} />
      </div>
      <Composer draft={draft} live={live} name={data?.name || ''} busy={!!data && isBusy(data.status)} sending={sending}
        setText={(text) => setDraft((d) => ({ ...d, text }))}
        removePiece={(p) => { revoke([p]); setDraft((d) => ({ ...d, pieces: d.pieces.filter((x) => x !== p) })); }}
        status={status} setStatus={setStatus} dir={data?.dir || ''} commands={commands} probe={conv.probe}
        onSend={send} onAttach={() => conv.attach()} onFiles={addFiles} onLayout={reportHeight}
        ref={el.composer} input={el.input} />
      <Lightbox src={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
