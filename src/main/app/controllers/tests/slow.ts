// Les tests du contrôleur laissent au relevé (git, fs.watch, le SDK factice) un délai fixe avant de
// vérifier : sur un runner de CI Windows, lent et partagé, ce délai ne suffit pas (des cas cassaient tour à
// tour, sans lien avec le code). slow(ms) le triple là seulement ; en local et sur Linux, rien ne change.
// Utilisé par : les settle des tests de app/controllers (invariants et variants).
export const slow = (ms: number) => (process.env.CI && process.platform === 'win32' ? ms * 3 : ms);
