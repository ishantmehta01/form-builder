import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TemplatesList } from './TemplatesList';
import type { Template } from '@/types/template';

vi.mock('@/stores/templates', () => ({
  useTemplatesStore: vi.fn(),
}));

import { useTemplatesStore } from '@/stores/templates';

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

beforeEach(() => {
  (vi.mocked(useTemplatesStore)).mockReturnValue({
    templates: { t1: mockTemplate },
    invalidTemplateIds: new Set<string>(),
    loadFromStorage: vi.fn(),
    deleteTemplate: vi.fn(),
  });
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
