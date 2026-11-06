/** image-png — une image collée ou déposée, redessinée par le navigateur et réencodée en PNG avant l'envoi : le
 *  navigateur la lit (il l'affiche en aperçu), alors que le décodeur du principal (nativeImage) refuse certaines
 *  captures d'écran (« Image illisible »). Seul un PNG est redessiné (la cause des captures refusées) : un GIF
 *  (peut-être animé), un JPEG ou un WebP partent tels quels (réencodés en PNG, ils pèseraient 5 à 10 fois plus) ;
 *  un échec, ou un PNG obtenu plus gros que la borne du principal : l'originale.
 *  Ne connaît pas : les pièces jointes, le pont. Utilisé par : app/panel (panel-app, piecesOf). */

// La borne du principal (IMAGE_MAX_INPUT, main/technicals/images) : au-delà, il refuse l'image.
const MAX_BYTES = 50 * 1024 * 1024;

export async function imagePng(file: File): Promise<{ type: string; data: ArrayBuffer }> {
  if (file.type !== 'image/png') return { type: file.type, data: await file.arrayBuffer() };
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    bitmap.close();
    const data = await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer();
    if (data.byteLength <= MAX_BYTES) return { type: 'image/png', data };
  } catch { /* l'originale */ }
  return { type: file.type, data: await file.arrayBuffer() };
}
