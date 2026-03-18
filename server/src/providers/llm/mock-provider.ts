import type {
  LlmGenerateInput,
  LlmProvider,
  LlmStreamCallbacks,
  LlmStreamResult,
} from './provider.js';

export class MockLlmProvider implements LlmProvider {
  public generateReply(input: LlmGenerateInput): Promise<string> {
    const previousTurns = Math.floor(input.history.length / 2);
    return Promise.resolve(
      `MVP mock 回复：已收到“${input.text}”。当前是第 ${previousTurns + 1} 轮文本对话。`,
    );
  }

  public async generateReplyStream(
    input: LlmGenerateInput,
    callbacks: LlmStreamCallbacks,
  ): Promise<LlmStreamResult> {
    const reply = await this.generateReply(input);
    let deltaCount = 0;
    for (const chunk of reply.match(/.{1,12}/gu) ?? []) {
      deltaCount += 1;
      await callbacks.onDelta(chunk);
    }

    return {
      replyText: reply,
      diagnostics: {
        provider: 'mock',
        completionMarkerObserved: true,
        finishReason: 'stop',
        deltaCount,
        characterCount: reply.length,
        terminationReason: 'mock_stream_complete',
      },
    };
  }

  public async resetSession(): Promise<void> {}
}
