import { describe, expect, it, vi } from 'vitest';

import { VoiceRecorder } from '../voice-recorder.js';

describe('VoiceRecorder', () => {
  it('reports permission denial with explicit copy', async () => {
    const legacyGetUserMedia = vi.fn(
      (
        _: MediaStreamConstraints,
        __: (stream: MediaStream) => void,
        onError: (error: unknown) => void,
      ) => {
        onError(new DOMException('denied', 'NotAllowedError'));
      },
    );

    Object.defineProperty(navigator, 'getUserMedia', {
      value: legacyGetUserMedia,
      configurable: true,
    });

    class FakeMediaRecorder {
      public static isTypeSupported(): boolean {
        return true;
      }
    }

    Object.defineProperty(globalThis, 'MediaRecorder', {
      value: FakeMediaRecorder,
      configurable: true,
    });

    await expect(new VoiceRecorder().start()).rejects.toThrow('麦克风权限被拒绝');
  });
});
