/** artifacts-view — le panneau Artefacts (F-94, F-95), au centre de l'écran (.vc-art-side, .vc-center :
 *  vibe-coder le met à la place du fil d'Ariane et de l'étape). À gauche l'arborescence des artefacts
 *  (ArtifactTreeView, dossiers pliés au départ, « Tout replier » ; vide → ce que le skill fait, en une
 *  ligne) : elle est aussi la zone de dépôt. Au centre le seul fichier sélectionné (rien d'autre, ou
 *  plusieurs éléments : vide ; au départ, le premier) : markdown → MarkdownView, text → CodeView en
 *  lecture seule (le texte reçu par `code`, VibeCode de son id), « fichier tronqué » si truncated ; page →
 *  <iframe sandbox> (attribut vide : ni script, ni réseau) sur url ; media → <iframe> sur url ; en tête,
 *  Ouvrir dans l'éditeur (onOpen) et Copier dans le projet (onRun('copy-artifact')). Sélection, focus,
 *  dossiers ouverts, presse-papiers, saisie, menu et confirmation sont l'état local ; tout est tenu par
 *  le nom (les ids a<i> glissent quand la liste change) et les ids ne sont lus qu'au moment d'agir.
 *  Après Renommer ou Déplacer, la sélection suit le nom attendu, donc l'artefact du centre aussi. Chaque
 *  id affiché est annoncé par onChoose (vibe-coder suit son texte). Supprimer passe toujours par
 *  ConfirmBox, et envoie les noms confirmés avec les ids (le principal les compare). Un lien d'un Markdown
 *  ne mène nulle part. Un dépôt de fichiers remonte par onDrop(files, id du dossier d<i> lu à ce moment,
 *  absent : la racine) ; glisser une ligne ne touche pas à la conversation (data-own-drop). Sous
 *  l'arborescence, le dernier résultat des actions du panneau (result : « … » en cours, sinon sa ligne,
 *  le détail en titre) ; un échec nouveau lâche le nom attendu (la sélection ne l'attend plus).
 *  Libellés : core/vibecoder (t, fileSize) ; logique : artifact-tree, tree-keys, artifact-clipboard.
 *  Ne connaît pas : le pont (rappels passés), le disque, le schéma (url reçue).
 *  Utilisé par : vibe-coder. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { artifactTree, duplicateArgs, type ArtifactResult, fileSize, idsOf, menuEntries, nameProblem, pasteArgs, moveArgs, t as strings, treeKey, visibleRows, type Clip } from 'core/vibecoder';
import { keptSelection, select, type Selection } from 'helpers';
import type { VibeArgs, VibeArtifact, VibeArtifactDir, VibeCode, VibeLang } from 'technicals/bridge';
import { ArtifactTreeView } from './artifact-tree-view';
import { CodeView } from './code-view';
import { ConfirmBox } from './confirm-box';
import { ContextMenu } from './context-menu';
import { Icon, IconButton } from './icons';
import { MarkdownView } from './markdown-view';
import './artifacts-view.css';

export type ArtifactsViewProps = {
  artifacts: VibeArtifact[];
  artifactDirs: VibeArtifactDir[];
  lang: VibeLang;
  code: VibeCode | null;          // le texte de l'artefact choisi (VibeCode de son id)
  onChoose: (id: string) => void;
  onOpen: (id: string) => void;
  onRun: (action: string, args: VibeArgs) => void;
  onDrop: (files: File[], folderId?: string) => void;
  result?: ArtifactResult;        // le dernier résultat des actions du panneau (artifactResult) ; absent : aucun
};

const noLink = () => {};
const NO_RESULT: ArtifactResult = { running: false, last: null };
const NEW = '\0new';   // la clé de la ligne de saisie d'un nouveau fichier ou dossier

type Edit = { key: string; folder: boolean; parent: string; typed: string | null };
type Menu = { x: number; y: number; keys: string[]; target: 'item' | 'folder' | 'blank'; folder: string };

export function ArtifactsView({ artifacts, artifactDirs, lang, code, onChoose, onOpen, onRun, onDrop, result = NO_RESULT }: ArtifactsViewProps) {
  const t = strings(lang);
  const nodes = useMemo(() => artifactTree(artifacts, artifactDirs), [artifacts, artifactDirs]);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [sel, setSel] = useState<Selection | null>(null);   // null : rien choisi encore, le premier fichier
  const [focus, setFocus] = useState<string | null>(null);
  const [clip, setClip] = useState<Clip>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const want = useRef<string[] | null>(null);   // la sélection attendue du prochain relevé (après Renommer, Déplacer, Nouveau)
  const side = useRef<HTMLElement>(null);

  const rows = useMemo(() => visibleRows(nodes, open), [nodes, open]);
  const first = nodes.find((n) => !n.folder);
  const cur: Selection = sel ?? { keys: first ? [first.key] : [], anchor: first?.key ?? null };
  const node = (key: string) => nodes.find((n) => n.key === key);
  const chosen = cur.keys.length === 1 ? node(cur.keys[0])?.artifact : undefined;
  const id = chosen?.id ?? null;

  // La sélection suit le nom attendu dès qu'il est au relevé ; sinon elle perd ce qui a disparu.
  useEffect(() => {
    const keys = nodes.map((n) => n.key);
    if (want.current) {
      if (!want.current.every((k) => keys.includes(k))) return;
      setSel({ keys: want.current, anchor: want.current[0] });
      want.current = null;
    } else setSel((s) => s && keptSelection(s, keys));
  }, [nodes]);

  // Refusé ou en échec : le nom attendu n'arrivera pas, la sélection ne l'attend plus.
  const failedAt = result.last && !result.last.ok ? result.last.time : null;
  useEffect(() => { if (failedAt) want.current = null; }, [failedAt]);

  // L'id affiché annoncé une fois par changement (par défaut, au clic, quand il glisse).
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!id || id === sent.current) return;
    sent.current = id;
    onChoose(id);
  }, [id]);

  const run = (action: string, args: VibeArgs) => onRun(action, { direct: true, ...args });
  const pick = (s: Selection) => { want.current = null; setSel(s); };
  // Les clés de la sélection après un renommage ou un déplacement : [ancien chemin, nouveau chemin].
  const follow = (moves: [string, string][]) => {
    want.current = cur.keys.map((k) => { const m = moves.find(([from]) => k === from || k.startsWith(`${from}/`)); return m ? m[1] + k.slice(m[0].length) : k; });
  };
  const child = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);
  const endEdit = () => { setEdit(null); side.current?.querySelector<HTMLElement>('.vc-tree')?.focus(); };
  const ask = (keys: string[]) => { if (keys.length) setConfirm(keys); };
  const folderId = (key: string) => nodes.find((n) => n.key === key && n.folder)?.id || undefined;

  const send = (a: { action: string; args: VibeArgs } | null, moves?: [string, string][]) => {
    if (!a) return;
    if (moves) follow(moves);
    run(a.action, a.args);
  };
  const moved = (keys: string[], folder: string): [string, string][] => keys.map((k) => [k, child(folder, k.slice(k.lastIndexOf('/') + 1))]);

  const startRename = (key: string) => { const n = node(key); if (n) setEdit({ key, folder: n.folder, parent: n.parent, typed: n.label }); };
  const startNew = (parent: string, folder: boolean) => {
    if (parent) setOpen((o) => new Set(o).add(parent));
    setEdit({ key: NEW, folder, parent, typed: null });
  };
  const siblings = (e: Edit) => nodes.filter((n) => n.parent === e.parent && n.key !== e.key).map((n) => n.label);
  const problemOf = (e: Edit, name: string) => nameProblem(name, siblings(e), e.folder);
  const done = (name: string) => {
    const e = edit!;
    const n = node(e.key);
    if (name && !problemOf(e, name) && !(n && name === n.label)) {
      if (e.key === NEW) {
        run(e.folder ? 'new-artifact-folder' : 'new-artifact-file', { name, ...(folderId(e.parent) ? { folder: folderId(e.parent) } : {}) });
        want.current = [child(e.parent, name)];
      } else if (n?.id) {
        follow([[n.key, child(n.parent, name)]]);
        run('rename-artifact', { artifacts: [n.id], name });
      }
    }
    endEdit();
  };

  // Les ids et les noms sortent des mêmes nœuds, au moment de confirmer.
  const trash = () => {
    const ids = idsOf(nodes, confirm!);
    const names = nodes.filter((n) => n.id && ids.includes(n.id)).map((n) => n.key);
    setConfirm(null);
    if (ids.length) run('trash-artifacts', { artifacts: ids, names });
  };

  const onKey = (e: KeyboardEvent) => {
    const at = focus ?? cur.keys[0] ?? null;
    const r = treeKey(rows, open, at, e.key, e.shiftKey);
    if (!r) return;
    e.preventDefault();
    if (r.open) setOpen(r.open);
    if (r.focus) {
      setFocus(r.focus);
      pick(select(cur, rows.map((n) => n.key), r.focus, { ctrl: false, shift: !!r.extend }));
    }
    if (r.command === 'rename' && at) startRename(at);
    if (r.command === 'trash') ask(cur.keys);
  };

  const onMenu = (x: number, y: number, key: string | null) => {
    const n = key === null ? undefined : node(key);
    let keys: string[] = [];
    if (n) {
      keys = cur.keys.includes(n.key) ? cur.keys : [n.key];
      if (keys !== cur.keys) pick({ keys, anchor: n.key });
      setFocus(n.key);
    }
    setMenu({ x, y, keys, target: n ? (n.folder ? 'folder' : 'item') : 'blank', folder: n ? (n.folder ? n.key : n.parent) : '' });
  };
  const onPick = (entry: string) => {
    const m = menu!;
    switch (entry) {
      case 'rename': return startRename(m.keys[0]);
      case 'trash': return ask(m.keys);
      case 'copy': case 'cut': return setClip({ mode: entry, keys: m.keys });
      case 'paste': {
        if (clip?.mode === 'cut') setClip(null);
        return send(pasteArgs(clip, nodes, m.folder), clip?.mode === 'cut' ? moved(clip.keys, m.folder) : undefined);
      }
      case 'duplicate': return send(duplicateArgs(nodes, m.keys));
      case 'newFile': return startNew(m.folder, false);
      case 'newFolder': return startNew(m.folder, true);
    }
  };
  const closeMenu = useCallback(() => setMenu(null), []);

  const typedProblem = edit?.typed ? problemOf(edit, edit.typed) : null;   // rien avant la première frappe d'un nom neuf
  const shownProblem = typedProblem && t.nameProblem[typedProblem];
  const text = chosen && code?.id === chosen.id ? code : null;
  return (
    <>
      <nav ref={side} className="vc-art-side scroll" aria-label={t.artifacts}>
        <div className="vc-side-title vc-band">
          <span>{t.artifacts}</span>
          <span>
            {open.size ? <button type="button" className="vc-mini" onClick={() => setOpen(new Set())}>{t.artifactCollapseAll}</button> : null}
            {nodes.length || ''}
          </span>
        </div>
        {nodes.length ? null : <p className="vc-art-none">{t.artifactsNone}</p>}
        <ArtifactTreeView rows={rows} open={open} selected={cur.keys} focus={focus}
          editing={edit && { key: edit.key, folder: edit.folder, parent: edit.parent }}
          problem={shownProblem}
          onToggle={(key) => setOpen((o) => { const n = new Set(o); if (!n.delete(key)) n.add(key); return n; })}
          onSelect={(key, mods) => { setFocus(key); pick(select(cur, rows.map((n) => n.key), key, mods)); }}
          onKey={onKey} onMenu={onMenu}
          onEdit={(typed) => setEdit((e) => e && { ...e, typed })} onEditDone={done} onEditCancel={endEdit}
          onMove={(keys, folder) => send(moveArgs(nodes, keys, folder), moved(keys, folder))}
          onDropFiles={(files, folder) => onDrop(files, folderId(folder))} />
        {result.running || result.last?.line ? (
          <div className="vc-art-result vc-direct" role="status">
            {result.running ? <span className="vc-direct-res" data-state="running">…</span> : (
              <span className="vc-direct-res" data-state={result.last!.ok ? 'ok' : 'ko'} title={result.last!.detail || result.last!.line}>
                <span className="vc-direct-mark"><Icon name={result.last!.ok ? 'ok' : 'ko'} /></span> {result.last!.line}
              </span>
            )}
          </div>
        ) : null}
        {cur.keys.length > 1 ? (
          <div className="vc-art-multi">
            <button type="button" className="vc-mini" title={t.artifactCopyTitle}
              onClick={() => run('copy-artifact', { artifacts: idsOf(nodes, cur.keys) })}>{t.artifactCopy}</button>
          </div>
        ) : null}
      </nav>
      <section className="vc-center">
        {chosen ? (
          <div className="vc-art" key={chosen.name}>
            <div className="vc-step-head vc-art-head">
              <h2 className="vc-mono" title={chosen.name}>{chosen.name}</h2>
              <span className="vc-art-size">{fileSize(chosen.size, lang)}</span>
              <IconButton icon="open" label={t.openTitle} onClick={() => onOpen(chosen.id)} />
              <button type="button" className="vc-mini" title={t.artifactCopyTitle}
                onClick={() => run('copy-artifact', { artifacts: idsOf(nodes, cur.keys) })}>{t.artifactCopy}</button>
            </div>
            {chosen.kind === 'page' && chosen.url ? <iframe className="vc-art-frame" sandbox="" src={chosen.url} title={chosen.name} />
              : chosen.kind === 'media' && chosen.url ? <iframe className="vc-art-frame" src={chosen.url} title={chosen.name} />
              : !text ? null
              : text.text === null ? <div className="vc-pr-hint">{t.artifactUnreadable}</div>
              : (
                <>
                  {text.truncated || chosen.truncated ? <div className="vc-art-cut" role="status">{t.artifactTruncated}</div> : null}
                  {chosen.kind === 'markdown'
                    ? <div className="vc-art-md scroll"><MarkdownView md={text.text} t={t} onOpenLink={noLink} /></div>
                    : <CodeView code={text.text} path={chosen.name} t={t} />}
                </>
              )}
          </div>
        ) : null}
      </section>
      {menu ? (
        <ContextMenu x={menu.x} y={menu.y} onPick={onPick} onClose={closeMenu}
          entries={menuEntries(menu.target, menu.keys.length, clip).map((id) => ({
            id, label: t.artifactMenu[id], disabled: id === 'paste' && !pasteArgs(clip, nodes, menu.folder),
          }))} />
      ) : null}
      {confirm ? (
        <ConfirmBox message={`${t.artifactConfirm(confirm.length, confirm[0])} ${t.artifactConfirmHint}`} items={confirm}
          confirm={t.artifactMenu.trash} cancel={t.artifactConfirmNo} onConfirm={trash} onCancel={() => setConfirm(null)} />
      ) : null}
    </>
  );
}
