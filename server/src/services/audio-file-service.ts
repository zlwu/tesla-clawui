import { writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { createId, nowIso } from '../lib/utils.js';
import type { DatabaseClient } from '../db/client.js';
import { audioFiles } from '../db/schema.js';
import type { AppConfig } from '../lib/config.js';

const extensionFromMimeType = (mimeType: string): string => {
  if (mimeType.includes('webm')) {
    return '.webm';
  }

  if (mimeType.includes('wav')) {
    return '.wav';
  }

  if (mimeType.includes('mpeg')) {
    return '.mp3';
  }

  return '.bin';
};

export class AudioFileService {
  public constructor(
    private readonly db: DatabaseClient,
    private readonly config: AppConfig,
  ) {}

  public async saveUpload(params: {
    sessionId: string;
    requestId: string;
    buffer: Buffer;
    mimeType: string;
    filename?: string;
  }): Promise<{ filePath: string; mimeType: string; sizeBytes: number }> {
    const audioId = createId('aud');
    const extension = extname(params.filename ?? '') || extensionFromMimeType(params.mimeType);
    const filePath = join(this.config.uploadDir, `${audioId}${extension}`);

    await writeFile(filePath, params.buffer);

    await this.db.insert(audioFiles).values({
      id: audioId,
      sessionId: params.sessionId,
      requestId: params.requestId,
      filePath,
      mimeType: params.mimeType,
      sizeBytes: params.buffer.byteLength,
      createdAt: nowIso(),
    });

    return {
      filePath,
      mimeType: params.mimeType,
      sizeBytes: params.buffer.byteLength,
    };
  }
}
