/** state — l'état de l'appli que se partagent fenêtres et contrôleurs : la
 *  fenêtre et l'agent qu'elle affiche (convView, convThread), la dictée en
 *  cours, le téléchargement du modèle. Seul objet partagé : chaque champ dit
 *  qui l'écrit.
 *  Ne connaît pas : le métier. Utilisé par : app. */
import type { BrowserWindow } from 'electron';
import type { Notice } from 'shared/bridge';
import type { Thread } from 'core/agents';

type Timer = ReturnType<typeof setTimeout> | undefined;

export const state = {
  // panel-window, controllers/conversation
  panel: null as BrowserWindow | null,
  convReady: false,    // la page a reçu sa première conversation
  convResizeTimer: undefined as Timer,   // la taille de la fenêtre, retenue 400 ms après le dernier geste
  convView: null as { agentId: string; sessionId: string | null } | null, // sessionId null : la session en cours
  convThread: [] as Thread,   // fil affiché
  convSeq: 0,                 // rafraîchissements qui se chevauchent : seul le dernier s'affiche
  convFocusInput: false,
  convNotice: null as Notice | null,                    // message montré en tête du panneau
  // controllers/dictation
  recording: false,
  modelDownload: null as { percent: number } | null,
};
