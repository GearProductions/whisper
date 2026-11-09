// Le faux d'Electron : des fenêtres qui relèvent ce qu'on leur envoie, des boîtes de dialogue qui relèvent
// ce qu'on leur demande et répondent ce que le cas décide, le reste inerte.
// Ne connaît pas : le principal (il n'importe rien de l'appli), ce que vérifient les tests.
// Utilisé par : le barrel (harness) ; app.ts (les fenêtres).
import { current } from './profile';

type Handler = (...a: unknown[]) => void;
type IpcHandler = (e: { sender: unknown }, ...a: unknown[]) => unknown;

export class FakeWin {
  sent: [string, unknown][] = [];   // [canal, charge] de chaque webContents.send
  handlers = new Map<string, Handler[]>();
  visible = false;
  webContents = {
    send: (ch: string, payload?: unknown) => { this.sent.push([ch, payload]); },
    on: () => {}, once: () => {}, setWindowOpenHandler: () => {},
  };
  on(ev: string, fn: Handler) { this.handlers.set(ev, [...(this.handlers.get(ev) || []), fn]); return this; }
  once(ev: string, fn: Handler) { return this.on(ev, fn); }
  emit(ev: string) { for (const fn of this.handlers.get(ev) || []) fn(); }
  loadFile() {} setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} setResizable() {} setBounds() {}
  getBounds() { return { x: 500, y: 500, width: 64, height: 64 }; }
  isVisible() { return this.visible; } isDestroyed() { return false; } isMinimized() { return false; }
  isFocused() { return this.visible; }
  show() { this.visible = true; } showInactive() { this.visible = true; } hide() { this.visible = false; }
  focus() { this.emit('focus'); } restore() {} minimize() { this.visible = false; }
}

// dialog : `asked` reçoit le dernier argument (les options) de chaque boîte montrée ; `answer` choisit le
// bouton (0 : Annuler, d'ordinaire) ; `pick` est ce que rend « ouvrir un fichier », `picks` ses options.
export type DialogFake = {
  asked: unknown[]; answer: (box: any) => number; picks: unknown[]; pick: { canceled: boolean; filePaths: string[] };
};
export type ElectronFake = {
  module: Record<string, unknown>;
  windows: FakeWin[];
  dialog: DialogFake;
  ipc: Map<string, IpcHandler>;                                              // les gestionnaires posés sur ipcMain
  schemes: Map<string, (req: Request) => Response | Promise<Response>>;     // ceux posés sur protocol.handle
};

let active: ElectronFake | null = null;
// Les fenêtres du faux d'Electron en place (pour openPanel).
export const windows = () => active!.windows;

// `extra` complète ou remplace un export (`app` est fusionné : { app: { isPackaged: true } }).
export function fakeElectron(extra: { app?: object } & Record<string, unknown> = {}): ElectronFake {
  const { app: appExtra, ...rest } = extra;
  const wins: FakeWin[] = [];
  const dialog: DialogFake = { asked: [], answer: () => 0, picks: [], pick: { canceled: true, filePaths: [] } };
  const ipc = new Map<string, IpcHandler>();
  const schemes = new Map<string, (req: Request) => Response | Promise<Response>>();
  const ask = (...a: unknown[]) => { dialog.asked.push(a.at(-1)); return a.at(-1); };
  const module = {
    app: { getPath: () => current.dir, getAppMetrics: () => [], getVersion: () => '0.0.0', quit: () => {}, ...appExtra },
    BrowserWindow: class extends FakeWin { constructor() { super(); wins.push(this); } },
    screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
    ipcMain: {
      on: (ch: string, fn: IpcHandler) => { ipc.set(ch, fn); },
      handle: (ch: string, fn: IpcHandler) => { ipc.set(ch, fn); },
    },
    protocol: {
      registerSchemesAsPrivileged: () => {},
      handle: (scheme: string, fn: (req: Request) => Response | Promise<Response>) => { schemes.set(scheme, fn); },
    },
    dialog: {
      showMessageBox: async (...a: unknown[]) => ({ response: dialog.answer(ask(...a)) }),
      showMessageBoxSync: (...a: unknown[]) => dialog.answer(ask(...a)),
      showErrorBox: (...a: unknown[]) => { ask(...a); },
      showOpenDialog: async (...a: unknown[]) => { dialog.picks.push(a.at(-1)); return dialog.pick; },
    },
    Menu: { buildFromTemplate: () => ({ popup: () => {} }), setApplicationMenu: () => {} },
    Notification: class { static isSupported() { return false; } on() {} show() {} },
    shell: { openPath: async () => '', openExternal: async () => {}, showItemInFolder: () => {} },
    clipboard: {}, nativeImage: {},
    ...rest,
  };
  current.resets.push(() => {
    wins.length = 0; dialog.asked.length = 0; dialog.picks.length = 0; ipc.clear(); schemes.clear();
    dialog.answer = () => 0; dialog.pick = { canceled: true, filePaths: [] };
  });
  return (active = { module, windows: wins, dialog, ipc, schemes });
}
