// @vitest-environment happy-dom
// Invariant du fil de la conversation (note 0.13.0,
// docs/tickets/feat/0.13.0-ameliorations-interface.md, « Ce que ça ne doit
// pas faire ») : « Rendre en HTML le texte d'un message de l'agent, ou ouvrir
// un lien qui n'est pas http(s), en le passant en Markdown » — I-40 étendu au
// fil (VibeCoder et mode conversation), I-21. Un message de l'agent rendu en
// Markdown : une balise reste du texte ; seul un lien http(s) s'ouvre, dans
// le navigateur (le rappel openLink).
// Le Markdown lui-même (parseMarkdown) : core/vibecoder/tests/invariants.
// Protégé : si un test échoue, corriger le code.
//
// Le vrai fil (ThreadContent), monté par React (createRoot) dans une page
// happy-dom ; ce que la page affiche : le conteneur ; les liens ouverts : ce
// que reçoit openLink. Chaque message porte du gras : témoin qu'il est bien
// rendu en Markdown (les ** ne s'affichent plus).
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ThreadContent, type ThreadActions } from 'app/panel/components';
import type { Thread } from 'technicals/bridge';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
afterEach(() => {
  act(() => { for (const r of roots.splice(0)) r.unmount(); });
  document.body.replaceChildren();
});

// Une ancienne conversation, en entier, faite d'un seul message de l'agent.
const agentSays = (text: string): Thread => ({
  mode: 'full', key: 'k', live: false, name: 'Agent', color: '#888888', title: 'Conversation', status: 'idle',
  messages: [{ role: 'assistant', text, time: 0 }],
});

// Le fil affiché ; `opened` relève les adresses que la page demande d'ouvrir.
async function shown(data: Thread) {
  const opened: string[] = [];
  const actions: ThreadActions = {
    openLink: (url) => { opened.push(url); }, showFile: () => {}, listen: () => {},
    copy: async () => true, zoom: () => {}, answer: () => true,
  };
  const page = document.createElement('div');
  // La page de test ne suit aucun lien : on n'observe que ce que le fil demande d'ouvrir.
  page.addEventListener('click', (e) => e.preventDefault(), true);
  document.body.append(page);
  const root = createRoot(page);
  roots.push(root);
  await act(async () => { root.render(createElement(ThreadContent, { data, act: actions })); });
  return { page, opened };
}

// Un clic sur chaque élément affiché, du plus profond au plus haut.
async function clickEverything(page: HTMLElement) {
  for (const el of [...page.querySelectorAll('*')].reverse()) {
    await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  }
}

// Le plus profond des éléments qui affichent exactement ce texte.
const showing = (page: HTMLElement, text: string) =>
  [...page.querySelectorAll('*')].reverse().find((el) => el.textContent === text);

// Les éléments qui pointent ailleurs qu'en http(s).
const notHttpTargets = (page: HTMLElement) =>
  [...page.querySelectorAll('[href], [src], [action], [formaction]')]
    .filter((el) => !/^https?:\/\//i.test(el.getAttribute('href') ?? el.getAttribute('src') ?? el.getAttribute('action') ?? el.getAttribute('formaction') ?? ''));

const SCRIPT = '<script>alert(1)</script>';
const IMG = '<img src=x onerror=alert(1)>';

describe('un message de l’agent : une balise reste du texte', () => {
  // Une balise au milieu d'un paragraphe.
  it('un <script> dans un paragraphe reste du texte', async () => {
    const { page } = await shown(agentSays(`Un paragraphe **gras** ${SCRIPT} fin.`));

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // la balise est affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
    // témoin : le message est rendu en Markdown
    expect(page.textContent).not.toContain('**');
  });

  // Une balise dans un titre.
  it('un <img onerror> dans un titre reste du texte', async () => {
    const { page } = await shown(agentSays(`## Titre ${IMG}\n\nDu **gras**.`));

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // la balise est affichée, en texte
    expect(page.textContent).toContain(IMG);
    // témoin : le message est rendu en Markdown
    expect(page.textContent).not.toContain('**');
  });

  // Une balise dans un élément de liste.
  it('un <img onerror> dans un élément de liste reste du texte', async () => {
    const { page } = await shown(agentSays(`- un **élément** ${IMG}\n- un autre`));

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // la balise est affichée, en texte
    expect(page.textContent).toContain(IMG);
    // témoin : le message est rendu en Markdown
    expect(page.textContent).not.toContain('**');
  });

  // Une balise entre accents graves.
  it('un <script> dans du code en ligne reste du texte', async () => {
    const { page } = await shown(agentSays(`Du **code** \`${SCRIPT}\` en ligne.`));

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // la balise est affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
    // témoin : le message est rendu en Markdown
    expect(page.textContent).not.toContain('**');
  });

  // Une balise dans un bloc ``` annoncé comme du HTML.
  it('un <img onerror> dans un bloc de code reste du texte', async () => {
    const { page } = await shown(agentSays(`Un **bloc** :\n\n\`\`\`html\n${IMG}\n\`\`\``));

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // la balise est affichée, en texte
    expect(page.textContent).toContain(IMG);
    // témoin : le message est rendu en Markdown
    expect(page.textContent).not.toContain('**');
  });

  // Markdown reconnaît un bloc HTML : il n'est pas rendu pour autant.
  it('un bloc HTML seul sur ses lignes reste du texte', async () => {
    const { page } = await shown(agentSays(`**Avant.**\n\n<div onclick="alert(1)">\n${IMG}\n</div>\n\nAprès.`));

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // aucun élément ne porte le onclick écrit dans le message
    expect(page.querySelector('[onclick]')).toBeNull();
    // la balise est affichée, en texte
    expect(page.textContent).toContain(IMG);
    // témoin : le message est rendu en Markdown
    expect(page.textContent).not.toContain('**');
  });

  // Une balise à la place du texte d'un lien.
  it('un <img onerror> dans le texte d’un lien reste du texte', async () => {
    const { page } = await shown(agentSays(`Voir [${IMG}](https://exemple.fr) en **gras**.`));

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // la balise est affichée, en texte
    expect(page.textContent).toContain(IMG);
    // témoin : le message est rendu en Markdown
    expect(page.textContent).not.toContain('**');
  });

  // Une adresse http(s) qui tente de fermer l'attribut pour ouvrir une balise.
  it('une balise glissée dans l’adresse d’un lien ne produit aucun élément', async () => {
    const { page } = await shown(agentSays(`Voir [doc](https://exemple.fr/"><img src=x onerror=alert(1)>) en **gras**.`));

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : le message est rendu en Markdown
    expect(page.textContent).not.toContain('**');
  });
});

describe('un message de l’agent : seul un lien http(s) s’ouvre', () => {
  // Un lien javascript:.
  it('[clic](javascript:…) n’ouvre rien', async () => {
    const { page, opened } = await shown(agentSays('Voir [clic](javascript:alert(1)) en **gras**.'));

    await clickEverything(page);

    // aucune adresse demandée à l'ouverture
    expect(opened).toEqual([]);
    // aucun élément ne pointe vers elle
    expect(notHttpTargets(page)).toEqual([]);
    // témoin : le texte du lien est affiché
    expect(page.textContent).toContain('clic');
    // témoin : le message est rendu en Markdown
    expect(page.textContent).not.toContain('**');
  });

  // La casse ne change rien.
  it('[clic](JaVaScRiPt:…) n’ouvre rien', async () => {
    const { page, opened } = await shown(agentSays('Voir [clic](JaVaScRiPt:alert(1)) en **gras**.'));

    await clickEverything(page);

    // aucune adresse demandée à l'ouverture
    expect(opened).toEqual([]);
    // aucun élément ne pointe vers elle
    expect(notHttpTargets(page)).toEqual([]);
    // témoin : le texte du lien est affiché
    expect(page.textContent).toContain('clic');
    // témoin : le message est rendu en Markdown
    expect(page.textContent).not.toContain('**');
  });

  // Un lien data: qui porte une page.
  it('[clic](data:…) n’ouvre rien', async () => {
    const { page, opened } = await shown(agentSays(`Voir [clic](data:text/html,${SCRIPT}) en **gras**.`));

    await clickEverything(page);

    // aucune adresse demandée à l'ouverture
    expect(opened).toEqual([]);
    // aucun élément ne pointe vers elle
    expect(notHttpTargets(page)).toEqual([]);
    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : le message est rendu en Markdown
    expect(page.textContent).not.toContain('**');
  });

  // Un lien vers un fichier local.
  it('[clic](file:…) n’ouvre rien', async () => {
    const { page, opened } = await shown(agentSays('Voir [clic](file:///home/x/script.sh) en **gras**.'));

    await clickEverything(page);

    // aucune adresse demandée à l'ouverture
    expect(opened).toEqual([]);
    // aucun élément ne pointe vers elle
    expect(notHttpTargets(page)).toEqual([]);
    // témoin : le texte du lien est affiché
    expect(page.textContent).toContain('clic');
    // témoin : le message est rendu en Markdown
    expect(page.textContent).not.toContain('**');
  });

  // Un lien vbscript:.
  it('[clic](vbscript:…) n’ouvre rien', async () => {
    const { page, opened } = await shown(agentSays('Voir [clic](vbscript:msgbox) en **gras**.'));

    await clickEverything(page);

    // aucune adresse demandée à l'ouverture
    expect(opened).toEqual([]);
    // aucun élément ne pointe vers elle
    expect(notHttpTargets(page)).toEqual([]);
    // témoin : le texte du lien est affiché
    expect(page.textContent).toContain('clic');
    // témoin : le message est rendu en Markdown
    expect(page.textContent).not.toContain('**');
  });

  // Une adresse sans protocole prendrait celui de la page.
  it('[clic](//hôte) n’ouvre rien', async () => {
    const { page, opened } = await shown(agentSays('Voir [clic](//evil.example/x) en **gras**.'));

    await clickEverything(page);

    // aucune adresse demandée à l'ouverture
    expect(opened).toEqual([]);
    // aucun élément ne pointe vers elle
    expect(notHttpTargets(page)).toEqual([]);
    // témoin : le texte du lien est affiché
    expect(page.textContent).toContain('clic');
    // témoin : le message est rendu en Markdown
    expect(page.textContent).not.toContain('**');
  });

  // Témoin du cas permis : sans lui, un fil qui n'ouvre rien passerait les cas ci-dessus.
  it('[doc](https://…) s’ouvre par openLink, à son adresse', async () => {
    const { page, opened } = await shown(agentSays('Voir [doc](https://exemple.fr/x) en **gras**.'));
    const link = showing(page, 'doc');

    await act(async () => { link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });

    // l'adresse écrite, et elle seule, est demandée à l'ouverture
    expect(opened).toEqual(['https://exemple.fr/x']);
    // témoin : le message est rendu en Markdown
    expect(page.textContent).not.toContain('**');
  });
});
