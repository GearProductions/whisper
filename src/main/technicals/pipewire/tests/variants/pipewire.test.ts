import { describe, expect, it } from 'vitest';
import { streamIds } from 'technicals/pipewire';

const STATUS = `PipeWire 'pipewire-0' [1.2.7]
Audio
 ├─ Devices:
 │      48. Family 17h HD Audio Controller      [alsa]
 ├─ Sinks:
 │  *   52. Speakers                            [vol: 0.50]
 ├─ Streams:
 │       87. Firefox
 │            88. output_FL       > Speakers:playback_FL	[active]
 │      104. WEBRTC VoiceEngine
 │
Video
 ├─ Devices:
 │      60. Webcam
 └─ Streams:
        130. OBS
`;

describe('streamIds', () => {
  it('seulement ce qui est sous « Streams: »', () => {
    expect(streamIds(STATUS)).toEqual(['87', '88', '104', '130']);
  });
  it('sortie vide ou absente', () => {
    expect(streamIds('')).toEqual([]);
    expect(streamIds(null)).toEqual([]);
  });
});
