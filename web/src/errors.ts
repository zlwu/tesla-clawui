import type { AppError } from '@tesla-openclaw/shared';

const errorMessageMap: Record<AppError['code'], string> = {
  AUTH_REQUIRED: '请先输入 PIN 码解锁。',
  AUTH_INVALID_PIN: 'PIN 码不正确，请重新输入。',
  SESSION_NOT_FOUND: '当前会话不存在，请刷新后重试。',
  SESSION_EXPIRED: '当前会话已失效，请刷新后重试。',
  SESSION_UNAUTHORIZED: '当前会话无权访问，请刷新后重试。',
  INVALID_REQUEST: '请求格式不正确，请稍后重试。',
  VALIDATION_FAILED: '输入内容不合法，请检查后重试。',
  UNSUPPORTED_MEDIA_TYPE: '音频格式暂不支持，请改用车机默认录音。',
  REQUEST_CONFLICT: '同一次请求正在处理中，请稍候。',
  MIC_REQUIRED: '需要麦克风权限才能继续。',
  AUDIO_UPLOAD_FAILED: '音频上传失败，请重试。',
  AUDIO_FILE_INVALID: '录音文件无效，请重新录音。',
  ASR_FAILED: '语音识别失败，请重试。',
  ASR_TIMEOUT: '语音识别超时，请重试。',
  LLM_FAILED: '回复生成失败，请重试。',
  LLM_TIMEOUT: '回复生成超时，请重试。',
  CONTEXT_BUILD_FAILED: '上下文构建失败，请稍后重试。',
  RATE_LIMITED: '当前请求过多，请稍后重试。',
  INTERNAL_ERROR: '服务内部错误，请稍后重试。',
  SERVICE_UNAVAILABLE: '网络不可用，请检查连接后重试。',
  TTS_FAILED: '朗读失败，但文本回复不受影响。',
  TTS_TIMEOUT: '朗读超时，但文本回复不受影响。',
};

export const toDisplayErrorMessage = (error: AppError, networkOnline: boolean): string => {
  if (!networkOnline && error.retryable) {
    return '当前网络离线，请恢复连接后重试。';
  }

  return errorMessageMap[error.code] ?? error.message;
};
