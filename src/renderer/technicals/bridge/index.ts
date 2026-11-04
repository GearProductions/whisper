/** bridge — le contrat des ponts (src/shared/bridge), et les ponts tels que les
 *  pages les voient (window.conv). Types seuls. */
import type { ConvApi } from 'shared/bridge';

export type * from 'shared/bridge';

declare global {
  interface Window {
    conv: ConvApi;
  }
}
