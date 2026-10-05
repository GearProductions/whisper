/** main — monte la page du panneau. Premier rendu synchrone (flushSync) : les
 *  écoutes du pont sont posées avant de dire au principal que la page est prête. */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import '../shared/scroll.css';
import './conversation.css';
import { PanelApp } from './PanelApp';

const root = createRoot(document.getElementById('root')!);
flushSync(() => root.render(<PanelApp conv={window.conv} />));
