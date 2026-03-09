import { randomBytes } from 'node:crypto';

export const nowIso = () => new Date().toISOString();

export const createId = (prefix: string) =>
  `${prefix}_${randomBytes(8).toString('hex')}`;
