/* Banc de comparaison de la page de l'appli (la fenêtre de VibeCoder,
   app/panel) : celle d'une version (tag ou branche, v0.14.0 par défaut : la
   première à fenêtre unique) contre celle construite ici (out/). La
   référence est construite dans un worktree git temporaire. Ce script joue le
   principal : mêmes scénarios pour les deux, avec le vrai pont (preload) ; il
   relève chaque message envoyé au principal et capture l'écran à chaque étape
   `shot`. Écart de messages ou d'image : affiché, images dans /tmp/front-diff/.

     npm run test:front-diff -- v0.14.0

   Fenêtre hors écran (rendu offscreen), son coupé, micro factice de
   Chromium : rien ne s'affiche, rien ne s'entend, le vrai micro n'est pas
   ouvert. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { app, BrowserWindow, ipcMain, session } = require('electron');
const scenarios = require('./scenarios.cjs');

const ROOT = path.join(__dirname, '..', '..');
const REF = process.argv.slice(2).find((a) => !a.startsWith('-')) || 'v0.14.0';
const ONLY = process.env.ONLY || '';
const OUT = path.join(os.tmpdir(), 'front-diff');

app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');

// La page de la version de référence : construite dans un worktree git temporaire
// (les sources sont en TypeScript), retiré à la fin.
const refDir = fs.mkdtempSync(path.join(os.tmpdir(), 'front-old-'));
function oldPages() {
  execFileSync('git', ['worktree', 'add', '--detach', refDir, REF], { cwd: ROOT, stdio: 'ignore' });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(refDir, 'node_modules'));
  execFileSync('npm', ['run', 'build'], { cwd: refDir, stdio: 'ignore' });
  return pagesIn(refDir);
}
const removeRef = () => {
  try { execFileSync('git', ['worktree', 'remove', '--force', refDir], { cwd: ROOT, stdio: 'ignore' }); } catch { /* jamais créé */ }
};
const pagesIn = (dir) => ({
  panel: { file: path.join(dir, 'out', 'renderer', 'app', 'panel', 'conversation.html'), preload: path.join(dir, 'out', 'main', 'preload-panel.js') },
});
const newPages = () => pagesIn(ROOT);

// Tous les canaux du pont (cf. src/shared/bridge/channels.ts, PANEL_CHANNELS) : relevés ; ceux qu'on
// invoque répondent selon le scénario.
const SENT = ['conv:ready', 'conv:open', 'conv:resume', 'conv:current', 'conv:attach', 'conv:answer', 'conv:openLink',
  'conv:showFile', 'conv:vibeSet', 'conv:vibeMark', 'conv:vibeDraft', 'conv:vibeOpen', 'conv:vibeRefresh',
  'conv:vibeProcess', 'conv:vibeRunOp', 'conv:vibeFollow', 'dictation:recording', 'config:setDevice', 'tts:cancel',
  'agent:show', 'agent:menu', 'agent:add', 'menu:settings'];
const INVOKED = ['conv:history', 'conv:probe', 'conv:send', 'conv:vibeRun', 'conv:vibeSave', 'conv:vibeDrop',
  'config:get', 'dictation:transcribe', 'conv:speak'];

let run = null; // { log, answers }
const norm = (v) => {
  if (v instanceof ArrayBuffer) return `ArrayBuffer(${v.byteLength > 0 ? '>0' : 0})`;
  if (ArrayBuffer.isView(v)) return `${v.constructor.name}(${v.length})`;
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)]));
  return v;
};
for (const ch of SENT) {
  ipcMain.on(ch, (_e, ...args) => { if (run) run.log.push([ch, ...norm(args)]); });
}
for (const ch of INVOKED) {
  ipcMain.handle(ch, (_e, ...args) => {
    if (!run) return null;
    run.log.push([ch, ...norm(args)]);
    const a = run.answers[ch];
    return typeof a === 'function' ? a(...args) : a;
  });
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const NO_MOTION = '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }';

async function play(pages, sc) {
  const p = pages.panel;
  const [width, height] = sc.size;
  const win = new BrowserWindow({
    width, height, show: false, frame: false, backgroundColor: '#1c1f25',   // le fond du thème (--vc-bg)
    webPreferences: { preload: p.preload, contextIsolation: true, sandbox: true, offscreen: true },
  });
  win.webContents.setAudioMuted(true);
  win.webContents.setFrameRate(30);
  const shots = [];
  const errors = [];
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) errors.push(message); });
  run = { log: [], answers: { ...DEFAULT_ANSWERS, ...(sc.answers || {}) } };
  win.webContents.on('render-process-gone', (_e, d) => errors.push(`rendu arrêté : ${d.reason}`));
  win.webContents.on('did-fail-load', (_e, code, desc, url) => errors.push(`chargement : ${code} ${desc} ${url}`));
  await win.loadFile(p.file, sc.query ? { query: sc.query } : undefined).catch((e) => errors.push(e.message));
  if (win.isDestroyed()) return { log: run.log, shots: [], errors };
  await win.webContents.insertCSS(NO_MOTION);
  await delay(150);
  const js = (code) => win.webContents.executeJavaScript(code);
  for (const [op, ...a] of sc.steps) {
    if (op === 'emit') win.webContents.send(...a);
    else if (op === 'wait') await delay(a[0]);
    else if (op === 'click') await js(`(() => { const el = document.querySelector(${JSON.stringify(a[0])}); if (!el) throw new Error('absent : ' + ${JSON.stringify(a[0])}); el.click(); })()`);
    else if (op === 'menu') await js(`document.querySelector(${JSON.stringify(a[0])}).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))`);
    else if (op === 'type') {
      await js(`(() => { const el = document.querySelector(${JSON.stringify(a[0])}); el.focus();
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(a[1])});
        el.setSelectionRange(el.value.length, el.value.length);
        el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    } else if (op === 'key') {
      await js(`document.querySelector(${JSON.stringify(a[0])}).dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(a[1])}, bubbles: true, cancelable: true }))`);
    } else if (op === 'pointer') {
      await js(`document.querySelector(${JSON.stringify(a[0])}).dispatchEvent(new PointerEvent(${JSON.stringify(a[1])}, { bubbles: true, cancelable: true }))`);
    } else if (op === 'mouse') win.webContents.sendInputEvent({ type: a[0], x: a[1], y: a[2], button: 'left', clickCount: 1 });
    else if (op === 'eval') run.log.push(['eval', a[0], await js(a[0])]);
    else if (op === 'shot') { await delay(120); shots.push([a[0], await win.webContents.capturePage()]); }
    else throw new Error(`étape inconnue : ${op}`);
    await delay(40);
  }
  await delay(100);
  const log = run.log;
  run = null;
  win.destroy();
  return { log, shots, errors };
}

const DEFAULT_ANSWERS = {
  'config:get': { lang: 'fr', vocabulary: '', sound: true, deviceId: '', deviceLabel: '' },
  'dictation:transcribe': { ok: true, text: 'bonjour' },
  'conv:speak': { ok: true, id: 1 },
  'conv:history': [],
  'conv:probe': { error: 'Aucun agent.' },
  'conv:send': { ok: true },
  'conv:vibeRun': { ok: true },
  'conv:vibeSave': { ok: true },
  'conv:vibeDrop': { ok: true },
};

// Pixels qui diffèrent (au-delà d'un léger écart d'anticrénelage).
function diffPixels(a, b) {
  const sa = a.getSize(); const sb = b.getSize();
  if (sa.width !== sb.width || sa.height !== sb.height) return Infinity;
  const x = a.toBitmap(); const y = b.toBitmap();
  let n = 0;
  for (let i = 0; i < x.length; i += 4) {
    if (Math.abs(x[i] - y[i]) > 24 || Math.abs(x[i + 1] - y[i + 1]) > 24 || Math.abs(x[i + 2] - y[i + 2]) > 24 || Math.abs(x[i + 3] - y[i + 3]) > 24) n++;
  }
  return n;
}

// Une fenêtre détruite entre deux scénarios ne doit pas quitter l'appli.
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  // Comme le principal : le micro, et seulement lui, pour nos pages.
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  let before;
  try { before = oldPages(); } catch (e) { console.error(`référence ${REF} : construction impossible (${e.message})`); removeRef(); app.exit(2); return; }
  const after = newPages();
  let failures = 0;
  for (const sc of scenarios.filter((s) => !ONLY || s.name.includes(ONLY))) {
    const a = await play(before, sc);
    const b = await play(after, sc);
    const problems = [];
    const la = JSON.stringify(a.log, null, 1);
    // Écarts voulus, déclarés par le scénario (`newOnly`) : messages que seule la
    // version courante envoie.
    const extra = (sc.newOnly || []).map((m) => JSON.stringify(m));
    const lb = JSON.stringify(b.log.filter((m) => !extra.includes(JSON.stringify(m))), null, 1);
    if (la !== lb) {
      problems.push('messages différents');
      fs.writeFileSync(path.join(OUT, `${sc.name}.old.json`), la);
      fs.writeFileSync(path.join(OUT, `${sc.name}.new.json`), lb);
    }
    if (a.errors.length) problems.push(`erreurs (référence) : ${a.errors.join(' | ')}`);
    if (b.errors.length) problems.push(`erreurs : ${b.errors.join(' | ')}`);
    a.shots.forEach(([name, img], i) => {
      const n = diffPixels(img, b.shots[i][1]);
      if (n > (sc.tolerance || 0)) {
        problems.push(`${name} : ${n} pixels`);
        fs.writeFileSync(path.join(OUT, `${sc.name}-${name}.old.png`), img.toPNG());
        fs.writeFileSync(path.join(OUT, `${sc.name}-${name}.new.png`), b.shots[i][1].toPNG());
      }
    });
    if (problems.length) failures++;
    console.log(`${problems.length ? '✗' : '✓'} ${sc.name}${problems.length ? ` — ${problems.join(' ; ')}` : ''}`);
  }
  console.log(failures ? `\n${failures} scénario(s) différent(s) : ${OUT}` : '\nIdentique à la référence.');
  removeRef();
  app.exit(failures ? 1 : 0);
});
