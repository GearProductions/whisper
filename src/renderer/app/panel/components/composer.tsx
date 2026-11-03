/** composer — le champ de saisie : écrire à l'agent affiché (Entrée envoie,
 *  Maj+Entrée va à la ligne), ses pièces jointes, les commandes « / »
 *  et, après un « @ », les artefacts du projet (useArtifactMention : jamais
 *  ouverts avec les commandes).
 *  #composer-row est le cadre du champ : la pièce jointe (#attach) en icône au
 *  début, #message sans bordure, Dicter (#mic) puis Envoyer (#send) en icône à la
 *  fin, chacune nommée (title, aria-label). #mic dicte tant qu'il est maintenu
 *  (onMicDown à l'appui, onMicUp au relâchement, à la sortie ou à l'annulation) ;
 *  sa phase (enregistre, transcrit) est dans data-phase et le title ; il ne
 *  prend pas le clavier (la dictée va à la zone qui l'a). Il
 *  n'envoie rien : le texte rendu par whisper est l'affaire de ses rappels. Le brouillon appartient à panel-app (un par
 *  conversation) ; ici, l'édition.
 *  Ne connaît pas : le pont, le micro (rappels passés). Utilisé par : panel-app. */
import { useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type RefObject } from 'react';
import { type Phase } from 'core/dictation';
import { cycle, matchCommands, pickCommand, pieceLabel, pieceTitle, slashQuery, type Draft, type Piece } from 'core/conversation';
import type { Command, ProbeResult, VibeArtifact } from 'technicals/bridge';
import { Icon, useArtifactMention } from 'app/panel/vibecoder';

const MAX_HEIGHT = 160;

type Props = {
  draft: Draft;
  setText(text: string): void;
  removePiece(p: Piece): void;
  live: boolean;           // conversation en cours : sinon, pas de champ
  name: string;
  busy: boolean;           // l'agent travaille : on écrit, on n'envoie pas
  sending: boolean;
  status: string;
  setStatus(text: string): void;
  dir: string;             // les commandes se demandent une fois par dossier
  commands: Map<string, Command[]>;
  probe(): Promise<ProbeResult>;
  onSend(): void;
  onAttach(): void;
  onFiles(files: File[]): void;
  onLayout(): void;        // la hauteur a pu changer (réduit)
  onMicDown(): void;       // dictée : maintenu = on dicte
  onMicUp(): void;
  phase: Phase;            // la dictée en cours
  ref: RefObject<HTMLElement | null>;
  input: RefObject<HTMLTextAreaElement | null>;
  artifacts?: VibeArtifact[]; // pour le « @ » ; sans eux ou sans dossier, pas de liste
  artifactsDir?: string;
};

type Slash = { open: boolean; items: Command[]; index: number; hint: string };
const CLOSED: Slash = { open: false, items: [], index: 0, hint: '' };

export function Composer(p: Props) {
  const [slash, setSlash] = useState<Slash>(CLOSED);
  const loading = useRef(false);
  const list = useRef<HTMLDivElement>(null);
  const caret = useRef<number | null>(null); // curseur à poser après une commande choisie
  const held = useRef(false); // #mic est enfoncé : onMicUp une seule fois
  const mention = useArtifactMention(p.artifacts ?? [], p.artifactsDir ?? '', p.input, p.setText);

  // Le champ grandit avec le texte, jusqu'à quelques lignes.
  useLayoutEffect(() => {
    const el = p.input.current!;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'; // pas de barre pour rien
    if (caret.current !== null) { el.setSelectionRange(caret.current, caret.current); caret.current = null; }
  }, [p.draft.text]);
  useLayoutEffect(() => { p.onLayout(); });
  useLayoutEffect(() => { list.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' }); }, [slash]);

  const close = () => setSlash((s) => (s.open ? CLOSED : s));
  const hint = (text: string) => setSlash({ open: true, items: [], index: 0, hint: text });

  // Le champ commence par « / » : les commandes de l'agent (celles de Claude
  // Code, ses skills, celles du projet), filtrées par ce qui est tapé.
  async function update(index: number) {
    const el = p.input.current!;
    const q = slashQuery(el.value, el.selectionStart);
    if (q === null || !p.live) { close(); return; }
    const known = p.commands.get(p.dir);
    if (!known) {
      hint('Chargement des commandes…');
      if (loading.current) return;
      loading.current = true;
      const res = await p.probe();
      loading.current = false;
      p.commands.set(p.dir, res.commands || []);
      if (!res.commands) { hint(res.error || 'Commandes indisponibles.'); return; }
      update(index);
      return;
    }
    const items = matchCommands(known, q);
    if (!items.length) { hint('Aucune commande ne correspond.'); return; }
    setSlash({ open: true, items, index: Math.min(index, items.length - 1), hint: '' });
  }

  function pick(i: number) {
    const c = slash.items[i];
    const el = p.input.current!;
    if (!c) return;
    const next = pickCommand(el.value, el.selectionStart, c);
    caret.current = next.caret;
    p.setText(next.value);
    el.focus();
    setSlash(CLOSED);
  }

  // La liste ouverte prend les touches : true si elle a pris celle-ci.
  function slashKey(e: KeyboardEvent) {
    if (!slash.open) return false;
    if (e.key === 'Escape') setSlash(CLOSED);
    else if (!slash.items.length) return false;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') update(cycle(slash.index, e.key === 'ArrowDown' ? 1 : -1, slash.items.length));
    else if (e.key === 'Enter' || e.key === 'Tab') pick(slash.index);
    else return false;
    e.preventDefault();
    e.stopPropagation(); // Échap : ne ferme pas aussi l'historique ou le contexte
    return true;
  }

  const micDown = () => { held.current = true; p.onMicDown(); };
  const micUp = () => { if (held.current) { held.current = false; p.onMicUp(); } };
  const phase = p.phase;
  const micTitle = phase === 'recording' ? 'Enregistre…' : phase === 'transcribing' ? 'Transcrit…' : 'Dicter (maintenir appuyé)';

  // Du texte collé va dans le champ ; des images ou fichiers, en pièces jointes.
  function onPaste(e: ClipboardEvent) {
    const files = [...(e.clipboardData?.files || [])];
    if (!files.length) return;
    e.preventDefault();
    p.onFiles(files);
  }

  return (
    <footer id="composer" hidden={!p.live} ref={p.ref}>
      {mention.list}
      <div id="slash" className="scroll" hidden={!slash.open} ref={list}>
        {slash.hint ? <div className="hint">{slash.hint}</div> : slash.items.map((c, i) => (
          <button key={i} type="button" className={`slash-item${i === slash.index ? ' active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); pick(i); }}>
            <span className="slash-name">{`/${c.name}${c.argumentHint ? ` ${c.argumentHint}` : ''}`}</span>
            <span className="slash-desc">{c.description}</span>
          </button>
        ))}
      </div>
      <div id="pieces">
        {p.draft.pieces.map((piece, i) => (
          <div key={i} className="piece" title={pieceTitle(piece)}>
            {piece.kind === 'image' ? <img src={piece.url} alt="" /> : null}
            <span>{pieceLabel(piece)}</span>
            <button type="button" className="remove" title="Retirer" onClick={() => p.removePiece(piece)}>×</button>
          </div>
        ))}
      </div>
      <div id="composer-row">
        <button id="attach" type="button" onClick={p.onAttach} aria-label="Joindre…"
          title="Joindre des images, des fichiers ou le texte sélectionné (aussi : glisser-déposer, Ctrl+V)"><Icon name="attach" /></button>
        <textarea id="message" className="scroll" rows={1} ref={p.input} value={p.draft.text}
          placeholder={p.busy ? `${p.name} travaille : vous pourrez envoyer quand il aura fini.`
            : `Écrire à ${p.name}… (Entrée : envoyer, Maj+Entrée : à la ligne)`}
          onChange={(e) => { p.setText(e.target.value); p.setStatus(''); update(0); slashQuery(e.target.value, e.target.selectionStart) === null ? mention.update() : mention.close(); }}
          onKeyDown={(e) => {
            if (slashKey(e) || mention.key(e)) return;
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); p.onSend(); }
          }}
          onPaste={onPaste}
          onBlur={() => setTimeout(() => { close(); mention.close(); }, 150)} />
        <button id="mic" type="button" aria-label="Dicter" title={micTitle} data-phase={phase}
          onMouseDown={(e) => e.preventDefault()} onPointerDown={micDown} onPointerUp={micUp} onPointerLeave={micUp} onPointerCancel={micUp}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0V4a2 2 0 0 0-2-2z" /><path d="M3.5 8a4.5 4.5 0 0 0 9 0" /><path d="M8 12.5V14" />
          </svg>
        </button>
        <button id="send" type="button" title="Envoyer (Entrée)" aria-label="Envoyer" disabled={p.sending || p.busy}
          onClick={p.onSend}><Icon name="send" /></button>
      </div>
      <div id="composer-status">{p.status}</div>
    </footer>
  );
}
