/** thread — le fil : messages (heure, texte avec liens et blocs de code,
 *  actions de l'agent, pièces jointes, Écouter, Copier), demande
 *  d'autorisation, agent au travail.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : panel-app. */
import { useEffect, useState } from 'react';
import { baseName, isBusy, kindOf, visibleFrom } from 'core/conversation';
import { Linkified } from 'core/ui';
import { clock, elapsed, fullDate } from 'helpers';
import type { Decision, Message, Thread as ThreadData } from 'technicals/bridge';
import { PermissionCard } from './permission-card';

export type ThreadActions = {
  openLink(url: string): void;
  showFile(file: string): void;
  listen(index: number): void;
  copy(): Promise<boolean>;
  zoom(src: string): void;
  answer(decision: Decision, key: number): boolean;
};

// Le texte tel quel, liens cliquables ; seuls les blocs ``` deviennent des blocs de code.
function Body({ text, openLink }: { text: string; openLink(url: string): void }) {
  return (
    <div className="body" hidden={!text}>
      {String(text || '').split('```').map((part, i) => (i % 2 === 0
        ? (part ? <Linkified key={i} text={part.replace(/^\n+|\n+$/g, i ? '\n' : '')} onOpen={openLink} /> : null)
        : <pre key={i}>{part.replace(/^[\w+-]*\n/, '').replace(/\n$/, '')}</pre>))}
    </div>
  );
}

// Ce que l'agent a fait pendant le tour. Au-delà de TOOLS_SHOWN actions, les
// dernières seulement ; les autres, à déplier.
const TOOLS_SHOWN = 6;
function Tools({ tools }: { tools: string[] }) {
  const line = (t: string, i: number) => <div key={i}>{t}</div>;
  if (tools.length <= TOOLS_SHOWN) return <div className="tools">{tools.map(line)}</div>;
  return (
    <div className="tools">
      <details>
        <summary>{`${tools.length - TOOLS_SHOWN} actions de plus`}</summary>
        {tools.slice(0, -TOOLS_SHOWN).map(line)}
      </details>
      {tools.slice(-TOOLS_SHOWN).map((t, i) => line(t, tools.length - TOOLS_SHOWN + i))}
    </div>
  );
}

function who(m: Message, data: ThreadData) {
  if (data.dictation) return 'Texte dicté';
  if (m.role === 'user') return 'Vous';
  if (m.role === 'system') return m.kind === 'compact' ? 'Contexte compacté' : 'Sortie de la commande';
  return data.name;
}

function MessageView({ m, index, data, act }: { m: Message; index: number; data: ThreadData; act: ThreadActions }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [m.text, m.time]); // une nouvelle dictée : à copier
  const body = <Body text={m.text} openLink={act.openLink} />;
  return (
    <article className={`message ${m.role}`}>
      <div className="who">
        {who(m, data)}
        {m.time ? <time title={fullDate(m.time)}>{clock(m.time)}</time> : null}
      </div>
      {/* Le résumé laissé par une compaction : long, à déplier. */}
      {m.kind === 'compact' ? <details><summary>Résumé de la conversation précédente</summary>{body}</details> : null}
      <Tools tools={m.tools || []} />
      {m.kind === 'compact' ? null : body}
      <details className="context" hidden={!m.context}>
        <summary>{m.context ? `Texte sélectionné joint (${m.context.length.toLocaleString('fr-FR')} caractères)` : ''}</summary>
        <pre>{m.context}</pre>
      </details>
      {/* Images (aperçus, clic : en grand) et fichiers (clic : dans le gestionnaire de fichiers). */}
      <div className="attachments">
        {(m.images || []).map((src, i) => <img key={`i${i}`} src={src} alt="Image jointe" title="Agrandir" onClick={() => act.zoom(src)} />)}
        {(m.files || []).map((file, i) => (
          <button key={`f${i}`} type="button" className="file" title={`${file}\n(clic : montrer dans le gestionnaire de fichiers)`}
            onClick={() => act.showFile(file)}>
            <span>{kindOf(file)}</span><span className="file-name">{baseName(file)}</span>
          </button>
        ))}
      </div>
      <button className="listen" type="button" hidden={m.role !== 'assistant' || !m.audio} onClick={() => act.listen(index)}>▶ Écouter</button>
      <button className="copy" type="button" title="Copier ce texte (pour le coller dans le champ d'un agent, par exemple)"
        onClick={async () => { if (await act.copy()) setCopied(true); }}>{copied ? 'Copié ✓' : 'Copier'}</button>
    </article>
  );
}

// L'agent au travail (ou qui attend une autorisation), au bas du fil.
function Working({ data }: { data: ThreadData }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!data.since) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [data.since]);
  return (
    <div className="working" data-status={data.status}>
      <span className="dots"><i /><i /><i /></span>
      <span className="what">{data.status === 'asking' ? `${data.name} attend votre autorisation` : `${data.name} travaille`}</span>
      <span className="elapsed">{data.since ? elapsed(Date.now() - data.since) : ''}</span>
    </div>
  );
}

export const showsWorking = (data: ThreadData) => data.live && !data.permission && isBusy(data.status);

// Les enfants de #thread, pour une conversation. Monté de nouveau quand elle change
// (clé) : ses <details> repartent fermés.
export function ThreadContent({ data, act }: { data: ThreadData; act: ThreadActions }) {
  const from = visibleFrom(data.messages, data.mode);
  return (
    <>
      {data.messages.map((m, index) => (index >= from ? <MessageView key={index} m={m} index={index} data={data} act={act} /> : null))}
      {data.dictation && !data.messages.length
        ? <div className="hint">Maintenez l'icône pour dicter : le texte s'affichera ici.</div> : null}
      {/* L'agent demande une autorisation : elle se valide ici, au bas du fil. */}
      {data.permission ? <PermissionCard key={data.permission.key} permission={data.permission}
        onAnswer={(d) => act.answer(d, data.permission!.key)} /> : null}
      {showsWorking(data) ? <Working data={data} /> : null}
    </>
  );
}
