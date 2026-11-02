/** file-tree — l'arbre de chemins, sans le DOM : les nœuds (dossiers d'abord, puis fichiers, par nom,
 *  chaque dossier suivi de son contenu), ceux qu'on voit selon les dossiers dépliés.
 *  Un nœud est tenu par son chemin ; les dossiers sont ceux que les chemins impliquent, plus `dirs`
 *  (les vides). Un chemin fini par / est une feuille (un lien, un dossier non exploré), son label garde le /.
 *  Ne connaît pas : les artefacts, les modules, le DOM. Utilisé par : core/vibecoder (artifact-tree,
 *  ide-files), app/panel/vibecoder (ide-view). */

export type FileNode = {
  key: string;        // le chemin
  label: string;      // son dernier segment (avec son / final pour une feuille-dossier)
  folder: boolean;
  depth: number;
  parent: string;     // la clé du dossier qui le contient ; '' : la racine
};

// Les dossiers qui contiennent `path` : a, a/b pour a/b/c.
const ancestors = (path: string) => {
  const parts = path.split('/');
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'));
};

export const fileTree = (paths: string[], dirs: string[] = []): FileNode[] => {
  const folders = new Set<string>();
  for (const d of dirs) for (const a of [...ancestors(d), d]) folders.add(a);
  for (const p of paths) for (const a of ancestors(p.replace(/\/$/, ''))) folders.add(a);

  const node = (key: string, folder: boolean): FileNode => {
    const bare = key.replace(/\/$/, '');
    return { key, folder, label: key.slice(bare.lastIndexOf('/') + 1), depth: bare.split('/').length - 1, parent: bare.slice(0, Math.max(bare.lastIndexOf('/'), 0)) };
  };
  const children = new Map<string, FileNode[]>();
  for (const n of [...[...folders].map((k) => node(k, true)), ...[...new Set(paths)].map((k) => node(k, false))]) {
    children.set(n.parent, [...(children.get(n.parent) ?? []), n]);
  }
  const walk = (parent: string): FileNode[] =>
    (children.get(parent) ?? [])
      .sort((a, b) => Number(b.folder) - Number(a.folder) || a.label.localeCompare(b.label))
      .flatMap((n) => (n.folder ? [n, ...walk(n.key)] : [n]));
  return walk('');
};

// Les nœuds dont tous les dossiers parents sont dans `open`.
export const visibleRows = <N extends FileNode>(nodes: N[], open: ReadonlySet<string>): N[] => {
  const shown = new Set<string>(['']);   // les dossiers dont le contenu se voit
  return nodes.filter((n) => {
    if (!shown.has(n.parent)) return false;
    if (n.folder && open.has(n.key)) shown.add(n.key);
    return true;
  });
};
