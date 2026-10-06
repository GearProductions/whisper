/** index — l'entrée du processus principal d'Electron (out/main/index.js).
 *  Tout est dans app/ ; le métier dans core/, ce que fournit le système dans
 *  technicals/. */
import { start } from 'app/lifecycle';

start();
