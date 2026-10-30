/** artifacts-view — le panneau Artefacts (F-94, F-95), au centre de l'écran
 *  (.vc-art-side, .vc-center : vibe-coder le met à la place du fil d'Ariane
 *  et de l'étape). À gauche la liste (nom, taille ;
 *  vide → ce que le skill fait, en une ligne) ; au centre l'artefact choisi :
 *  markdown → MarkdownView, text → CodeView en lecture seule (le texte reçu
 *  par `code`, VibeCode de son id), « fichier tronqué » si truncated ; page →
 *  <iframe sandbox> (attribut vide : ni script, ni réseau) sur url ; media →
 *  <iframe> sur url ; en tête, Ouvrir dans l'éditeur (onOpen, IconButton open)
 *  et Copier dans le projet (onCopy, en texte). Le choix, état local, tenu par le nom (les ids a<i>
 *  glissent quand la liste change) : le premier par défaut, disparu → le
 *  premier ; chaque id choisi, par défaut compris, est annoncé par onChoose
 *  (vibe-coder suit son texte). Un lien d'un Markdown ne mène nulle part (pas
 *  de rappel pour l'ouvrir). Sous la liste : la zone de dépôt (data-own-drop :
 *  panel-app n'envoie pas à la conversation ce qui y tombe ; seuls des File
 *  remontent, par onDrop), Ajouter (onAdd, désactivé tant que adding) et la
 *  dernière ligne (« … » en cours, sinon added.line, rien si vide : dialogue
 *  annulé). Libellés : core/vibecoder (t, fileSize).
 *  Ne connaît pas : le pont (rappels passés), le disque, le schéma (url reçue).
 *  Utilisé par : vibe-coder. */
import { useEffect, useRef, useState } from 'react';
import { fileSize, t as strings } from 'core/vibecoder';
import type { VibeArtifact, VibeCode, VibeLang } from 'technicals/bridge';
import { CodeView } from './code-view';
import { Icon, IconButton } from './icons';
import { MarkdownView } from './markdown-view';
import './artifacts-view.css';

export type ArtifactsViewProps = {
  artifacts: VibeArtifact[];
  lang: VibeLang;
  code: VibeCode | null;          // le texte de l'artefact choisi (VibeCode de son id)
  onChoose: (id: string) => void;
  onOpen: (id: string) => void;
  onCopy: (id: string) => void;
  adding?: boolean;                                   // un ajout en cours
  added?: { ok: boolean; line: string } | null;       // le dernier ajout (line vide : dialogue annulé)
  onAdd?: () => void;
  onDrop?: (files: File[]) => void;
};

const noLink = () => {};

export function ArtifactsView({ artifacts, lang, code, onChoose, onOpen, onCopy, adding, added, onAdd, onDrop }: ArtifactsViewProps) {
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
      <nav className="vc-art-side scroll" aria-label={t.artifacts}>
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
        <div className="vc-art-drop" data-own-drop
          onDrop={(e) => { const files = [...e.dataTransfer.files]; if (files.length) onDrop?.(files); }}>
          {t.artifactDrop}
        </div>
        <div className="vc-art-add vc-direct">
          <button type="button" className="vc-mini" title={t.artifactAddTitle} disabled={adding} onClick={onAdd}>{t.artifactAdd}</button>
          {adding ? <span className="vc-direct-res" data-state="running">…</span>
            : added?.line ? <span className="vc-direct-res" data-state={added.ok ? 'ok' : 'ko'} title={added.line}><span className="vc-direct-mark"><Icon name={added.ok ? 'ok' : 'ko'} /></span> {added.line}</span> : null}
        </div>
      </nav>
      <section className="vc-center">
        {art ? (
          <div className="vc-art" key={art.name}>
            <div className="vc-step-head vc-art-head">
              <h2 className="vc-mono" title={art.name}>{art.name}</h2>
              <span className="vc-art-size">{fileSize(art.size, lang)}</span>
              <IconButton icon="open" label={t.openTitle} onClick={() => onOpen(art.id)} />
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
