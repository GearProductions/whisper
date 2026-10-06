/** bridge — le contrat des ponts (src/shared/bridge), et les ponts tels que les
 *  pages les voient (window.api, window.bubble, window.conv). Types seuls. */
import type { BubbleApi, ConvApi, IconApi } from 'shared/bridge';

export type * from 'shared/bridge';

declare global {
  interface Window {
    api: IconApi;
    bubble: BubbleApi;
    conv: ConvApi;
  }
}
