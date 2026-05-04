import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Builder } from './Builder';
import type { Template } from '@/types/template';

vi.mock('@/stores/templates', () => ({ useTemplatesStore: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import { useTemplatesStore } from '@/stores/templates';

const mockNavigate = vi.fn();

function makeStore(overrides = {}) {
  const addTemplate = vi.fn();
  const updateTemplate = vi.fn();
  (vi.mocked(useTemplatesStore)).mockReturnValue({
    templates: {},
    addTemplate,
    updateTemplate,
    ...overrides,
  });
  return { addTemplate, updateTemplate };
}

function renderBuilder(templateId = 'new') {
  return render(
    <MemoryRouter initialEntries={[`/templates/${templateId}/edit`]}>
      <Routes>
        <Route path="/templates/:templateId/edit" element={<Builder />} />
        <Route path="/templates/new" element={<Builder />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderNewBuilder() {
  return render(
    <MemoryRouter initialEntries={['/templates/new']}>
      <Routes>
        <Route path="/templates/new" element={<Builder />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockNavigate.mockReset();
});

describe('Builder — field palette', () => {
  it('add field from left panel → appears in canvas', async () => {
    makeStore();
    renderNewBuilder();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    });
    // Field should now appear in canvas as a sortable item
    expect(screen.getAllByText('Text').length).toBeGreaterThan(1);
  });

  it('clicking field in canvas selects it (right panel shows config editor)', async () => {
    makeStore();
    renderNewBuilder();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    });
    // Right panel should now show "Label" config field
    expect(screen.getByDisplayValue('Text')).toBeInTheDocument();
  });
});

describe('Builder — save', () => {
  it('save with valid template calls addTemplate for new form', async () => {
    const { addTemplate } = makeStore();
    renderNewBuilder();

    // Type a title
    const titleInput = screen.getByPlaceholderText(/untitled form/i);
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'My Test Form' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });
    expect(addTemplate).toHaveBeenCalledWith(expect.objectContaining({ title: 'My Test Form' }));
  });

  it('cycle detection blocks save with error message', async () => {
    const aId = 'field-a';
    const bId = 'field-b';
    const cycleTemplate: Template = {
      id: 'tc', title: 'Cycle', createdAt: '2026-01-01T00:00:00Z', modifiedAt: '2026-01-01T00:00:00Z',
      fields: [
        { id: aId, type: 'text', label: 'A', conditions: [{ targetId: bId, effect: 'hide', operator: 'text_equals', value: 'x' }], conditionLogic: 'OR', defaultVisible: true, defaultRequired: false, config: {} },
        { id: bId, type: 'text', label: 'B', conditions: [{ targetId: aId, effect: 'hide', operator: 'text_equals', value: 'x' }], conditionLogic: 'OR', defaultVisible: true, defaultRequired: false, config: {} },
      ],
    };
    makeStore({ templates: { tc: cycleTemplate } });
    renderBuilder('tc');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });
    // Error message mentioning cycle
    expect(screen.getByText(/cycle/i)).toBeInTheDocument();
  });
});

describe('Builder — DnD setup', () => {
  it('fields render with drag handle when present', async () => {
    makeStore();
    renderNewBuilder();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    });
    // Drag handle aria-label is present
    expect(screen.getByLabelText(/drag to reorder/i)).toBeInTheDocument();
  });
});

describe('Builder — field deletion with dependents', () => {
  it('delete field with dependents shows confirm dialog', async () => {
    const confirmed = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmed);

    const depField = { id: 'dep', type: 'text' as const, label: 'Dep', conditions: [], conditionLogic: 'OR' as const, defaultVisible: true, defaultRequired: false, config: {} };
    const srcField = {
      id: 'src', type: 'text' as const, label: 'Src',
      conditions: [{ targetId: 'dep', effect: 'hide' as const, operator: 'text_equals' as const, value: 'x' }],
      conditionLogic: 'OR' as const, defaultVisible: true, defaultRequired: false, config: {},
    };
    const template: Template = {
      id: 't-dep', title: 'Dep Test', createdAt: '2026-01-01T00:00:00Z', modifiedAt: '2026-01-01T00:00:00Z',
      fields: [depField, srcField],
    };
    makeStore({ templates: { 't-dep': template } });
    renderBuilder('t-dep');

    // Hover to show delete buttons (they're opacity-0 normally, but fireEvent still triggers them)
    const deleteButtons = screen.getAllByLabelText(/delete field/i);
    await act(async () => {
      fireEvent.click(deleteButtons[0]!);
    });
    expect(confirmed).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('Builder — conditions', () => {
  it('add condition skips target fields without operators', async () => {
    const template: Template = {
      id: 't-conditions',
      title: 'Conditions',
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-01-01T00:00:00Z',
      fields: [
        {
          id: 'f-with-condition',
          type: 'text',
          label: 'Reason',
          conditions: [],
          conditionLogic: 'OR',
          defaultVisible: true,
          defaultRequired: false,
          config: {},
        },
        {
          id: 'f-file',
          type: 'file',
          label: 'Attachment',
          conditions: [],
          conditionLogic: 'OR',
          defaultVisible: true,
          defaultRequired: false,
          config: { allowedTypes: [], maxFiles: 1 },
        },
        {
          id: 'f-text',
          type: 'text',
          label: 'Status',
          conditions: [],
          conditionLogic: 'OR',
          defaultVisible: true,
          defaultRequired: false,
          config: {},
        },
      ],
    };

    makeStore({ templates: { 't-conditions': template } });
    renderBuilder('t-conditions');

    await act(async () => {
      fireEvent.click(screen.getByTestId('canvas-field-0'));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /\+ add condition/i }));
    });

    expect(screen.getByRole('button', { name: /remove condition/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Status')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /attachment/i })).not.toBeInTheDocument();
  });

});
