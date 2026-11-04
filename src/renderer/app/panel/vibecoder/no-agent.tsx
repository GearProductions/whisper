/** no-agent — l'accueil quand aucun agent n'existe : un titre, une phrase, Nouvel agent… et son
 *  raccourci (Ctrl+N) ; le bouton appelle onAdd. Au centre de la fenêtre, aux couleurs de la vue C.
 *  Ne connaît pas : le pont (que des rappels). Utilisé par : panel-app. */
import type { Strings } from 'core/vibecoder';
import './no-agent.css';

type Props = { t: Strings; onAdd(): void };

export function NoAgent({ t, onAdd }: Props) {
  const add = t.paletteActions['new-agent'];
  return (
    <div className="vc-noagent">
      <h2>{t.welcomeTitle}</h2>
      <p>{t.welcomeText}</p>
      <button type="button" className="vc-run" data-tone="accent" autoFocus onClick={onAdd}>{add.label} <kbd>{add.keys}</kbd></button>
    </div>
  );
}
