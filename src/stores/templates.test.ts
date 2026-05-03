import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTemplatesStore } from './templates';
import type { Template, Instance } from '@/types/template';

vi.mock('@/storage/save', () => ({
  save: vi.fn(),
}));
vi.mock('@/storage/load', () => ({
  load: vi.fn(() => ({
    version: 1,
    templates: {},
    instances: {},
    invalidTemplateIds: new Set<string>(),
  })),
}));

import { save } from '@/storage/save';

const makeTemplate = (id: string, title: string): Template => ({
  id,
  title,
  fields: [],
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: '2026-01-01T00:00:00Z',
});

const makeInstance = (id: string, templateId: string): Instance => ({
  id,
  templateId,
  templateSnapshot: makeTemplate(templateId, 'snap'),
  values: {},
  visibility: {},
  submittedAt: '2026-01-02T00:00:00Z',
});

describe('templates store — deleteTemplate cascade', () => {
  beforeEach(() => {
    vi.mocked(save).mockClear();
    // Reset Zustand store state between tests
    useTemplatesStore.setState({
      templates: {},
      instances: {},
      invalidTemplateIds: new Set(),
    });
  });

  it('removes the template from the templates map', () => {
    const t1 = makeTemplate('t1', 'T1');
    const t2 = makeTemplate('t2', 'T2');
    useTemplatesStore.setState({
      templates: { t1, t2 },
      instances: {},
    });

    useTemplatesStore.getState().deleteTemplate('t1');

    const { templates } = useTemplatesStore.getState();
    expect(templates).not.toHaveProperty('t1');
    expect(templates).toHaveProperty('t2');
  });

  it('cascades: removes instances belonging to the deleted template (D3)', () => {
    const t1 = makeTemplate('t1', 'T1');
    const t2 = makeTemplate('t2', 'T2');
    const i1 = makeInstance('i1', 't1');
    const i2 = makeInstance('i2', 't1');
    const i3 = makeInstance('i3', 't2');
    useTemplatesStore.setState({
      templates: { t1, t2 },
      instances: { i1, i2, i3 },
    });

    useTemplatesStore.getState().deleteTemplate('t1');

    const { instances } = useTemplatesStore.getState();
    // i1 and i2 belonged to t1 — must be gone
    expect(instances).not.toHaveProperty('i1');
    expect(instances).not.toHaveProperty('i2');
    // i3 belonged to t2 — must be preserved
    expect(instances).toHaveProperty('i3');
    expect(Object.keys(instances)).toHaveLength(1);
  });

  it('persists the cascaded state to storage (no orphans in localStorage)', () => {
    const t1 = makeTemplate('t1', 'T1');
    const i1 = makeInstance('i1', 't1');
    const i2 = makeInstance('i2', 't1');
    useTemplatesStore.setState({
      templates: { t1 },
      instances: { i1, i2 },
    });

    useTemplatesStore.getState().deleteTemplate('t1');

    expect(save).toHaveBeenCalledTimes(1);
    const savedArg = vi.mocked(save).mock.calls[0]?.[0];
    expect(savedArg).toBeDefined();
    expect(savedArg!.templates).toEqual({});
    expect(savedArg!.instances).toEqual({});
  });

  it('deleting a template with zero instances is a no-op for instances', () => {
    const t1 = makeTemplate('t1', 'T1');
    const i3 = makeInstance('i3', 't2'); // belongs to a different template
    useTemplatesStore.setState({
      templates: { t1 },
      instances: { i3 },
    });

    useTemplatesStore.getState().deleteTemplate('t1');

    const { instances } = useTemplatesStore.getState();
    expect(instances).toHaveProperty('i3');
    expect(Object.keys(instances)).toHaveLength(1);
  });

  it('deleting a non-existent template id leaves state unchanged', () => {
    const t1 = makeTemplate('t1', 'T1');
    const i1 = makeInstance('i1', 't1');
    useTemplatesStore.setState({
      templates: { t1 },
      instances: { i1 },
    });

    useTemplatesStore.getState().deleteTemplate('does-not-exist');

    const { templates, instances } = useTemplatesStore.getState();
    expect(templates).toHaveProperty('t1');
    expect(instances).toHaveProperty('i1');
  });
});
