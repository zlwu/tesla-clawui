export type VoiceRecording = {
  blob: Blob;
  mimeType: string;
};

const preferredMimeTypes = ['audio/webm;codecs=opus', 'audio/webm'];

const resolveMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return 'audio/webm';
  }

  for (const mimeType of preferredMimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return '';
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
      typeof navigator.mediaDevices?.getUserMedia === 'function'
    );
  }

  public async start(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('当前浏览器不支持录音');
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];

    const mimeType = resolveMimeType();
    this.mediaRecorder = mimeType
      ? new MediaRecorder(this.mediaStream, { mimeType })
      : new MediaRecorder(this.mediaStream);

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
