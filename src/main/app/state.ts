/** state — l'état de l'appli que se partagent fenêtres et contrôleurs : les
 *  trois fenêtres, la bulle, la vue du panneau, la dernière dictée, le
 *  téléchargement du modèle. Seul objet partagé : chaque champ dit qui l'écrit.
 *  Ne connaît pas : le métier. Utilisé par : app. */
import type { BrowserWindow } from 'electron';
import type { BubbleKind, ConvMode, Notice } from 'shared/bridge';
import type { Thread } from 'core/agents';

type Timer = ReturnType<typeof setTimeout> | undefined;
type Rect = { x: number; y: number; width: number; height: number };

export const state = {
  // icon-window
  icon: null as BrowserWindow | null,
  winSize: 0,          // taille voulue de l'icône, en px logiques
  speakShown: false,   // bouton de lecture montré (réglage `speak` ≠ 'off')
  agentSlots: 0,       // robots montrés + le bouton « + » (0 : agents désactivés)
  // bubble-window
  bubble: null as BrowserWindow | null,
  bubbleKind: null as BubbleKind | null, // 'notice' (le temps d'un enregistrement), 'status' ou 'volume'
  bubbleH: 80,         // hauteur mesurée par la page de la bulle
  bubbleTimer: undefined as Timer,
  // panel-window, controllers/conversation
  panel: null as BrowserWindow | null,
  convReady: false,    // la page a reçu sa première conversation
  convMode: 'compact' as ConvMode,
  convCompactH: 260,   // hauteur du réduit, mesurée par la page
  convPlaced: null as Rect | null, // dernières dimensions posées par placeConversation
  convResizeTimer: undefined as Timer,
  convView: null as { agentId: string | null; sessionId: string | null } | null, // sessionId null : la session en cours ; agentId null : la dictée
  convThread: [] as Thread,   // fil affiché
  convSpeech: '',             // résumé audio de la réponse choisie par ▶ (cf. tts:speak)
  convSeq: 0,                 // rafraîchissements qui se chevauchent : seul le dernier s'affiche
  convInput: '',              // dictée arrivée avant que la page soit prête
  convFocusInput: false,
  convNotice: null as Notice | null,                    // message montré en tête du panneau
  dictation: null as { text: string; time: number } | null, // le dernier texte dicté pour ailleurs
  // controllers/dictation
  recording: false,
  modelDownload: null as { percent: number } | null,
  // controllers/speech
  speakKey: '',
  speakPolling: false,
};
