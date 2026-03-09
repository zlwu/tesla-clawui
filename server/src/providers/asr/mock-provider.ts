import type { AsrProvider, AsrTranscribeInput, AsrTranscribeResult } from './provider.js';

export class MockAsrProvider implements AsrProvider {
  public transcribe(input: AsrTranscribeInput): Promise<AsrTranscribeResult> {
    return Promise.resolve({
      transcript: `语音输入已收到，格式 ${input.mimeType}，大小 ${input.sizeBytes} 字节。`,
    });
  }
}
