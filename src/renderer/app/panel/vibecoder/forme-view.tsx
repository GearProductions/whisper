/** forme-view — l'étape Forme, la vue du créateur seul (la Forme n'est plus un arrêt du relecteur : note 0.16.0-revue-essentielle).
 *  La liste des modules, sans code — une ligne par module, son chemin (dossier atténué, nom en gras) et ce qu'il fait en une
 *  phrase (moduleLine de core/vibecoder) ; ni arbre, ni diff, ni Structure · Code, ni badge « touché », ni commits, ni icônes,
 *  ni boutons, ni validation (le ✓ est sur le badge de l'étape), ni commit proposé, ni Poser la forme ; aucun fichier suivi.
 *  Sans note ou sans Forme : une phrase.
 *  Ne connaît pas : le pont (rappels passés), le brouillon de revue. Utilisé par : step-views. */
import { fileParts, moduleLine } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';
import { Invite, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import './forme-view.css';

const fr = {
  noNote: 'Pas encore de note',
  noNoteText: ' La forme s\'écrit dans la note, rubrique « Forme » : rédigez d\'abord la note (étape Note).',
  noForme: 'Pas encore de forme',
  noFormeText: ' L\'agent rédige la rubrique « Forme » de la note (modules, signatures, contrats), sans écrire de code.',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    noNote: 'No note yet',
    noNoteText: ' The shape is written in the note, section « Forme »: write the note first (Note step).',
    noForme: 'No shape yet',
    noFormeText: ' The agent writes the note\'s « Forme » section (modules, signatures, contracts), without writing code.',
  },
};

// La liste, une ligne par module ; sans note ou sans Forme, une phrase (aucun bouton, aucun fichier suivi).
export function FormeView(p: StepProps) {
  const { note, modules, lang } = p.view;
  const s = S[lang];
  return (
    <>
      <StepHead p={p} />
      {note && modules.length ? (
        <ul className="vc-card vc-forme-list">
          {modules.map((m) => {
            const { dir, name } = fileParts(m.path);
            const line = moduleLine(m.contract);
            return (
              <li key={m.path}>
                <span className="vc-fpath vc-mono" title={m.path}><span className="vc-fdir">{dir}</span><b>{name}</b></span>
                {line ? <span className="vc-fsay">{line}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : <Invite title={note ? s.noForme : s.noNote} text={note ? s.noFormeText : s.noNoteText} />}
    </>
  );
}
