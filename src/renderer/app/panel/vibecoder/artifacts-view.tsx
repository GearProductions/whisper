/** artifacts-view — le panneau Artefacts (F-94, F-95), les deux cases de
 *  gauche et du centre de l'écran (.vc-journey, .vc-center : vibe-coder le met
 *  à la place du parcours et de l'étape). À gauche la liste (nom, taille ;
 *  vide → ce que le skill fait, en une ligne) ; au centre l'artefact choisi :
 *  markdown → MarkdownView, text → CodeView en lecture seule (le texte reçu
 *  par `code`, VibeCode de son id), « fichier tronqué » si truncated ; page →
 *  <iframe sandbox> (attribut vide : ni script, ni réseau) sur url ; media →
 *  <iframe> sur url ; en tête, Ouvrir dans l'éditeur (onOpen) et Copier dans
 *  le projet (onCopy). Le choix, état local, tenu par le nom (les ids a<i>
 *  glissent quand la liste change) : le premier par défaut, disparu → le
 *  premier ; chaque id choisi, par défaut compris, est annoncé par onChoose
 *  (vibe-coder suit son texte). Un lien d'un Markdown ne mène nulle part (pas
 *  de rappel pour l'ouvrir). Libellés : core/vibecoder (t, fileSize).
 *  Ne connaît pas : le pont (rappels passés), le disque, le schéma (url reçue).
 *  Utilisé par : vibe-coder. */
import { useEffect, useRef, useState } from 'react';
import { fileSize, t as strings } from 'core/vibecoder';
import type { VibeArtifact, VibeCode, VibeLang } from 'technicals/bridge';
import { CodeView } from './code-view';
import { MarkdownView } from './markdown-view';
import './artifacts-view.css';

export type ArtifactsViewProps = {
  artifacts: VibeArtifact[];
  lang: VibeLang;
  code: VibeCode | null;          // le texte de l'artefact choisi (VibeCode de son id)
  onChoose: (id: string) => void;
  onOpen: (id: string) => void;
  onCopy: (id: string) => void;
};

const noLink = () => {};

export function ArtifactsView({ artifacts, lang, code, onChoose, onOpen, onCopy }: ArtifactsViewProps) {
  const t = strings(lang);
  const [chosen, setChosen] = useState<string | null>(null);
  const art = artifacts.find((a) => a.name === chosen) ?? artifacts[0];
  const id = art?.id ?? null;

  // L'id choisi annoncé une fois par changement (par défaut, au repli ou au clic).
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!id || id === sent.current) return;
    sent.current = id;
    onChoose(id);
  }, [id]);

  const text = art && code?.id === art.id ? code : null;
  return (
    <>
      <nav className="vc-journey scroll" aria-label={t.artifacts}>
        <div className="vc-side-title vc-band"><span>{t.artifacts}</span><span>{artifacts.length || ''}</span></div>
        <ul className="vc-art-list">
          {artifacts.length ? artifacts.map((a) => (
            <li key={a.name}>
              <button type="button" className="vc-art-item" aria-current={a === art || undefined} title={a.name}
                onClick={() => setChosen(a.name)}>
                <span>{a.name}</span><small>{fileSize(a.size, lang)}</small>
              </button>
            </li>
          )) : <li className="vc-art-none">{t.artifactsNone}</li>}
        </ul>
      </nav>
      <section className="vc-center">
        {art ? (
          <div className="vc-art" key={art.name}>
            <div className="vc-step-head vc-art-head">
              <h2 className="vc-mono" title={art.name}>{art.name}</h2>
              <span className="vc-art-size">{fileSize(art.size, lang)}</span>
              <button type="button" className="vc-mini" onClick={() => onOpen(art.id)}>{t.openTitle}</button>
              <button type="button" className="vc-mini" title={t.artifactCopyTitle} onClick={() => onCopy(art.id)}>{t.artifactCopy}</button>
            </div>
            {art.kind === 'page' && art.url ? <iframe className="vc-art-frame" sandbox="" src={art.url} title={art.name} />
              : art.kind === 'media' && art.url ? <iframe className="vc-art-frame" src={art.url} title={art.name} />
              : !text ? null
              : text.text === null ? <div className="vc-pr-hint">{t.artifactUnreadable}</div>
              : (
                <>
                  {text.truncated || art.truncated ? <div className="vc-art-cut" role="status">{t.artifactTruncated}</div> : null}
                  {art.kind === 'markdown'
                    ? <div className="vc-art-md scroll"><MarkdownView md={text.text} t={t} onOpenLink={noLink} /></div>
                    : <CodeView code={text.text} path={art.name} t={t} />}
                </>
              )}
          </div>
        ) : null}
      </section>
    </>
  );
}
