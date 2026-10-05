/** linkified — un texte avec ses liens cliquables. Un clic appelle onOpen(url)
 *  (le principal ouvre le navigateur) : la page ne navigue jamais.
 *  Ne connaît pas : les ponts. Utilisé par : app/panel (thread). */
import { splitLinks } from 'core/links';

export function Linkified({ text, onOpen }: { text: string; onOpen: (url: string) => void }) {
  return (
    <>
      {splitLinks(text).map((s, i) => (s.url ? (
        <a key={i} href={s.url} title={s.url}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpen(s.url!); }}>{s.text}</a>
      ) : s.text))}
    </>
  );
}
