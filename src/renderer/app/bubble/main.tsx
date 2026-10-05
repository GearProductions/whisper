/** main — monte la page de la bulle. Premier rendu synchrone (flushSync) :
 *  l'écoute du pont est posée avant le premier message. */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import 'core/ui/scroll.css';
import { BubbleApp } from './bubble-app';
import './bubble.css';

const root = createRoot(document.getElementById('root')!);
flushSync(() => root.render(<BubbleApp bubble={window.bubble} />));
