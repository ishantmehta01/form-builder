import { create } from 'zustand';
import type { Template } from '@/types/template';
import { load } from '@/storage/load';
import { save } from '@/storage/save';

interface TemplatesState {
  templates: Record<string, Template>;
  invalidTemplateIds: Set<string>;
  instances: Record<string, import('@/types/template').Instance>;

  loadFromStorage: () => void;
  addTemplate: (template: Template) => void;
  updateTemplate: (template: Template) => void;
  deleteTemplate: (id: string) => void;
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  templates: {},
  invalidTemplateIds: new Set(),
  instances: {},

  loadFromStorage: () => {
    try {
      const data = load();
      set({
        templates: data.templates,
        instances: data.instances,
        invalidTemplateIds: data.invalidTemplateIds,
      });
    } catch (err) {
      console.error('[store] Failed to load from storage:', err);
    }
  },

  addTemplate: (template) => {
    const { templates, instances } = get();
    const next = { ...templates, [template.id]: template };
    set({ templates: next });
    save({ templates: next, instances });
  },

  updateTemplate: (template) => {
    const { templates, instances } = get();
    const next = { ...templates, [template.id]: template };
    set({ templates: next });
    save({ templates: next, instances });
  },

  deleteTemplate: (id) => {
    const { templates, instances } = get();
    const { [id]: _, ...next } = templates;
    set({ templates: next });
    save({ templates: next, instances });
  },
}));
