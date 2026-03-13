import type {
  AppState,
  ComposerStatusKind,
  KeyboardAvoidanceSource,
} from './state.js';

export const WAITING_INDICATOR_FRAMES = ['.', '..', '...'] as const;

export type ComposerStatusView = {
  kind: ComposerStatusKind;
  text: string | null;
  tone: 'neutral' | 'busy' | 'error';
};

export type KeyboardLayoutMetrics = {
  viewportHeight: number;
  keyboardInset: number;
  source: KeyboardAvoidanceSource;
};

const KEYBOARD_LAYOUT_THRESHOLD = 80;
const FOCUS_FALLBACK_MIN_INSET = 300;
const FOCUS_FALLBACK_MAX_INSET = 380;
const FOCUS_FALLBACK_RATIO = 0.5;
const MIN_REACHABLE_VIEWPORT_HEIGHT = 220;
const SHORT_VIEWPORT_FALLBACK_LIMIT = 360;

export const getWaitingIndicatorSuffix = (frame: number): string =>
  WAITING_INDICATOR_FRAMES[((frame % WAITING_INDICATOR_FRAMES.length) + WAITING_INDICATOR_FRAMES.length) % WAITING_INDICATOR_FRAMES.length] ?? WAITING_INDICATOR_FRAMES[0];

export const getWaitingIndicatorText = (frame: number): string =>
  `正在等待回复${getWaitingIndicatorSuffix(frame)}`;

export const getComposerStatusView = (
  state: Pick<AppState, 'composerStatusKind' | 'error' | 'networkOnline' | 'responsePhase' | 'messageFollowMode' | 'sessionId'>,
): ComposerStatusView => {
  if (state.composerStatusKind === 'error' && state.error) {
    return {
      kind: 'error',
      text: state.error,
      tone: 'error',
    };
  }

  if (!state.networkOnline) {
    return {
      kind: 'offline',
      text: '网络离线',
      tone: 'neutral',
    };
  }

  if (!state.sessionId) {
    return {
      kind: 'booting',
      text: '正在初始化',
      tone: 'neutral',
    };
  }

  return {
    kind: 'idle',
    text: null,
    tone: 'neutral',
  };
};

export const resolveKeyboardLayout = (params: {
  keyboardMode: boolean;
  layoutViewportHeight: number;
  baselineLayoutViewportHeight: number | null;
  visualViewportHeight?: number | null;
  visualViewportOffsetTop?: number | null;
  allowFallbackInset: boolean;
}): KeyboardLayoutMetrics => {
  const layoutViewportHeight = Math.max(params.layoutViewportHeight, 320);

  if (!params.keyboardMode) {
    return {
      viewportHeight: layoutViewportHeight,
      keyboardInset: 0,
      source: 'none',
    };
  }

  const baseline = params.baselineLayoutViewportHeight ?? layoutViewportHeight;
  if (baseline - layoutViewportHeight >= KEYBOARD_LAYOUT_THRESHOLD) {
    return {
      viewportHeight: layoutViewportHeight,
      keyboardInset: 0,
      source: 'layout',
    };
  }

  if (params.visualViewportHeight !== null && params.visualViewportHeight !== undefined) {
    const visualViewportAvailableHeight = Math.max(
      Math.round(params.visualViewportHeight + (params.visualViewportOffsetTop ?? 0)),
      320,
    );
    const keyboardInset = Math.max(layoutViewportHeight - visualViewportAvailableHeight, 0);
    if (keyboardInset >= KEYBOARD_LAYOUT_THRESHOLD) {
      return {
        viewportHeight: layoutViewportHeight,
        keyboardInset,
        source: 'visual-viewport',
      };
    }
  }

  if (params.allowFallbackInset) {
    const preferredInset = Math.min(
      Math.max(Math.round(layoutViewportHeight * FOCUS_FALLBACK_RATIO), FOCUS_FALLBACK_MIN_INSET),
      FOCUS_FALLBACK_MAX_INSET,
    );

    return {
      viewportHeight: layoutViewportHeight,
      // Tesla can fail to expose reliable viewport changes while still showing
      // a tall IME panel, so the fallback inset needs to prioritize composer reachability
      // without collapsing genuinely short viewports that also rely on this path.
      keyboardInset:
        layoutViewportHeight <= SHORT_VIEWPORT_FALLBACK_LIMIT
          ? Math.max(
              Math.min(preferredInset, Math.max(layoutViewportHeight - MIN_REACHABLE_VIEWPORT_HEIGHT, 0)),
              0,
            )
          : preferredInset,
      source: 'focus-fallback',
    };
  }

  return {
    viewportHeight: layoutViewportHeight,
    keyboardInset: 0,
    source: 'layout',
  };
};
