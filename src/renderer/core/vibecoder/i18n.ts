/** i18n — les libellés de l'écran VibeCoder, en français et en anglais
 *  (vibeLang). Ceux des boutons viennent des actions (actions.<langue>.json).
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder. */
import type { VibeLang } from 'technicals/bridge';

export type Strings = Record<string, string>;

const STRINGS: Record<VibeLang, Strings> = { fr: {}, en: {} };

export function t(lang: VibeLang): Strings { return STRINGS[lang]; }
