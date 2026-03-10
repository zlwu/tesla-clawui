export type VoiceRecording = {
  blob: Blob;
  mimeType: string;
};

type LegacyNavigator = Navigator & {
  getUserMedia?: LegacyGetUserMedia;
  webkitGetUserMedia?: LegacyGetUserMedia;
};

type LegacyGetUserMedia = (
    constraints: MediaStreamConstraints,
    onSuccess: (stream: MediaStream) => void,
    onError: (error: unknown) => void,
  ) => void;

const preferredMimeTypes = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/ogg;codecs=opus',
];

const readLegacyGetUserMedia = (): LegacyGetUserMedia | undefined => {
  const legacyNavigator = navigator as LegacyNavigator;
  return legacyNavigator.getUserMedia?.bind(legacyNavigator)
    ?? legacyNavigator.webkitGetUserMedia?.bind(legacyNavigator);
};

const resolveMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  for (const mimeType of preferredMimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return '';
};

const toStartErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return '麦克风权限被拒绝，请在 Tesla 浏览器里允许录音后重试';
    }

    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return '未找到可用麦克风设备';
    }

    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return '麦克风当前不可用，请关闭其他占用录音的页面后重试';
    }

    if (error.name === 'NotSupportedError') {
      return '当前浏览器的录音实现不兼容';
    }

    if (error.name === 'SecurityError') {
      return '当前页面不满足安全录音条件，请确认使用 HTTPS 地址访问';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '无法开始录音';
};

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private chunks: Blob[] = [];

  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof MediaRecorder !== 'undefined' &&
      typeof readLegacyGetUserMedia() === 'function'
    );
  }

  public async start(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('当前浏览器不支持录音');
    }

    const legacyGetUserMedia = readLegacyGetUserMedia();
    if (!navigator.mediaDevices?.getUserMedia && !legacyGetUserMedia) {
      throw new Error('当前浏览器不支持录音');
    }

    try {
      this.mediaStream = await new Promise<MediaStream>((resolve, reject) => {
        if (navigator.mediaDevices?.getUserMedia) {
          void navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then(resolve)
            .catch(reject);
          return;
        }

        legacyGetUserMedia?.({ audio: true }, resolve, reject);
      });
    } catch (error) {
      throw new Error(toStartErrorMessage(error));
    }

    this.chunks = [];

    const mimeType = resolveMimeType();

    try {
      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.mediaStream, { mimeType })
        : new MediaRecorder(this.mediaStream);
    } catch (error) {
      this.cleanup();
      throw new Error(toStartErrorMessage(error));
    }

    this.mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    });

    this.mediaRecorder.start();
  }

  public async stop(): Promise<VoiceRecording> {
    const recorder = this.mediaRecorder;
    if (!recorder) {
      throw new Error('当前没有进行中的录音');
    }

    return new Promise<VoiceRecording>((resolve, reject) => {
      recorder.addEventListener(
        'stop',
        () => {
          const mimeType = recorder.mimeType || 'audio/webm';
          const blob = new Blob(this.chunks, { type: mimeType });
          this.cleanup();
          if (!blob.size) {
            reject(new Error('录音内容为空'));
            return;
          }

          resolve({ blob, mimeType });
        },
        { once: true },
      );

      recorder.addEventListener(
        'error',
        () => {
          this.cleanup();
          reject(new Error('录音失败'));
        },
        { once: true },
      );

      recorder.stop();
    });
  }

  private cleanup(): void {
    this.mediaRecorder = null;
    this.chunks = [];
    this.mediaStream?.getTracks().forEach((track) => {
      track.stop();
    });
    this.mediaStream = null;
  }
}
