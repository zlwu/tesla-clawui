import type { AppStatus, Message } from '@tesla-openclaw/shared';

export const MAX_VISIBLE_MESSAGES = 8;
const MAX_VISIBLE_MESSAGE_LENGTH = 1200;

const allowedTransitions: Record<AppStatus, AppStatus[]> = {
  idle: ['recording', 'thinking', 'error'],
  recording: ['uploading', 'idle', 'error'],
  uploading: ['transcribing', 'thinking', 'idle', 'error'],
  transcribing: ['thinking', 'idle', 'error'],
  thinking: ['idle', 'error'],
  error: ['idle', 'recording', 'thinking', 'uploading', 'transcribing'],
};

export const statusLabelMap: Record<AppStatus, string> = {
  idle: '待命',
  recording: '录音中',
  uploading: '上传中',
  transcribing: '识别中',
  thinking: '思考中',
  error: '出错了',
};

export const transitionStatus = (current: AppStatus, next: AppStatus): AppStatus => {
  if (current === next) {
    return next;
  }

  return allowedTransitions[current].includes(next) ? next : current;
};

export const limitMessages = (messages: Message[]): Message[] => messages.slice(-MAX_VISIBLE_MESSAGES);

export const buildVisibleMessages = (messages: Message[]): Message[] =>
  limitMessages(messages).map((message) => ({
    ...message,
    content:
      message.content.length > MAX_VISIBLE_MESSAGE_LENGTH
        ? `${message.content.slice(0, MAX_VISIBLE_MESSAGE_LENGTH).trimEnd()}…`
        : message.content,
  }));

export const isVoiceBusyStatus = (status: AppStatus): boolean =>
  status === 'uploading' || status === 'transcribing' || status === 'thinking';
