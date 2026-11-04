/** composer — le champ de saisie : écrire à l'agent affiché (Entrée envoie,
 *  Maj+Entrée va à la ligne), ses pièces jointes, les commandes « / »
 *  et, après un « @ », les artefacts du projet (useArtifactMention : jamais
 *  ouverts avec les commandes). Le cadre (Joindre, pièces, zone, micro et Envoyer) est
 *  PromptField ; ici, ses menus « / » et « @ » (ses children), ses touches, et le
 *  message sous le cadre. #mic est celui du contexte Mic (posé par panel-app) : il
 *  n'envoie rien, le texte rendu par whisper est l'affaire de panel-app. Le brouillon
 *  et ses pièces appartiennent à panel-app (un par conversation) ; ici, l'édition.
 *  Ne connaît pas : le pont, le micro. Utilisé par : panel-app. */
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { cycle, matchCommands, pickCommand, slashQuery, type Draft, type Piece } from 'core/conversation';
import type { Command, ProbeResult, VibeArtifact } from 'technicals/bridge';
import { t as strings } from 'core/vibecoder';
import { PromptField, useArtifactMention } from 'app/panel/vibecoder';

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
  input: RefObject<HTMLTextAreaElement | null>;
  artifacts?: VibeArtifact[]; // pour le « @ » ; sans eux ou sans dossier, pas de liste
  artifactsDir?: string;
};

type Slash = { open: boolean; items: Command[]; index: number; hint: string };
const CLOSED: Slash = { open: false, items: [], index: 0, hint: '' };

const t = strings('fr');

export function Composer(p: Props) {
  const [slash, setSlash] = useState<Slash>(CLOSED);
  const loading = useRef(false);
  const list = useRef<HTMLDivElement>(null);
  const caret = useRef<number | null>(null); // curseur à poser après une commande choisie
  const mention = useArtifactMention(p.artifacts ?? [], p.artifactsDir ?? '', p.input, p.setText);

  // Le curseur à poser après une commande choisie (la hauteur du champ : PromptField).
  useLayoutEffect(() => {
    if (caret.current !== null) { p.input.current?.setSelectionRange(caret.current, caret.current); caret.current = null; }
  }, [p.draft.text]);
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


  // La frappe : le texte au brouillon, puis les menus (le DOM a déjà la nouvelle valeur).
  const type = (text: string) => {
    p.setText(text);
    p.setStatus('');
    update(0);
    slashQuery(text, p.input.current!.selectionStart) === null ? mention.update() : mention.close();
  };

  return (
    <footer id="composer" hidden={!p.live}>
      <PromptField t={t} ids field={p.input} text={p.draft.text} setText={type}
        pieces={p.draft.pieces} onRemove={p.removePiece} onAttach={p.onAttach} onFiles={p.onFiles}
        onSend={p.onSend} sendDisabled={p.sending || p.busy} sendTitle="Envoyer (Entrée)"
        placeholder={p.busy ? `${p.name} travaille : vous pourrez envoyer quand il aura fini.`
          : `Écrire à ${p.name}… (Entrée : envoyer, Maj+Entrée : à la ligne)`}
        onKeyDown={(e) => {
          if (slashKey(e) || mention.key(e)) return;
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); p.onSend(); }
        }}
        onBlur={() => setTimeout(() => { close(); mention.close(); }, 150)}>
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
      </PromptField>
      <div id="composer-status">{p.status}</div>
    </footer>
  );
}
