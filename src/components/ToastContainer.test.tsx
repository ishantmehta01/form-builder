import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastContainer } from './ToastContainer';
import { useToastsStore } from '@/stores/toasts';

describe('ToastContainer', () => {
  beforeEach(() => {
    useToastsStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders toast container with one success toast', () => {
    useToastsStore.getState().pushToast('Saved');
    render(<ToastContainer />);
    expect(screen.getByTestId('toast-container')).toBeInTheDocument();
    expect(screen.getByTestId('toast-success')).toHaveTextContent('Saved');
  });

  it('renders multiple toasts in order', () => {
    const { pushToast } = useToastsStore.getState();
    pushToast('First');
    pushToast('Second', 'error');
    render(<ToastContainer />);
    const toasts = screen.getAllByRole('status');
    expect(toasts).toHaveLength(2);
    expect(toasts[0]).toHaveTextContent('First');
    expect(toasts[1]).toHaveTextContent('Second');
  });

  it('renders error variant with error testid', () => {
    useToastsStore.getState().pushToast('Boom', 'error');
    render(<ToastContainer />);
    expect(screen.getByTestId('toast-error')).toHaveTextContent('Boom');
  });

  it('renders info variant with info testid', () => {
    useToastsStore.getState().pushToast('Heads up', 'info');
    render(<ToastContainer />);
    expect(screen.getByTestId('toast-info')).toHaveTextContent('Heads up');
  });

  it('clicking a toast dismisses it immediately', () => {
    useToastsStore.getState().pushToast('Saved');
    render(<ToastContainer />);
    fireEvent.click(screen.getByTestId('toast-success'));
    expect(useToastsStore.getState().toasts).toHaveLength(0);
  });

  it('container has aria-live polite for screen readers', () => {
    useToastsStore.getState().pushToast('Saved');
    render(<ToastContainer />);
    const container = screen.getByTestId('toast-container');
    expect(container).toHaveAttribute('aria-live', 'polite');
  });
});
