import { describe, expect, it } from 'vitest';

import { createInitialState } from '../state.js';
import {
  getComposerStatusView,
  getWaitingIndicatorText,
  resolveKeyboardLayout,
} from '../ui-state.js';

describe('ui-state helpers', () => {
  it('cycles waiting indicator text with lightweight ASCII dots', () => {
    expect(getWaitingIndicatorText(0)).toBe('正在等待回复.');
    expect(getWaitingIndicatorText(1)).toBe('正在等待回复..');
    expect(getWaitingIndicatorText(2)).toBe('正在等待回复...');
    expect(getWaitingIndicatorText(3)).toBe('正在等待回复.');
  });

  it('keeps composer status quiet during waiting and streaming phases', () => {
    const waitingState = createInitialState();
    waitingState.sessionId = 'sess_1';
    waitingState.composerStatusKind = 'waiting';
    waitingState.responsePhase = 'waiting';

    const streamingState = createInitialState();
    streamingState.sessionId = 'sess_1';
    streamingState.composerStatusKind = 'streaming';
    streamingState.responsePhase = 'streaming';

    expect(getComposerStatusView(waitingState).text).toBeNull();
    expect(getComposerStatusView(streamingState).text).toBeNull();
  });

  it('prefers layout viewport shrink over other keyboard compensation', () => {
    const metrics = resolveKeyboardLayout({
      keyboardMode: true,
      layoutViewportHeight: 620,
      baselineLayoutViewportHeight: 820,
      visualViewportHeight: 560,
      visualViewportOffsetTop: 0,
      allowFallbackInset: true,
    });

    expect(metrics.source).toBe('layout');
    expect(metrics.keyboardInset).toBe(0);
  });

  it('uses visual viewport when layout height did not shrink enough', () => {
    const metrics = resolveKeyboardLayout({
      keyboardMode: true,
      layoutViewportHeight: 820,
      baselineLayoutViewportHeight: 820,
      visualViewportHeight: 620,
      visualViewportOffsetTop: 0,
      allowFallbackInset: true,
    });

    expect(metrics.source).toBe('visual-viewport');
    expect(metrics.keyboardInset).toBe(200);
  });

  it('falls back to focus-driven inset when no viewport signal is reliable', () => {
    const metrics = resolveKeyboardLayout({
      keyboardMode: true,
      layoutViewportHeight: 820,
      baselineLayoutViewportHeight: 820,
      visualViewportHeight: null,
      visualViewportOffsetTop: null,
      allowFallbackInset: true,
    });

    expect(metrics.source).toBe('focus-fallback');
    expect(metrics.keyboardInset).toBe(287);
  });

  it('keeps the fallback inset high enough for tall touch keyboards', () => {
    const metrics = resolveKeyboardLayout({
      keyboardMode: true,
      layoutViewportHeight: 620,
      baselineLayoutViewportHeight: 620,
      visualViewportHeight: null,
      visualViewportOffsetTop: null,
      allowFallbackInset: true,
    });

    expect(metrics.source).toBe('focus-fallback');
    expect(metrics.keyboardInset).toBe(220);
  });

  it('does not cap the fallback inset on medium-height viewports', () => {
    const metrics = resolveKeyboardLayout({
      keyboardMode: true,
      layoutViewportHeight: 400,
      baselineLayoutViewportHeight: 400,
      visualViewportHeight: null,
      visualViewportOffsetTop: null,
      allowFallbackInset: true,
    });

    expect(metrics.source).toBe('focus-fallback');
    expect(metrics.keyboardInset).toBe(220);
  });

  it('caps the fallback inset to preserve reachable space on short viewports', () => {
    const metrics = resolveKeyboardLayout({
      keyboardMode: true,
      layoutViewportHeight: 320,
      baselineLayoutViewportHeight: 320,
      visualViewportHeight: null,
      visualViewportOffsetTop: null,
      allowFallbackInset: true,
    });

    expect(metrics.source).toBe('focus-fallback');
    expect(metrics.keyboardInset).toBe(100);
  });
});
