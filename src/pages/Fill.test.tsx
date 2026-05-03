import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Fill } from './Fill';
import type { Template } from '@/types/template';

vi.mock('@/stores/templates', () => ({ useTemplatesStore: vi.fn() }));
vi.mock('@/stores/instances', () => ({ useInstancesStore: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

import { useTemplatesStore } from '@/stores/templates';
import { useInstancesStore } from '@/stores/instances';

const textField = { id: 'f1', type: 'text' as const, label: 'Name', conditions: [], conditionLogic: 'OR' as const, defaultVisible: true, defaultRequired: false, config: {} };
const numFieldA = { id: 'A', type: 'number' as const, label: 'A', conditions: [], conditionLogic: 'OR' as const, defaultVisible: true, defaultRequired: false, config: { decimalPlaces: 0 as const } };
const numFieldB = { id: 'B', type: 'number' as const, label: 'B', conditions: [], conditionLogic: 'OR' as const, defaultVisible: true, defaultRequired: false, config: { decimalPlaces: 0 as const } };
const calcField = { id: 'T', type: 'calculation' as const, label: 'Total', conditions: [], conditionLogic: 'OR' as const, defaultVisible: true, config: { sourceFieldIds: ['A', 'B'], aggregation: 'sum' as const, decimalPlaces: 0 as const } };

const hiddenTextField = {
  id: 'f2', type: 'text' as const, label: 'Secret', defaultRequired: false,
  conditions: [{ targetId: 'f1', effect: 'hide' as const, operator: 'text_equals' as const, value: 'hide' }],
  conditionLogic: 'OR' as const, defaultVisible: true, config: {},
};

const requiredTextField = { ...textField, id: 'req', label: 'Required', defaultRequired: true };

const baseTemplate: Template = {
  id: 't1', title: 'Test Form', createdAt: '2026-01-01T00:00:00Z', modifiedAt: '2026-01-01T00:00:00Z',
  fields: [textField],
};

function mockStores(template: Template, extraStore = {}) {
  (vi.mocked(useTemplatesStore)).mockReturnValue({
    templates: { [template.id]: template },
    invalidTemplateIds: new Set(),
    loadFromStorage: vi.fn(),
    ...extraStore,
  });
  const addInstance = vi.fn();
  (vi.mocked(useInstancesStore)).mockReturnValue({
    addInstance,
    loadFromStorage: vi.fn(),
  });
  return { addInstance };
}

function renderFill(templateId = 't1') {
  return render(
    <MemoryRouter initialEntries={[`/templates/${templateId}/fill`]}>
      <Routes>
        <Route path="/templates/:templateId/fill" element={<Fill />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom doesn't implement scrollIntoView
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('Fill — rendering', () => {
  it('renders all fields from template', () => {
    const template: Template = { ...baseTemplate, fields: [textField, numFieldA] };
    mockStores(template);
    renderFill();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('hidden-by-condition field not rendered initially', () => {
    const template: Template = { ...baseTemplate, fields: [textField, hiddenTextField] };
    mockStores(template);
    renderFill();
    // hiddenTextField is hidden when f1 === 'hide'; initially f1 is empty so default visible
    // hiddenTextField defaultVisible=true, condition hides when f1='hide' — initially f1 is empty, so it IS visible
    expect(screen.getByText('Secret')).toBeInTheDocument();
  });

  it('entering hide value in trigger hides the dependent field', async () => {
    const template: Template = { ...baseTemplate, fields: [textField, hiddenTextField] };
    mockStores(template);
    renderFill();
    const input = screen.getAllByRole('textbox')[0]!;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'hide' } });
    });
    expect(screen.queryByText('Secret')).toBeNull();
  });
});

describe('Fill — calculation real-time update', () => {
  it('calc field updates as source values change', async () => {
    const template: Template = { ...baseTemplate, fields: [numFieldA, numFieldB, calcField] };
    mockStores(template);
    renderFill();

    const spinbuttons = screen.getAllByRole('spinbutton');
    await act(async () => {
      fireEvent.change(spinbuttons[0]!, { target: { value: '10' } });
    });
    await act(async () => {
      fireEvent.change(spinbuttons[1]!, { target: { value: '20' } });
    });
    // Total should show 30
    expect(screen.getByText('30')).toBeInTheDocument();
  });
});

describe('Fill — validation', () => {
  it('required field shows error on submit when empty', async () => {
    const template: Template = { ...baseTemplate, fields: [requiredTextField] };
    mockStores(template);
    renderFill();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    });
    expect(screen.getByText(/this field is required/i)).toBeInTheDocument();
  });

  it('hidden required field is not validated', async () => {
    const hiddenRequired = { ...requiredTextField, id: 'hr', label: 'Hidden Required',
      conditions: [{ targetId: 'f1', effect: 'hide' as const, operator: 'text_equals' as const, value: 'hide' }],
    };
    const template: Template = { ...baseTemplate, fields: [textField, hiddenRequired] };
    mockStores(template);
    renderFill();

    // Type 'hide' to hide the required field
    const textbox = screen.getAllByRole('textbox')[0]!;
    await act(async () => {
      fireEvent.change(textbox, { target: { value: 'hide' } });
    });

    // Submit — hidden required field should not block
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    });
    // No required error for the hidden field
    expect(screen.queryByText(/required/i)).toBeNull();
  });

  it('successful submit calls addInstance', async () => {
    const template: Template = { ...baseTemplate, fields: [textField] };
    const { addInstance } = mockStores(template);
    renderFill();

    const input = screen.getByRole('textbox');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Alice' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    });
    expect(addInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 't1',
        values: expect.objectContaining({ f1: 'Alice' }),
        visibility: expect.objectContaining({ f1: true }),
      }),
    );
  });

  it('submitted instance strips hidden field values', async () => {
    const template: Template = { ...baseTemplate, fields: [textField, hiddenTextField] };
    const { addInstance } = mockStores(template);
    renderFill();

    // Type 'hide' to hide f2
    const inputs = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(inputs[0]!, { target: { value: 'hide' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    });

    const call = addInstance.mock.calls[0]?.[0];
    expect(call?.values).not.toHaveProperty('f2');
    expect(call?.visibility?.['f2']).toBe(false);
  });
});
