import { expect, it } from 'vitest';
import { streamKey } from 'core/sound';

it('l’identité retenue par WirePlumber : la classe, puis la première propriété présente', () => {
  expect(streamKey({ 'media.class': 'Stream/Output/Audio', 'application.name': 'Brave', 'node.name': 'x' })).toBe('Stream/Output/Audio:application.name:Brave');
  expect(streamKey({ 'media.class': 'Stream/Output/Audio', 'media.role': 'Notification', 'application.name': 'Brave' })).toBe('Stream/Output/Audio:media.role:Notification');
  expect(streamKey({ 'media.class': 'Stream/Input/Audio', 'application.id': 'com.discordapp.Discord', 'application.name': 'WEBRTC VoiceEngine' }))
    .toBe('Stream/Input/Audio:application.id:com.discordapp.Discord');
  expect(streamKey({ 'media.class': 'Stream/Output/Audio' })).toBeNull();
});
