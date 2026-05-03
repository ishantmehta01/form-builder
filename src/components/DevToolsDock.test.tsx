import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DevToolsDock } from './DevToolsDock';
import { useDevToolsStore, DOCK_PREF_KEY } from '@/stores/devtools';
import { useTemplatesStore } from '@/stores/templates';
import { useInstancesStore } from '@/stores/instances';

const getItemMock = vi.fn();
const setItemMock = vi.fn();
const localStorageMock = {
  getItem: getItemMock,
  setItem: setItemMock,
  removeItem: vi.fn(),
  clear: vi.fn(),
};

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
  getItemMock.mockReturnValue(null);
  setItemMock.mockClear();
  useDevToolsStore.setState({ docked: false, storageOpen: false });
  useTemplatesStore.setState({ templates: {}, instances: {}, invalidTemplateIds: new Set() });
  useInstancesStore.setState({ instances: {}, templates: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DevToolsDock', () => {
  it('renders nothing when docked=false', () => {
    render(<DevToolsDock />);
    expect(screen.queryByTestId('dev-tools-dock')).not.toBeInTheDocument();
  });

  it('renders dock panel when docked=true', () => {
    useDevToolsStore.setState({ docked: true });
    render(<DevToolsDock />);
    expect(screen.getByTestId('dev-tools-dock')).toBeInTheDocument();
  });

  it('auto-shows on mount if __devtools.docked is true in localStorage', () => {
    getItemMock.mockImplementation((key: string) =>
      key === DOCK_PREF_KEY ? 'true' : null
    );
    render(<DevToolsDock />);
    expect(screen.getByTestId('dev-tools-dock')).toBeInTheDocument();
  });

  it('shows empty message when formBuilder key is absent', () => {
    useDevToolsStore.setState({ docked: true });
    render(<DevToolsDock />);
    expect(screen.getByText(/empty/i)).toBeInTheDocument();
  });

  it('shows JsonTree when formBuilder key exists', () => {
    getItemMock.mockImplementation((key: string) =>
      key === 'formBuilder' ? JSON.stringify({ templates: {} }) : null
    );
    useDevToolsStore.setState({ docked: true });
    render(<DevToolsDock />);
    expect(screen.getByTestId('json-tree')).toBeInTheDocument();
  });

  it('refresh button re-reads localStorage and updates display', () => {
    useDevToolsStore.setState({ docked: true });
    render(<DevToolsDock />);
    expect(screen.queryByTestId('json-tree')).not.toBeInTheDocument();

    getItemMock.mockImplementation((key: string) =>
      key === 'formBuilder' ? JSON.stringify({ templates: {} }) : null
    );
    fireEvent.click(screen.getByTestId('refresh-dock'));
    expect(screen.getByTestId('json-tree')).toBeInTheDocument();
  });

  it('close button calls setDocked(false) and writes __devtools.docked=false', () => {
    useDevToolsStore.setState({ docked: true });
    render(<DevToolsDock />);
    fireEvent.click(screen.getByTestId('close-dock'));
    expect(useDevToolsStore.getState().docked).toBe(false);
    expect(setItemMock).toHaveBeenCalledWith(DOCK_PREF_KEY, 'false');
    expect(screen.queryByTestId('dev-tools-dock')).not.toBeInTheDocument();
  });

  it('undock button calls setDocked(false) and setStorageOpen(true)', () => {
    useDevToolsStore.setState({ docked: true });
    render(<DevToolsDock />);
    fireEvent.click(screen.getByTestId('undock-storage-viewer'));
    expect(useDevToolsStore.getState().docked).toBe(false);
    expect(useDevToolsStore.getState().storageOpen).toBe(true);
  });
});
