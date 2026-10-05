# AGENTS.md

## Commandes (dans la box `dev`)

- Lancer : `npm start` (construit les pages puis lance Electron)
- Typage : `npm run typecheck` · Tests : `npm test` · invariants seuls :
  `npm run test:invariants`
- Comparer les pages à une version : `npm run test:front-diff -- v0.4.0`
- Paquets : `npm run dist:linux`, `npm run dist:win`

## Règles d'architecture

- Comportement attendu : `SPEC.md`. Un changement de comportement met à jour
  `SPEC.md` et le README.
- Les pages (`src/renderer/`) ne parlent au principal que par leur pont
  (`src/*preload.js`, typé dans `src/renderer/bridge.d.ts`). Dans chaque page,
  un seul fichier connaît le pont : `IconApp.tsx`, `BubbleApp.tsx`,
  `PanelApp.tsx`. Les composants reçoivent des props et des rappels.
- Aucun canal ne colle, ne copie ou ne lit un texte fourni par une page
  (SPEC I-2, I-3) ; le principal vérifie l'expéditeur de chaque message
  (`sentBy`, I-20).
- Logique dans des fonctions pures (`*.ts`), testées ; composants sans logique
  métier.
- Pas de code propre à un bureau (KDE, KWin…), pas de shell pour lancer un
  programme (I-27, I-28).
- En-tête de chaque fichier : ce qu'il fait, ce qu'il ne connaît pas, qui
  l'utilise. À tenir à jour.

## Ne pas modifier sans demander

- `**/tests/invariants/**` : protégés. Si un invariant échoue, corriger le
  code, pas le test.
- `src/*preload.js` : les ponts, frontière de sécurité.

## PR

- Une note par ticket : `docs/tickets/<type>/<ticket>-<slug>.md`.
- Un commit par module : fonctions pures → orchestration → composants → colle.
