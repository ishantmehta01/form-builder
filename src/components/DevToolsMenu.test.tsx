import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DevToolsMenu } from './DevToolsMenu';

const removeItemMock = vi.fn();
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: removeItemMock,
    clear: () => { store = {}; },
  };
})();

const reloadMock = vi.fn();
vi.stubGlobal('location', { reload: reloadMock });

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
  removeItemMock.mockClear();
  reloadMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function setup() {
  render(<DevToolsMenu />);
}

describe('DevToolsMenu', () => {
  it('renders the floating button', () => {
    setup();
    expect(screen.getByTestId('dev-tools-button')).toBeInTheDocument();
  });

  it('opens the menu when button is clicked', () => {
    setup();
    expect(screen.queryByTestId('dev-tools-menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('dev-tools-button'));
    expect(screen.getByTestId('dev-tools-menu')).toBeInTheDocument();
  });

  it('closes the menu on outside click', () => {
    setup();
    fireEvent.click(screen.getByTestId('dev-tools-button'));
    expect(screen.getByTestId('dev-tools-menu')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('dev-tools-menu')).not.toBeInTheDocument();
  });

  it('opens confirm dialog when "Clear localStorage" is clicked', () => {
    setup();
    fireEvent.click(screen.getByTestId('dev-tools-button'));
    fireEvent.click(screen.getByTestId('clear-storage-action'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Cancel button closes dialog without clearing storage', () => {
    setup();
    fireEvent.click(screen.getByTestId('dev-tools-button'));
    fireEvent.click(screen.getByTestId('clear-storage-action'));
    fireEvent.click(screen.getByTestId('cancel-clear-storage'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(removeItemMock).not.toHaveBeenCalled();
  });

  it('Confirm button calls localStorage.removeItem with formBuilder key', () => {
    setup();
    fireEvent.click(screen.getByTestId('dev-tools-button'));
    fireEvent.click(screen.getByTestId('clear-storage-action'));
    fireEvent.click(screen.getByTestId('confirm-clear-storage'));
    expect(removeItemMock).toHaveBeenCalledWith('formBuilder');
  });

  it('Confirm button triggers page reload', () => {
    setup();
    fireEvent.click(screen.getByTestId('dev-tools-button'));
    fireEvent.click(screen.getByTestId('clear-storage-action'));
    fireEvent.click(screen.getByTestId('confirm-clear-storage'));
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('Escape key closes the confirm dialog without clearing', () => {
    setup();
    fireEvent.click(screen.getByTestId('dev-tools-button'));
    fireEvent.click(screen.getByTestId('clear-storage-action'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(removeItemMock).not.toHaveBeenCalled();
  });

  describe('Show localStorage', () => {
    it('opens storage viewer when "Show localStorage" is clicked', () => {
      setup();
      fireEvent.click(screen.getByTestId('dev-tools-button'));
      fireEvent.click(screen.getByTestId('show-storage-action'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('storage-content')).toBeInTheDocument();
    });

    it('shows empty message when formBuilder key is absent', () => {
      setup();
      fireEvent.click(screen.getByTestId('dev-tools-button'));
      fireEvent.click(screen.getByTestId('show-storage-action'));
      expect(screen.getByTestId('storage-content').textContent).toMatch(/empty/i);
    });

    it('shows pretty-printed JSON when formBuilder key exists', () => {
      localStorageMock.setItem('formBuilder', JSON.stringify({ templates: [] }));
      setup();
      fireEvent.click(screen.getByTestId('dev-tools-button'));
      fireEvent.click(screen.getByTestId('show-storage-action'));
      const content = screen.getByTestId('storage-content').textContent ?? '';
      expect(content).toContain('"templates"');
    });

    it('close button dismisses the storage viewer', () => {
      setup();
      fireEvent.click(screen.getByTestId('dev-tools-button'));
      fireEvent.click(screen.getByTestId('show-storage-action'));
      fireEvent.click(screen.getByTestId('close-storage-viewer'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Escape key closes the storage viewer', () => {
      setup();
      fireEvent.click(screen.getByTestId('dev-tools-button'));
      fireEvent.click(screen.getByTestId('show-storage-action'));
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
