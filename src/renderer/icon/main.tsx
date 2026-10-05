/** main — monte la page de l'icône. Premier rendu synchrone (flushSync) : les
 *  écoutes du pont sont posées avant que le principal envoie le premier état. */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { IconApp } from './IconApp';
import './style.css';

// Taille configurée de l'icône : toute la mise en page s'y rapporte (cf. style.css).
document.documentElement.style.setProperty('--s', `${Number(new URLSearchParams(location.search).get('size')) || 64}px`);

const root = createRoot(document.getElementById('root')!);
flushSync(() => root.render(<IconApp api={window.api} />));
