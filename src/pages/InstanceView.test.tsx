import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { InstanceView } from './InstanceView';
import type { Instance, Template } from '@/types/template';

vi.mock('@/stores/instances', () => ({
  useInstancesStore: vi.fn(),
}));
vi.mock('@/lib/pdf', () => ({
  triggerPrint: vi.fn(),
}));
// pdf.css import is a no-op in tests (vitest handles CSS as empty)
vi.mock('@/lib/pdf.css', () => ({}));

import { useInstancesStore } from '@/stores/instances';

const mockTemplate: Template = {
  id: 't1',
  title: 'My Form',
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: '2026-01-01T00:00:00Z',
  fields: [
    {
      id: 'name',
      type: 'text',
      label: 'Full Name',
      conditions: [],
      conditionLogic: 'OR',
      defaultVisible: true,
      defaultRequired: false,
      config: {},
    },
    {
      id: 'hidden',
      type: 'text',
      label: 'Hidden Field',
      conditions: [],
      conditionLogic: 'OR',
      defaultVisible: false,
      defaultRequired: false,
      config: {},
    },
    {
      id: 'empty',
      type: 'text',
      label: 'Empty Field',
      conditions: [],
      conditionLogic: 'OR',
      defaultVisible: true,
      defaultRequired: false,
      config: {},
    },
  ],
};

const mockInstance: Instance = {
  id: 'inst1',
  templateId: 't1',
  templateSnapshot: mockTemplate,
  values: { name: 'Alice' },
  visibility: { name: true, hidden: false, empty: true },
  submittedAt: '2026-05-03T10:00:00Z',
};

function renderWithRoute(instanceId: string) {
  return render(
    <MemoryRouter initialEntries={[`/instances/${instanceId}`]}>
      <Routes>
        <Route path="/instances/:instanceId" element={<InstanceView />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  (vi.mocked(useInstancesStore)).mockReturnValue({
    instances: { inst1: mockInstance },
    loadFromStorage: vi.fn(),
  });
});

// Print region is rendered via createPortal into document.body, so it lives
// OUTSIDE the React Testing Library container. Query document.body directly.
function getPrintRegion(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>('#print-region');
  if (!el) throw new Error('print-region not found in document.body');
  return el;
}

describe('InstanceView — print region', () => {
  it('print region exists in DOM', () => {
    renderWithRoute('inst1');
    expect(document.body.querySelector('#print-region')).toBeTruthy();
  });

  it('form title appears in print region', () => {
    renderWithRoute('inst1');
    expect(getPrintRegion().textContent).toContain('My Form');
  });

  it('submission timestamp present in print region', () => {
    renderWithRoute('inst1');
    expect(getPrintRegion().textContent).toContain('Submitted');
  });

  it('hidden field not rendered in print region', () => {
    renderWithRoute('inst1');
    expect(getPrintRegion().textContent).not.toContain('Hidden Field');
  });

  it('visible-but-empty field renders — placeholder', () => {
    renderWithRoute('inst1');
    const printRegion = getPrintRegion();
    // Empty Field is visible but has no value — should render with em dash
    expect(printRegion.textContent).toContain('Empty Field');
    expect(printRegion.textContent).toContain('—');
  });

  it('visible field with value renders the value', () => {
    renderWithRoute('inst1');
    expect(getPrintRegion().textContent).toContain('Alice');
  });
});

describe('InstanceView — not found', () => {
  it('shows not-found message for unknown instance id', () => {
    (vi.mocked(useInstancesStore)).mockReturnValue({
      instances: {},
      loadFromStorage: vi.fn(),
    });
    const { container } = renderWithRoute('unknown');
    expect(container.textContent).toContain('not found');
  });
});
