import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useToastsStore } from './toasts';

describe('toasts store', () => {
  beforeEach(() => {
    useToastsStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pushToast adds a toast with default success variant', () => {
    useToastsStore.getState().pushToast('Saved');
    const { toasts } = useToastsStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.message).toBe('Saved');
    expect(toasts[0]?.variant).toBe('success');
    expect(typeof toasts[0]?.id).toBe('string');
  });

  it('pushToast accepts variant override', () => {
    useToastsStore.getState().pushToast('Failed', 'error');
    expect(useToastsStore.getState().toasts[0]?.variant).toBe('error');
  });

  it('pushToast auto-removes after default 2500ms', () => {
    useToastsStore.getState().pushToast('Saved');
    expect(useToastsStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(2499);
    expect(useToastsStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastsStore.getState().toasts).toHaveLength(0);
  });

  it('pushToast respects custom duration', () => {
    useToastsStore.getState().pushToast('Quick', 'info', 500);
    vi.advanceTimersByTime(499);
    expect(useToastsStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToastsStore.getState().toasts).toHaveLength(0);
  });

  it('multiple toasts stack', () => {
    const { pushToast } = useToastsStore.getState();
    pushToast('A');
    pushToast('B');
    pushToast('C');
    expect(useToastsStore.getState().toasts).toHaveLength(3);
    expect(useToastsStore.getState().toasts.map((t) => t.message)).toEqual(['A', 'B', 'C']);
  });

  it('dismissToast removes a specific toast immediately', () => {
    const { pushToast, dismissToast } = useToastsStore.getState();
    const idA = pushToast('A');
    pushToast('B');
    dismissToast(idA);
    const remaining = useToastsStore.getState().toasts;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.message).toBe('B');
  });

  it('dismissToast on a non-existent id is a no-op', () => {
    useToastsStore.getState().pushToast('A');
    useToastsStore.getState().dismissToast('does-not-exist');
    expect(useToastsStore.getState().toasts).toHaveLength(1);
  });

  it('pushToast returns the toast id', () => {
    const id = useToastsStore.getState().pushToast('Saved');
    expect(typeof id).toBe('string');
    expect(useToastsStore.getState().toasts[0]?.id).toBe(id);
  });
});
