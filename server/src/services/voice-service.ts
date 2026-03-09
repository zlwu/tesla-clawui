import type { FastifyBaseLogger } from 'fastify';
import type { VoiceInputResponse } from '@tesla-openclaw/shared';

import { AppException } from '../lib/errors.js';
import { logStepFailure, logStepSuccess } from '../lib/observability.js';
import type { AsrService } from './asr-service.js';
import type { AudioFileService } from './audio-file-service.js';
import type { LlmService } from './llm-service.js';
import type { MessageService } from './message-service.js';
import type { RequestLogService } from './request-log-service.js';
import type { SessionService } from './session-service.js';

export class VoiceService {
  public constructor(
    private readonly sessionService: SessionService,
    private readonly messageService: MessageService,
    private readonly requestLogService: RequestLogService,
    private readonly audioFileService: AudioFileService,
    private readonly asrService: AsrService,
    private readonly llmService: LlmService,
  ) {}

  public async handleInput(params: {
    sessionId: string;
    token: string;
    requestId: string;
    audioBuffer: Buffer;
    mimeType: string;
    language: string;
    filename?: string;
    uploadDurationMs?: number;
    logger?: FastifyBaseLogger | undefined;
  }): Promise<VoiceInputResponse> {
    const startedAt = Date.now();
    await this.sessionService.getAuthorizedSession(params.sessionId, params.token);

    const existing = await this.requestLogService.get<VoiceInputResponse>(params.requestId);
    if (existing) {
      params.logger?.info(
        { sessionId: params.sessionId, requestId: params.requestId },
        'voice.idempotency.hit',
      );
      return existing;
    }

    if (this.requestLogService.hasInFlight(params.requestId)) {
      params.logger?.info(
        { sessionId: params.sessionId, requestId: params.requestId },
        'voice.idempotency.joined',
      );
    }

    return this.requestLogService.runOnce(params.requestId, async () => {
      if (!params.audioBuffer.byteLength) {
        throw new AppException(400, {
          code: 'AUDIO_FILE_INVALID',
          message: '音频文件为空',
          retryable: false,
        });
      }

      try {
        let savedAudio;
        try {
          savedAudio = await this.audioFileService.saveUpload({
            sessionId: params.sessionId,
            requestId: params.requestId,
            buffer: params.audioBuffer,
            mimeType: params.mimeType,
            ...(params.filename ? { filename: params.filename } : {}),
          });
        } catch {
          throw new AppException(502, {
            code: 'AUDIO_UPLOAD_FAILED',
            message: '音频上传保存失败',
            retryable: true,
          });
        }

        params.logger?.info(
          {
            sessionId: params.sessionId,
            requestId: params.requestId,
            uploadDurationMs: params.uploadDurationMs ?? 0,
            sizeBytes: savedAudio.sizeBytes,
          },
          'voice.upload.completed',
        );

        await this.sessionService.touch(params.sessionId, 'transcribing');

        const transcript = (await this.asrService.transcribe({
          filePath: savedAudio.filePath,
          mimeType: savedAudio.mimeType,
          language: params.language,
          sizeBytes: savedAudio.sizeBytes,
          logger: params.logger,
          sessionId: params.sessionId,
          requestId: params.requestId,
        })).trim();

        if (!transcript) {
          throw new AppException(502, {
            code: 'ASR_FAILED',
            message: '语音识别结果为空',
            retryable: true,
          });
        }

        const history = await this.messageService.listHistory(params.sessionId, 12);
        const userMessage = await this.messageService.create({
          sessionId: params.sessionId,
          role: 'user',
          content: transcript,
          source: 'voice_asr',
          requestId: params.requestId,
        });

        await this.sessionService.touch(params.sessionId, 'thinking');

        const replyText = await this.llmService.generateReply({
          sessionId: params.sessionId,
          requestId: params.requestId,
          text: transcript,
          history,
          logger: params.logger,
        });

        const assistantMessage = await this.messageService.create({
          sessionId: params.sessionId,
          role: 'assistant',
          content: replyText,
          source: 'llm',
          requestId: params.requestId,
        });

        await this.sessionService.touch(params.sessionId, 'idle');

        const response: VoiceInputResponse = {
          requestId: params.requestId,
          sessionId: params.sessionId,
          transcript,
          userMessage,
          assistantMessage,
          status: 'idle',
        };

        await this.requestLogService.save(params.requestId, params.sessionId, 'voice', response);
        logStepSuccess({
          logger: params.logger,
          event: 'voice.completed',
          startedAt,
          context: {
            sessionId: params.sessionId,
            requestId: params.requestId,
          },
        });

        return response;
      } catch (error) {
        await this.sessionService.touch(params.sessionId, 'idle');
        logStepFailure({
          logger: params.logger,
          event: 'voice.failed',
          startedAt,
          error,
          context: {
            sessionId: params.sessionId,
            requestId: params.requestId,
          },
        });
        throw error;
      }
    });
  }
}
