import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TemplatesList } from './TemplatesList';
import type { Template } from '@/types/template';

vi.mock('@/stores/templates', () => ({
  useTemplatesStore: vi.fn(),
}));
vi.mock('@/stores/instances', () => ({
  useInstancesStore: vi.fn(),
}));

import { useTemplatesStore } from '@/stores/templates';
import { useInstancesStore } from '@/stores/instances';
import type { Instance } from '@/types/template';

const mockTemplate: Template = {
  id: 't1',
  title: 'My Survey',
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: '2026-01-15T00:00:00Z',
  fields: [
    { id: 'f1', type: 'text', label: 'Q1', conditions: [], conditionLogic: 'OR', defaultVisible: true, defaultRequired: false, config: {} },
    { id: 'f2', type: 'text', label: 'Q2', conditions: [], conditionLogic: 'OR', defaultVisible: true, defaultRequired: false, config: {} },
  ],
};

const invalidTemplate: Template = {
  ...mockTemplate,
  id: 't2',
  title: 'Broken Form',
};

function renderList() {
  return render(
    <MemoryRouter>
      <TemplatesList />
    </MemoryRouter>,
  );
}

function mockInstances(instances: Record<string, Instance> = {}) {
  (vi.mocked(useInstancesStore)).mockReturnValue({ instances, loadFromStorage: vi.fn(), addInstance: vi.fn(), templates: {} });
}

beforeEach(() => {
  (vi.mocked(useTemplatesStore)).mockReturnValue({
    templates: { t1: mockTemplate },
    invalidTemplateIds: new Set<string>(),
    loadFromStorage: vi.fn(),
    deleteTemplate: vi.fn(),
  });
  mockInstances();
});

describe('TemplatesList', () => {
  it('lists templates with title and field count', () => {
    renderList();
    expect(screen.getByText('My Survey')).toBeInTheDocument();
    expect(screen.getByText(/2 fields/)).toBeInTheDocument();
  });

  it('shows modified date', () => {
    renderList();
    expect(screen.getByText(/Modified/)).toBeInTheDocument();
  });

  it('quarantined template shows invalid badge and disables New Response', () => {
    (vi.mocked(useTemplatesStore)).mockReturnValue({
      templates: { t2: invalidTemplate },
      invalidTemplateIds: new Set(['t2']),
      loadFromStorage: vi.fn(),
      deleteTemplate: vi.fn(),
    });
    renderList();
    expect(screen.getByText(/invalid conditional logic/i)).toBeInTheDocument();
    // Fill link should not appear for invalid templates
    expect(screen.queryByRole('link', { name: /fill/i })).toBeNull();
  });

  it('empty templates list shows empty state message', () => {
    (vi.mocked(useTemplatesStore)).mockReturnValue({
      templates: {},
      invalidTemplateIds: new Set(),
      loadFromStorage: vi.fn(),
      deleteTemplate: vi.fn(),
    });
    renderList();
    expect(screen.getByText(/No forms yet/i)).toBeInTheDocument();
  });

  it('delete button calls deleteTemplate after confirmation', () => {
    const deleteTemplate = vi.fn();
    vi.stubGlobal('confirm', vi.fn(() => true));
    (vi.mocked(useTemplatesStore)).mockReturnValue({
      templates: { t1: mockTemplate },
      invalidTemplateIds: new Set(),
      loadFromStorage: vi.fn(),
      deleteTemplate,
    });
    renderList();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(deleteTemplate).toHaveBeenCalledWith('t1');
    vi.unstubAllGlobals();
  });

  it('delete cancelled → deleteTemplate not called', () => {
    const deleteTemplate = vi.fn();
    vi.stubGlobal('confirm', vi.fn(() => false));
    (vi.mocked(useTemplatesStore)).mockReturnValue({
      templates: { t1: mockTemplate },
      invalidTemplateIds: new Set(),
      loadFromStorage: vi.fn(),
      deleteTemplate,
    });
    renderList();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(deleteTemplate).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('TemplatesList — delete confirmation instance count', () => {
  function makeInstance(id: string, templateId: string): Instance {
    return {
      id,
      templateId,
      templateSnapshot: mockTemplate,
      values: {},
      visibility: {},
      submittedAt: '2026-05-03T00:00:00Z',
    };
  }

  it('0 instances: confirm message contains template title and no response count', () => {
    const confirmFn = vi.fn((_msg: string) => false);
    vi.stubGlobal('confirm', confirmFn);
    mockInstances({});
    renderList();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    const msg = confirmFn.mock.calls[0]![0];
    expect(msg).toContain('My Survey');
    expect(msg).toContain('This cannot be undone');
    expect(msg).not.toMatch(/\d+ filled response/);
    vi.unstubAllGlobals();
  });

  it('1 instance: confirm message contains "1 filled response" (singular)', () => {
    const confirmFn = vi.fn((_msg: string) => false);
    vi.stubGlobal('confirm', confirmFn);
    mockInstances({ i1: makeInstance('i1', 't1') });
    renderList();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    const msg = confirmFn.mock.calls[0]![0];
    expect(msg).toContain('1 filled response will also be deleted');
    expect(msg).not.toContain('responses');
    vi.unstubAllGlobals();
  });

  it('5 instances: confirm message contains "5 filled responses" (plural)', () => {
    const confirmFn = vi.fn((_msg: string) => false);
    vi.stubGlobal('confirm', confirmFn);
    const instances: Record<string, Instance> = {};
    for (let n = 1; n <= 5; n++) {
      instances[`i${n}`] = makeInstance(`i${n}`, 't1');
    }
    mockInstances(instances);
    renderList();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    const msg = confirmFn.mock.calls[0]![0];
    expect(msg).toContain('5 filled responses will also be deleted');
    vi.unstubAllGlobals();
  });
});
