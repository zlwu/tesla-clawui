import type { LlmGenerateInput, LlmProvider } from './provider.js';

export class MockLlmProvider implements LlmProvider {
  public generateReply(input: LlmGenerateInput): Promise<string> {
    const previousTurns = Math.floor(input.history.length / 2);
    return Promise.resolve(
      `MVP mock 回复：已收到“${input.text}”。当前是第 ${previousTurns + 1} 轮文本对话。`,
    );
  }
}
